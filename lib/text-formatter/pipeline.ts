import { getOperationDefinition } from "./operations";
import type {
  FormatterIssue,
  FormatterLocale,
  FormatterPreset,
  OperationExecution,
  OperationInstance,
  ParamRecord,
  PipelineResult,
} from "./types";

let instanceCounter = 0;

function createInstanceId(operationId: string): string {
  instanceCounter += 1;
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${instanceCounter.toString(36)}`;
  return `${operationId}-${random}`;
}

function cloneParams(params: ParamRecord): ParamRecord {
  if (typeof structuredClone === "function") return structuredClone(params);
  return JSON.parse(JSON.stringify(params)) as ParamRecord;
}

export function createOperationInstance(operationId: string): OperationInstance | undefined {
  const definition = getOperationDefinition(operationId);
  if (!definition) return undefined;
  const params = cloneParams(definition.defaults);
  if ((operationId === "shuffleLines" || operationId === "shuffleWords") && params.seed === "toolsy") {
    return {
      instanceId: createInstanceId(operationId),
      operationId,
      enabled: true,
      params: { ...params, seed: `${Date.now()}-${instanceCounter}` },
    };
  }
  return {
    instanceId: createInstanceId(operationId),
    operationId,
    enabled: true,
    params,
  };
}

export function createPresetInstances(preset: FormatterPreset): readonly OperationInstance[] {
  return preset.operations.flatMap(({ operationId, params }) => {
    const instance = createOperationInstance(operationId);
    return instance ? [{ ...instance, params: { ...instance.params, ...cloneParams(params) } }] : [];
  });
}

function hasErrors(issues: readonly FormatterIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

function execution(
  step: OperationInstance,
  status: OperationExecution["status"],
  inputCharacters: number,
  outputCharacters: number,
  issues: OperationExecution["issues"] = [],
  analysis: OperationExecution["analysis"] = [],
): OperationExecution {
  return {
    instanceId: step.instanceId,
    status,
    inputCharacters,
    outputCharacters,
    issues,
    analysis,
  };
}

export async function runPipeline(
  input: string,
  steps: readonly OperationInstance[],
  locale: FormatterLocale,
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const controller = signal ? undefined : new AbortController();
  const activeSignal = signal ?? controller?.signal ?? new AbortController().signal;
  const executions: OperationExecution[] = [];
  let text = input;

  for (const step of steps) {
    const inputCharacters = Array.from(text).length;
    if (!step.enabled) {
      executions.push(execution(step, "disabled", inputCharacters, inputCharacters));
      continue;
    }
    const definition = getOperationDefinition(step.operationId);
    if (!definition) {
      executions.push(execution(step, "error", inputCharacters, inputCharacters, [{
        code: "invalid-value",
        severity: "error",
        field: "operationId",
      }]));
      continue;
    }
    const params: ParamRecord = { ...definition.defaults, ...step.params };
    const validationIssues = definition.validate(params);
    if (hasErrors(validationIssues)) {
      executions.push(execution(step, "error", inputCharacters, inputCharacters, validationIssues));
      continue;
    }
    if (activeSignal.aborted) break;
    try {
      const result = await definition.transform(text, params, {
        locale,
        maxMatches: 10_000,
        maxOutputCharacters: 20_000_000,
        signal: activeSignal,
      });
      const issues = [...validationIssues, ...(result.issues ?? [])];
      const outputTooLarge = result.text.length > 20_000_000;
      if (outputTooLarge) {
        const sizeIssue: FormatterIssue = { code: "output-too-large", severity: "error" };
        executions.push(execution(step, "error", inputCharacters, inputCharacters, [...issues, sizeIssue], result.analysis ?? []));
        continue;
      }
      if (!hasErrors(issues)) text = result.text;
      const status = hasErrors(issues) ? "error" : issues.some((issue) => issue.severity === "warning") ? "warning" : "success";
      executions.push(execution(step, status, inputCharacters, Array.from(text).length, issues, result.analysis ?? []));
    } catch (error) {
      const issue: FormatterIssue = {
        code: "operation-failed",
        severity: "error",
        detail: error instanceof Error ? error.message : undefined,
      };
      executions.push(execution(step, "error", inputCharacters, inputCharacters, [issue]));
    }
  }

  return { text, executions };
}
