"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  AlignJustify,
  ArrowDown,
  ArrowUp,
  CaseUpper,
  Check,
  Copy,
  Download,
  Eraser,
  Link,
  List,
  Minimize2,
  Plus,
  RemoveFormatting,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  WandSparkles,
  WholeWord,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  createOperationInstance,
  findTextMatches,
  formatterPresets,
  getTextStats,
  operationList,
  replaceTextMatches,
  runPipeline,
  type FieldDefinition,
  type FormatterAnalysis,
  type FormatterIssue,
  type FormatterLocale,
  type OperationGroup,
  type OperationInstance,
  type ParamValue,
  type PipelineResult,
  type RegisteredOperation,
} from "@/lib/text-formatter";

const formatterUi = {
  "pt-BR": {
    input: "Entrada",
    result: "Resultado",
    inputPlaceholder: "Digite ou cole seu texto aqui…",
    resultPlaceholder: "O resultado aparecerá aqui.",
    characters: "caracteres",
    words: "palavras",
    lines: "linhas",
    size: "tamanho aprox.",
    copy: "Copiar",
    copied: "Copiado",
    clearInput: "Limpar entrada",
    useResult: "Usar resultado como entrada",
    download: "Baixar .txt",
    presets: "Atalhos",
    presetsDescription: "Aplique uma sequência pronta e ajuste depois.",
    choosePreset: "Escolher atalho",
    applyPreset: "Ativar atalho",
    removePreset: "Remover atalho",
    transformations: "Transformações",
    transformationsDescription: "Executadas de cima para baixo.",
    addTransformation: "Adicionar transformação",
    closeCatalog: "Fechar catálogo",
    searchTransformations: "Buscar transformação…",
    clickToAdd: "Clique para adicionar",
    chooseTransformation: "Escolher transformação",
    add: "Adicionar",
    noTransformations: "Cole um texto acima e escolha um atalho, ou adicione uma transformação.",
    noOperationsFound: "Nenhuma transformação encontrada.",
    clearTransformations: "Limpar transformações",
    enable: "Ativar",
    disable: "Desativar",
    configure: "Configurar",
    closeConfiguration: "Fechar configuração",
    moveUp: "Mover para cima",
    moveDown: "Mover para baixo",
    remove: "Remover",
    enabled: "Ativa",
    disabled: "Desativada",
    processing: "Processando…",
    searchTitle: "Buscar no texto",
    searchDescription: "Encontre e navegue pelas ocorrências na entrada ou no resultado.",
    query: "Buscar",
    searchPlaceholder: "Texto ou expressão…",
    target: "Buscar em",
    previous: "Ocorrência anterior",
    next: "Próxima ocorrência",
    inputTarget: "Entrada",
    resultTarget: "Resultado",
    noMatches: "Nenhuma ocorrência",
    caseSensitive: "Diferenciar maiúsculas e minúsculas",
    wholeWord: "Palavra inteira",
    regex: "Expressão regular",
    flags: "Flags",
    replaceTitle: "Buscar e substituir",
    replaceDescription: "Adicione a substituição ao pipeline para controlar sua ordem.",
    replaceWith: "Substituir por",
    replacePlaceholder: "Novo texto, opcional",
    firstOccurrence: "Primeira ocorrência",
    allOccurrences: "Todas as ocorrências",
    addReplacement: "Adicionar substituição",
    advancedRegex: "Regex avançada",
    advancedRegexDescription: "Use padrão, flags e grupos de captura com segurança.",
    pattern: "Padrão regex",
    patternPlaceholder: "Ex.: (\\w+)@(\\w+)",
    replacement: "Replacement",
    addRegex: "Adicionar regex ao pipeline",
    analysis: "Análises",
    frequency: "Frequência de palavras",
    word: "Palavra",
    count: "Quantidade",
    percentage: "Percentual",
    uniqueWords: "{count} palavras únicas",
    emptyAnalysis: "Execute uma operação de análise para ver os dados aqui.",
    resultUpdated: "Resultado atualizado",
    inputCleared: "Entrada limpa",
    pipelineCleared: "Transformações removidas",
    presetApplied: "Atalho ativado",
    presetRemoved: "Atalho removido",
    replacementAdded: "Substituição adicionada ao pipeline",
    regexAdded: "Regex adicionada ao pipeline",
    downloadName: "texto-tweakit.txt",
    step: "Etapa {number}",
    required: "Preencha este campo.",
    invalidValue: "Revise o valor informado.",
    invalidRegex: "Expressão regular inválida. Revise o padrão.",
    unsupportedFlag: "Flag não suportada: {flag}.",
    duplicateFlag: "A flag {flag} está repetida.",
    regexTimeout: "Esta expressão pode demorar demais. Tente um padrão mais simples.",
    tooManyMatches: "Há ocorrências demais; a lista foi limitada.",
    outputTooLarge: "A operação gerou um resultado grande demais.",
    operationFailed: "Não foi possível executar esta operação.",
    matchCount: "{count} ocorrências",
    oneMatch: "1 ocorrência",
    replacementCount: "{count} substituições",
    oneReplacement: "1 substituição",
    truncated: "mais de {count}",
    yes: "Sim",
    no: "Não",
    groups: {
      spacing: "Espaçamento",
      lines: "Linhas",
      words: "Palavras",
      substrings: "Trechos",
      characters: "Caracteres",
      capitalization: "Capitalização",
      minification: "Minificação",
      cleanup: "Limpeza",
      other: "Outros",
    },
  },
  en: {
    input: "Input",
    result: "Result",
    inputPlaceholder: "Type or paste your text here…",
    resultPlaceholder: "The result will appear here.",
    characters: "characters",
    words: "words",
    lines: "lines",
    size: "approx. size",
    copy: "Copy",
    copied: "Copied",
    clearInput: "Clear input",
    useResult: "Use result as input",
    download: "Download .txt",
    presets: "Shortcuts",
    presetsDescription: "Apply a ready-made sequence, then fine-tune.",
    choosePreset: "Choose shortcut",
    applyPreset: "Enable shortcut",
    removePreset: "Remove shortcut",
    transformations: "Transformations",
    transformationsDescription: "Operations run from top to bottom.",
    addTransformation: "Add transformation",
    closeCatalog: "Close catalog",
    searchTransformations: "Search transformations…",
    clickToAdd: "Click to add",
    chooseTransformation: "Choose transformation",
    add: "Add",
    noTransformations: "Paste text above and pick a shortcut, or add a transformation.",
    noOperationsFound: "No transformations found.",
    clearTransformations: "Clear transformations",
    enable: "Enable",
    disable: "Disable",
    configure: "Configure",
    closeConfiguration: "Close configuration",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    enabled: "Enabled",
    disabled: "Disabled",
    processing: "Processing…",
    searchTitle: "Search in text",
    searchDescription: "Find and navigate through matches in the input or result.",
    query: "Find",
    searchPlaceholder: "Text or expression…",
    target: "Search in",
    previous: "Previous match",
    next: "Next match",
    inputTarget: "Input",
    resultTarget: "Result",
    noMatches: "No matches",
    caseSensitive: "Case sensitive",
    wholeWord: "Whole word",
    regex: "Regular expression",
    flags: "Flags",
    replaceTitle: "Find and replace",
    replaceDescription: "Add the replacement to the pipeline to control its order.",
    replaceWith: "Replace with",
    replacePlaceholder: "New text, optional",
    firstOccurrence: "First occurrence",
    allOccurrences: "All occurrences",
    addReplacement: "Add replacement",
    advancedRegex: "Advanced regex",
    advancedRegexDescription: "Use patterns, flags and capture groups safely.",
    pattern: "Regex pattern",
    patternPlaceholder: "E.g. (\\w+)@(\\w+)",
    replacement: "Replacement",
    addRegex: "Add regex to pipeline",
    analysis: "Analysis",
    frequency: "Word frequency",
    word: "Word",
    count: "Count",
    percentage: "Percentage",
    uniqueWords: "{count} unique words",
    emptyAnalysis: "Run an analysis operation to see its data here.",
    resultUpdated: "Result updated",
    inputCleared: "Input cleared",
    pipelineCleared: "Transformations removed",
    presetApplied: "Shortcut enabled",
    presetRemoved: "Shortcut removed",
    replacementAdded: "Replacement added to pipeline",
    regexAdded: "Regex added to pipeline",
    downloadName: "tweakit-text.txt",
    step: "Step {number}",
    required: "Fill in this field.",
    invalidValue: "Check the value you entered.",
    invalidRegex: "Invalid regular expression. Check the pattern.",
    unsupportedFlag: "Unsupported flag: {flag}.",
    duplicateFlag: "The {flag} flag is repeated.",
    regexTimeout: "This expression may take too long. Try a simpler pattern.",
    tooManyMatches: "There are too many matches; the list was limited.",
    outputTooLarge: "The operation produced a result that is too large.",
    operationFailed: "This operation could not be completed.",
    matchCount: "{count} matches",
    oneMatch: "1 match",
    replacementCount: "{count} replacements",
    oneReplacement: "1 replacement",
    truncated: "more than {count}",
    yes: "Yes",
    no: "No",
    groups: {
      spacing: "Spacing",
      lines: "Lines",
      words: "Words",
      substrings: "Substrings",
      characters: "Characters",
      capitalization: "Capitalization",
      minification: "Minification",
      cleanup: "Cleanup",
      other: "Other",
    },
  },
} as const;

const groupOrder: readonly OperationGroup[] = [
  "spacing",
  "lines",
  "words",
  "substrings",
  "characters",
  "capitalization",
  "minification",
  "cleanup",
  "other",
];

const presetIcons: Record<string, LucideIcon> = {
  cleanText: WandSparkles,
  textToUrl: Link,
  normalizeText: AlignJustify,
  removeFormatting: RemoveFormatting,
  prepareList: List,
  minify: Minimize2,
};

const groupIcons: Record<OperationGroup, LucideIcon> = {
  spacing: AlignJustify,
  lines: List,
  words: WholeWord,
  substrings: Search,
  characters: Type,
  capitalization: CaseUpper,
  minification: Minimize2,
  cleanup: Sparkles,
  other: WandSparkles,
};

function replaceToken(template: string, key: string, value: string | number) {
  return template.replace(`{${key}}`, String(value));
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function operationMatches(operation: RegisteredOperation, query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  const searchable = [
    operation.label["pt-BR"],
    operation.label.en,
    operation.description["pt-BR"],
    operation.description.en,
    ...operation.keywords["pt-BR"],
    ...operation.keywords.en,
  ];
  return searchable.some((value) => normalizeSearch(value).includes(normalized));
}

function issueText(issue: FormatterIssue, locale: FormatterLocale) {
  const ui = formatterUi[locale];
  const flag = String(issue.values?.flag ?? "");
  switch (issue.code) {
    case "required":
      return ui.required;
    case "invalid-value":
      return ui.invalidValue;
    case "invalid-regex":
      return ui.invalidRegex;
    case "unsupported-regex-flag":
      return replaceToken(ui.unsupportedFlag, "flag", flag);
    case "duplicate-regex-flag":
      return replaceToken(ui.duplicateFlag, "flag", flag);
    case "regex-timeout":
      return ui.regexTimeout;
    case "too-many-matches":
      return ui.tooManyMatches;
    case "output-too-large":
      return ui.outputTooLarge;
    case "operation-failed":
      return ui.operationFailed;
  }
}

function issueForField(
  issues: readonly FormatterIssue[],
  fieldKey: string,
) {
  return issues.find((issue) => issue.field === fieldKey);
}

function OperationField({
  field,
  step,
  locale,
  issues,
  onChange,
}: {
  field: FieldDefinition;
  step: OperationInstance;
  locale: FormatterLocale;
  issues: readonly FormatterIssue[];
  onChange: (key: string, value: ParamValue) => void;
}) {
  const id = `${step.instanceId}-${field.key}`;
  const value = step.params[field.key];
  const issue = issueForField(issues, field.key);
  const describedBy = issue ? `${id}-issue` : undefined;

  if (field.type === "toggle") {
    return (
      <label className="formatter-toggle-field" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(field.key, event.currentTarget.checked)}
        />
        <span>{field.label[locale]}</span>
      </label>
    );
  }

  return (
    <div className={`formatter-field${issue ? " formatter-field--error" : ""}`}>
      <label htmlFor={id}>{field.label[locale]}</label>
      {field.type === "select" ? (
        <select
          id={id}
          className="formatter-control"
          value={typeof value === "string" ? value : ""}
          aria-invalid={Boolean(issue)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(field.key, event.currentTarget.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label[locale]}
            </option>
          ))}
        </select>
      ) : field.type === "number" ? (
        <input
          id={id}
          className="formatter-control"
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          min={field.min}
          max={field.max}
          step={field.step}
          aria-invalid={Boolean(issue)}
          aria-describedby={describedBy}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(field.key, next === "" ? "" : Number(next));
          }}
        />
      ) : field.multiline ? (
        <textarea
          id={id}
          className="formatter-control formatter-control--multiline"
          rows={3}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder?.[locale]}
          required={field.required}
          aria-invalid={Boolean(issue)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(field.key, event.currentTarget.value)}
        />
      ) : (
        <input
          id={id}
          className="formatter-control"
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder?.[locale]}
          required={field.required}
          aria-invalid={Boolean(issue)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(field.key, event.currentTarget.value)}
        />
      )}
      {issue && (
        <p id={`${id}-issue`} className="formatter-field-error" role="alert">
          {issueText(issue, locale)}
        </p>
      )}
    </div>
  );
}

function TextStats({
  text,
  locale,
}: {
  text: string;
  locale: FormatterLocale;
}) {
  const ui = formatterUi[locale];
  const stats = useMemo(() => getTextStats(text, locale), [text, locale]);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  return (
    <div className="formatter-stats" aria-label={`${number.format(stats.characters)} ${ui.characters}`}>
      <span><strong>{number.format(stats.characters)}</strong> {ui.characters}</span>
      <span><strong>{number.format(stats.words)}</strong> {ui.words}</span>
      <span><strong>{number.format(stats.lines)}</strong> {ui.lines}</span>
      <span><strong>{stats.formattedBytes}</strong> {ui.size}</span>
    </div>
  );
}

function PipelineAnalysis({
  analyses,
  locale,
}: {
  analyses: readonly FormatterAnalysis[];
  locale: FormatterLocale;
}) {
  const ui = formatterUi[locale];
  const frequencies = analyses.filter(
    (analysis): analysis is Extract<FormatterAnalysis, { kind: "word-frequency" }> =>
      analysis.kind === "word-frequency",
  );
  if (frequencies.length === 0) return null;
  return (
    <section className="formatter-analysis" aria-labelledby="formatter-analysis-title">
      <div className="formatter-section-heading">
        <div>
          <p className="formatter-section-kicker">{ui.analysis}</p>
          <h3 id="formatter-analysis-title">{ui.frequency}</h3>
        </div>
      </div>
      {frequencies.map((analysis, analysisIndex) => (
        <div className="formatter-analysis-card" key={`${analysis.total}-${analysis.unique}-${analysisIndex}`}>
          <p>{replaceToken(ui.uniqueWords, "count", analysis.unique)}</p>
          <div className="formatter-table-wrap">
            <table className="formatter-table">
              <thead>
                <tr><th>{ui.word}</th><th>{ui.count}</th><th>{ui.percentage}</th></tr>
              </thead>
              <tbody>
                {analysis.rows.slice(0, 100).map((row) => (
                  <tr key={row.word}>
                    <td>{row.word}</td>
                    <td>{row.count}</td>
                    <td>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(row.percentage)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

export function TextFormatter() {
  const { locale } = useApp();
  const ui = formatterUi[locale];
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<OperationInstance[]>([]);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult>({ text: "", executions: [] });
  const [operationQuery, setOperationQuery] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState(operationList[0]?.id ?? "");
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [activePresetIds, setActivePresetIds] = useState<string[]>([]);
  const [presetStepIds, setPresetStepIds] = useState<Record<string, string[]>>({});
  const [workspaceTab, setWorkspaceTab] = useState<"transformations" | "search">("transformations");
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTarget, setSearchTarget] = useState<"input" | "result">("result");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchFlags, setSearchFlags] = useState("gu");
  const [searchIndex, setSearchIndex] = useState(0);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [replaceCaseSensitive, setReplaceCaseSensitive] = useState(false);
  const [replaceWholeWord, setReplaceWholeWord] = useState(false);
  const [replaceRegex, setReplaceRegex] = useState(false);
  const [replaceFlags, setReplaceFlags] = useState("gu");
  const [replaceAll, setReplaceAll] = useState(true);
  const [advancedPattern, setAdvancedPattern] = useState("");
  const [advancedFlags, setAdvancedFlags] = useState("gu");
  const [advancedReplacement, setAdvancedReplacement] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const deferredInput = useDeferredValue(input);
  const deferredSteps = useDeferredValue(steps);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const delay = deferredInput.length >= 100_000 ? 120 : 0;
    const timer = window.setTimeout(() => {
      void runPipeline(deferredInput, deferredSteps, locale, controller.signal)
        .then((next) => {
          if (active && !controller.signal.aborted) setPipelineResult(next);
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setPipelineResult({ text: deferredInput, executions: [] });
          }
        });
    }, delay);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredInput, deferredSteps, locale]);

  useEffect(() => () => {
    if (noticeTimer.current !== undefined) window.clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== undefined) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2200);
  };

  const output = steps.length === 0 ? input : pipelineResult.text;
  const isProcessing = deferredInput !== input || deferredSteps !== steps;
  const filteredOperations = useMemo(
    () => operationList.filter((operation) => operationMatches(operation, operationQuery)),
    [operationQuery],
  );
  const effectiveOperationId = filteredOperations.some((operation) => operation.id === selectedOperationId)
    ? selectedOperationId
    : filteredOperations[0]?.id ?? "";
  const executionById = useMemo(
    () => new Map(pipelineResult.executions.map((execution) => [execution.instanceId, execution])),
    [pipelineResult.executions],
  );
  const analyses = useMemo(
    () => pipelineResult.executions.flatMap((execution) => execution.analysis),
    [pipelineResult.executions],
  );
  const searchSource = searchTarget === "input" ? input : output;
  const searchResult = useMemo(
    () => findTextMatches(searchSource, searchQuery, {
      caseSensitive: searchCaseSensitive,
      wholeWord: searchWholeWord,
      regex: searchRegex,
      flags: searchFlags,
      maxMatches: 10_000,
    }),
    [searchSource, searchQuery, searchCaseSensitive, searchWholeWord, searchRegex, searchFlags],
  );
  const activeSearchIndex = searchResult.matches.length === 0
    ? -1
    : Math.min(searchIndex, searchResult.matches.length - 1);
  const replacePreview = useMemo(
    () => replaceTextMatches(output, replaceQuery, replacement, {
      caseSensitive: replaceCaseSensitive,
      wholeWord: replaceWholeWord,
      regex: replaceRegex,
      flags: replaceFlags,
      replaceAll,
      maxMatches: 100_000,
    }),
    [output, replaceQuery, replacement, replaceCaseSensitive, replaceWholeWord, replaceRegex, replaceFlags, replaceAll],
  );
  const advancedPreview = useMemo(
    () => replaceTextMatches(output, advancedPattern, advancedReplacement, {
      regex: true,
      flags: advancedFlags,
      replaceAll: advancedFlags.includes("g"),
      maxMatches: 100_000,
    }),
    [output, advancedPattern, advancedReplacement, advancedFlags],
  );

  const addOperation = (operationId = effectiveOperationId) => {
    const instance = createOperationInstance(operationId);
    if (!instance) return;
    setSteps((current) => [...current, instance]);
    setExpandedStepId(instance.instanceId);
    setOperationQuery("");
    setSelectedOperationId(operationId);
  };

  const updateStep = (instanceId: string, update: (step: OperationInstance) => OperationInstance) => {
    setSteps((current) => current.map((step) => step.instanceId === instanceId ? update(step) : step));
  };

  const updateParameter = (instanceId: string, key: string, value: ParamValue) => {
    updateStep(instanceId, (step) => ({
      ...step,
      params: { ...step.params, [key]: value },
    }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= steps.length) return;
    setSteps((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(destination, 0, moved);
      return next;
    });
  };

  const makePresetSteps = (presetId: string) => {
    const preset = formatterPresets.find((item) => item.id === presetId);
    if (!preset) return [];
    return preset.operations.flatMap((item) => {
      const instance = createOperationInstance(item.operationId);
      return instance ? [{ ...instance, params: { ...instance.params, ...item.params } }] : [];
    });
  };

  const removeStep = (instanceId: string) => {
    setSteps((current) => current.filter((item) => item.instanceId !== instanceId));
    setExpandedStepId((current) => current === instanceId ? null : current);
    setPresetStepIds((current) => {
      const next: Record<string, string[]> = {};
      for (const [presetId, ids] of Object.entries(current)) {
        const remaining = ids.filter((id) => id !== instanceId);
        if (remaining.length > 0) next[presetId] = remaining;
      }
      return next;
    });
    setActivePresetIds((active) =>
      active.filter((presetId) => {
        const ids = presetStepIds[presetId] ?? [];
        return ids.some((id) => id !== instanceId);
      }),
    );
  };

  const clearPipeline = () => {
    setSteps([]);
    setExpandedStepId(null);
    setActivePresetIds([]);
    setPresetStepIds({});
  };

  const togglePreset = (presetId: string) => {
    if (activePresetIds.includes(presetId)) {
      const idsToRemove = new Set(presetStepIds[presetId] ?? []);
      setSteps((current) => current.filter((step) => !idsToRemove.has(step.instanceId)));
      setActivePresetIds((current) => current.filter((id) => id !== presetId));
      setPresetStepIds((current) => {
        const next = { ...current };
        delete next[presetId];
        return next;
      });
      setExpandedStepId((current) => current && idsToRemove.has(current) ? null : current);
      showNotice(ui.presetRemoved);
      return;
    }

    const presetSteps = makePresetSteps(presetId);
    if (presetSteps.length === 0) return;
    setSteps((current) => [...current, ...presetSteps]);
    setActivePresetIds((current) => [...current, presetId]);
    setPresetStepIds((current) => ({
      ...current,
      [presetId]: presetSteps.map((step) => step.instanceId),
    }));
    setExpandedStepId(null);
    showNotice(ui.presetApplied);
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = output;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand("copy");
      temporary.remove();
    }
    showNotice(ui.copied);
  };

  const downloadResult = () => {
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = ui.downloadName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const navigateMatch = (direction: -1 | 1) => {
    const count = searchResult.matches.length;
    if (count === 0) return;
    const current = activeSearchIndex < 0 ? 0 : activeSearchIndex;
    const next = (current + direction + count) % count;
    const match = searchResult.matches[next];
    setSearchIndex(next);
    const target = searchTarget === "input" ? inputRef.current : resultRef.current;
    target?.focus();
    target?.setSelectionRange(match.start, match.end);
  };

  const addFindReplace = () => {
    const instance = createOperationInstance("replaceAllOccurrences");
    if (!instance || replaceQuery.length === 0 || replacePreview.issue) return;
    setSteps((current) => [
      ...current,
      {
        ...instance,
        params: {
          ...instance.params,
          find: replaceQuery,
          replacement,
          caseSensitive: replaceCaseSensitive,
          wholeWord: replaceWholeWord,
          regex: replaceRegex,
          flags: replaceFlags,
          replaceAll,
        },
      },
    ]);
    showNotice(ui.replacementAdded);
  };

  const addAdvancedRegex = () => {
    const instance = createOperationInstance("regexReplace");
    if (!instance || advancedPattern.length === 0 || advancedPreview.issue) return;
    setSteps((current) => [
      ...current,
      {
        ...instance,
        params: {
          ...instance.params,
          pattern: advancedPattern,
          flags: advancedFlags,
          replacement: advancedReplacement,
        },
      },
    ]);
    showNotice(ui.regexAdded);
  };

  const searchCountText = searchResult.total === 0
    ? ui.noMatches
    : searchResult.total === 1
      ? ui.oneMatch
      : searchResult.truncated
        ? replaceToken(ui.truncated, "count", searchResult.matches.length)
        : replaceToken(ui.matchCount, "count", searchResult.total);
  const replacementCountText = replacePreview.replacements === 1
    ? ui.oneReplacement
    : replaceToken(ui.replacementCount, "count", replacePreview.replacements);

  return (
    <div className="formatter">
      <div className="formatter-workspace-tabs" role="tablist" aria-label={ui.transformations}>
        <button type="button" role="tab" aria-selected={workspaceTab === "transformations"} className={workspaceTab === "transformations" ? "is-active" : ""} onClick={() => setWorkspaceTab("transformations")}>
          <WandSparkles size={16} />{ui.transformations}{steps.length > 0 && <span>{steps.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={workspaceTab === "search"} className={workspaceTab === "search" ? "is-active" : ""} onClick={() => setWorkspaceTab("search")}>
          <Search size={16} />{ui.searchTitle}
        </button>
      </div>
      <div className="formatter-panels">
        <section className="formatter-panel" aria-labelledby="formatter-input-title">
          <div className="formatter-panel-header">
            <h2 id="formatter-input-title">{ui.input}</h2>
            <div className="formatter-panel-toolbar">
              <button type="button" className="formatter-icon-button" onClick={() => { setInput(""); showNotice(ui.inputCleared); }} disabled={!input} aria-label={ui.clearInput} title={ui.clearInput}>
                <Eraser size={16} />
              </button>
            </div>
          </div>
          <textarea
            ref={inputRef}
            className="formatter-textarea"
            value={input}
            placeholder={ui.inputPlaceholder}
            spellCheck={false}
            aria-label={ui.input}
            onChange={(event) => setInput(event.currentTarget.value)}
          />
          <TextStats text={input} locale={locale} />
        </section>
        <section className="formatter-panel" aria-labelledby="formatter-result-title">
          <div className="formatter-panel-header">
            <div className="formatter-result-heading">
              <h2 id="formatter-result-title">{ui.result}</h2>
              {isProcessing && <span className="formatter-processing">{ui.processing}</span>}
            </div>
            <div className="formatter-panel-toolbar">
              <button type="button" className="formatter-icon-button" onClick={() => { setInput(output); clearPipeline(); showNotice(ui.resultUpdated); }} disabled={!output} aria-label={ui.useResult} title={ui.useResult}>
                <ArrowUp size={16} />
              </button>
              <button type="button" className="formatter-icon-button" onClick={downloadResult} disabled={!output} aria-label={ui.download} title={ui.download}>
                <Download size={16} />
              </button>
              <button type="button" className="formatter-button formatter-button--primary" onClick={() => void copyResult()} disabled={!output}>
                {notice === ui.copied ? <Check size={16} /> : <Copy size={16} />}{notice === ui.copied ? ui.copied : ui.copy}
              </button>
            </div>
          </div>
          <textarea
            ref={resultRef}
            className="formatter-textarea formatter-textarea--result"
            value={output}
            placeholder={ui.resultPlaceholder}
            spellCheck={false}
            readOnly
            aria-label={ui.result}
          />
          <TextStats text={output} locale={locale} />
        </section>
      </div>

      {workspaceTab === "transformations" && <div className="formatter-workspace-pane" role="tabpanel">
      <div className="formatter-preset-chips" role="group" aria-label={ui.presets}>
        <p className="formatter-preset-chips-title" id="formatter-presets-title">{ui.presets}</p>
        {formatterPresets.map((preset) => {
          const PresetIcon = presetIcons[preset.id] ?? WandSparkles;
          const isActive = activePresetIds.includes(preset.id);
          return (
            <button
              type="button"
              key={preset.id}
              className={`formatter-preset-chip${isActive ? " formatter-preset-chip--active" : ""}`}
              aria-pressed={isActive}
              title={isActive ? ui.removePreset : ui.applyPreset}
              onClick={() => togglePreset(preset.id)}
            >
              <PresetIcon size={15} />
              <span>{preset.label[locale]}</span>
              <small>{preset.operations.length}</small>
            </button>
          );
        })}
      </div>

      <div className="formatter-pipeline-board" aria-labelledby="formatter-pipeline-title">
        <div className="formatter-pipeline-toolbar">
          <div>
            <h3 id="formatter-pipeline-title">{ui.transformations}</h3>
            <p>{ui.transformationsDescription}</p>
          </div>
          <div className="formatter-pipeline-toolbar-actions">
            <button
              type="button"
              className={`formatter-button${isCatalogOpen ? " formatter-button--primary" : ""}`}
              aria-expanded={isCatalogOpen}
              onClick={() => setIsCatalogOpen((current) => !current)}
            >
              {isCatalogOpen ? <Search size={16} /> : <Plus size={16} />}
              {isCatalogOpen ? ui.closeCatalog : ui.addTransformation}
            </button>
            {steps.length > 0 && (
              <button type="button" className="formatter-button formatter-button--danger" onClick={() => { clearPipeline(); showNotice(ui.pipelineCleared); }}>
                <Trash2 size={16} />{ui.clearTransformations}
              </button>
            )}
          </div>
        </div>

        {isCatalogOpen && (
        <div className="formatter-operation-picker">
          <label className="formatter-sr-only" htmlFor="formatter-operation-search">{ui.addTransformation}</label>
          <div className="formatter-operation-filter">
            <Search size={17} aria-hidden="true" />
            <input
              id="formatter-operation-search"
              className="formatter-control"
              type="search"
              value={operationQuery}
              placeholder={ui.searchTransformations}
              autoFocus
              onChange={(event) => setOperationQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && effectiveOperationId) {
                  event.preventDefault();
                  addOperation(effectiveOperationId);
                }
              }}
            />
          </div>
          {filteredOperations.length === 0 ? (
            <p className="formatter-empty-inline">{ui.noOperationsFound}</p>
          ) : (
            <div className="formatter-operation-catalog">
              {groupOrder.map((group) => {
                const operations = filteredOperations.filter((operation) => operation.group === group);
                if (operations.length === 0) return null;
                const GroupIcon = groupIcons[group];
                return (
                  <section className="formatter-operation-group" key={group} aria-label={ui.groups[group]}>
                    <p className="formatter-operation-group-name"><GroupIcon size={13} />{ui.groups[group]}</p>
                    <div className="formatter-operation-group-chips">
                      {operations.map((operation) => (
                        <button
                          type="button"
                          className="formatter-operation-chip"
                          key={operation.id}
                          title={operation.description[locale]}
                          onClick={() => addOperation(operation.id)}
                        >
                          {operation.label[locale]}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
        )}

        {steps.length === 0 ? (
          <div className="formatter-empty-state">
            <WandSparkles size={22} />
            <p>{ui.noTransformations}</p>
          </div>
        ) : (
          <ol className="formatter-pipeline">
            {steps.map((step, index) => {
              const operation = operationList.find((item) => item.id === step.operationId);
              if (!operation) return null;
              const execution = executionById.get(step.instanceId);
              const issues = execution?.issues ?? operation.validate(step.params);
              const hasError = issues.some((issue) => issue.severity === "error");
              const expanded = expandedStepId === step.instanceId;
              return (
                <li key={step.instanceId} className={`formatter-step${step.enabled ? "" : " formatter-step--disabled"}${hasError ? " formatter-step--error" : ""}`}>
                  <div className="formatter-step-main">
                    <span className="formatter-step-number">{index + 1}</span>
                    <label className="formatter-step-toggle">
                      <input
                        type="checkbox"
                        checked={step.enabled}
                        onChange={(event) => updateStep(step.instanceId, (current) => ({ ...current, enabled: event.currentTarget.checked }))}
                        aria-label={`${step.enabled ? ui.disable : ui.enable}: ${operation.label[locale]}`}
                      />
                      <span aria-hidden="true" />
                    </label>
                    <div className="formatter-step-copy">
                      <strong>{operation.label[locale]}</strong>
                      <span title={operation.description[locale]}>{step.enabled ? ui.enabled : ui.disabled}</span>
                    </div>
                    <div className="formatter-step-actions">
                      {operation.fields.length > 0 && (
                        <button type="button" className="formatter-icon-button" onClick={() => setExpandedStepId(expanded ? null : step.instanceId)} aria-label={`${expanded ? ui.closeConfiguration : ui.configure}: ${operation.label[locale]}`} aria-expanded={expanded}>
                          <Settings2 size={17} />
                        </button>
                      )}
                      <button type="button" className="formatter-icon-button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={`${ui.moveUp}: ${operation.label[locale]}`}><ArrowUp size={17} /></button>
                      <button type="button" className="formatter-icon-button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label={`${ui.moveDown}: ${operation.label[locale]}`}><ArrowDown size={17} /></button>
                      <button type="button" className="formatter-icon-button formatter-icon-button--danger" onClick={() => removeStep(step.instanceId)} aria-label={`${ui.remove}: ${operation.label[locale]}`}><Trash2 size={17} /></button>
                    </div>
                  </div>
                  {expanded && operation.fields.length > 0 && (
                    <div className="formatter-step-config">
                      <p className="formatter-step-config-title">{replaceToken(ui.step, "number", index + 1)} · {ui.configure}</p>
                      <div className="formatter-fields">
                        {operation.fields.map((field) => (
                          <OperationField
                            key={field.key}
                            field={field}
                            step={step}
                            locale={locale}
                            issues={issues}
                            onChange={(key, value) => updateParameter(step.instanceId, key, value)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {issues.length > 0 && (
                    <div className="formatter-step-issues" role="status">
                      {issues.map((issue, issueIndex) => (
                        <p key={`${issue.code}-${issue.field ?? "general"}-${issueIndex}`} className={`formatter-issue formatter-issue--${issue.severity}`}>
                          <AlertCircle size={15} />{issueText(issue, locale)}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      </div>}

      {workspaceTab === "search" && <div className="formatter-section formatter-find-tools" role="tabpanel" aria-label={ui.searchTitle}>
        <details className="formatter-disclosure" open>
          <summary><Search size={17} /><span><strong>{ui.searchTitle}</strong><small>{ui.searchDescription}</small></span></summary>
          <div className="formatter-disclosure-content">
            <div className="formatter-find-grid">
              <div className="formatter-field">
                <label htmlFor="formatter-search-query">{ui.query}</label>
                <input
                  id="formatter-search-query"
                  className="formatter-control"
                  type="text"
                  value={searchQuery}
                  placeholder={ui.searchPlaceholder}
                  onChange={(event) => { setSearchQuery(event.currentTarget.value); setSearchIndex(0); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      navigateMatch(event.shiftKey ? -1 : 1);
                    }
                  }}
                />
              </div>
              <div className="formatter-field">
                <label htmlFor="formatter-search-target">{ui.target}</label>
                <select id="formatter-search-target" className="formatter-control" value={searchTarget} onChange={(event) => { setSearchTarget(event.currentTarget.value as "input" | "result"); setSearchIndex(0); }}>
                  <option value="input">{ui.inputTarget}</option>
                  <option value="result">{ui.resultTarget}</option>
                </select>
              </div>
              {searchRegex && (
                <div className="formatter-field">
                  <label htmlFor="formatter-search-flags">{ui.flags}</label>
                  <input id="formatter-search-flags" className="formatter-control formatter-control--code" value={searchFlags} onChange={(event) => { setSearchFlags(event.currentTarget.value); setSearchIndex(0); }} />
                </div>
              )}
            </div>
            <div className="formatter-option-row">
              <label><input type="checkbox" checked={searchCaseSensitive} onChange={(event) => { setSearchCaseSensitive(event.currentTarget.checked); setSearchIndex(0); }} />{ui.caseSensitive}</label>
              <label><input type="checkbox" checked={searchWholeWord} onChange={(event) => { setSearchWholeWord(event.currentTarget.checked); setSearchIndex(0); }} />{ui.wholeWord}</label>
              <label><input type="checkbox" checked={searchRegex} onChange={(event) => { setSearchRegex(event.currentTarget.checked); setSearchIndex(0); }} />{ui.regex}</label>
            </div>
            <div className="formatter-match-navigation">
              <span aria-live="polite">{searchCountText}{activeSearchIndex >= 0 ? ` · ${activeSearchIndex + 1}/${searchResult.matches.length}` : ""}</span>
              <button type="button" className="formatter-icon-button" onClick={() => navigateMatch(-1)} disabled={searchResult.matches.length === 0} aria-label={ui.previous}><ArrowUp size={17} /></button>
              <button type="button" className="formatter-icon-button" onClick={() => navigateMatch(1)} disabled={searchResult.matches.length === 0} aria-label={ui.next}><ArrowDown size={17} /></button>
            </div>
            {searchResult.issue && <p className="formatter-issue formatter-issue--error" role="alert"><AlertCircle size={15} />{issueText(searchResult.issue, locale)}</p>}
          </div>
        </details>

        <details className="formatter-disclosure">
          <summary><Settings2 size={17} /><span><strong>{ui.replaceTitle}</strong><small>{ui.replaceDescription}</small></span></summary>
          <div className="formatter-disclosure-content">
            <div className="formatter-find-grid formatter-find-grid--replace">
              <div className="formatter-field">
                <label htmlFor="formatter-replace-query">{ui.query}</label>
                <input id="formatter-replace-query" className="formatter-control" value={replaceQuery} placeholder={ui.searchPlaceholder} onChange={(event) => setReplaceQuery(event.currentTarget.value)} />
              </div>
              <div className="formatter-field">
                <label htmlFor="formatter-replacement">{ui.replaceWith}</label>
                <input id="formatter-replacement" className="formatter-control" value={replacement} placeholder={ui.replacePlaceholder} onChange={(event) => setReplacement(event.currentTarget.value)} />
              </div>
              {replaceRegex && (
                <div className="formatter-field">
                  <label htmlFor="formatter-replace-flags">{ui.flags}</label>
                  <input id="formatter-replace-flags" className="formatter-control formatter-control--code" value={replaceFlags} onChange={(event) => setReplaceFlags(event.currentTarget.value)} />
                </div>
              )}
            </div>
            <div className="formatter-option-row">
              <label><input type="checkbox" checked={replaceCaseSensitive} onChange={(event) => setReplaceCaseSensitive(event.currentTarget.checked)} />{ui.caseSensitive}</label>
              <label><input type="checkbox" checked={replaceWholeWord} onChange={(event) => setReplaceWholeWord(event.currentTarget.checked)} />{ui.wholeWord}</label>
              <label><input type="checkbox" checked={replaceRegex} onChange={(event) => setReplaceRegex(event.currentTarget.checked)} />{ui.regex}</label>
            </div>
            <div className="formatter-replace-footer">
              <label className="formatter-control-choice" htmlFor="formatter-replace-scope">{ui.allOccurrences}</label>
              <select id="formatter-replace-scope" className="formatter-control formatter-control--compact" value={replaceAll ? "all" : "first"} onChange={(event) => setReplaceAll(event.currentTarget.value === "all")}>
                <option value="all">{ui.allOccurrences}</option>
                <option value="first">{ui.firstOccurrence}</option>
              </select>
              <span className="formatter-replacement-count" aria-live="polite">{replacementCountText}</span>
              <button type="button" className="formatter-button formatter-button--primary" onClick={addFindReplace} disabled={!replaceQuery || Boolean(replacePreview.issue)}><Plus size={16} />{ui.addReplacement}</button>
            </div>
            {replacePreview.issue && <p className="formatter-issue formatter-issue--error" role="alert"><AlertCircle size={15} />{issueText(replacePreview.issue, locale)}</p>}
          </div>
        </details>

        <details className="formatter-disclosure">
          <summary><Settings2 size={17} /><span><strong>{ui.advancedRegex}</strong><small>{ui.advancedRegexDescription}</small></span></summary>
          <div className="formatter-disclosure-content">
            <div className="formatter-find-grid formatter-find-grid--regex">
              <div className="formatter-field formatter-field--wide">
                <label htmlFor="formatter-regex-pattern">{ui.pattern}</label>
                <input id="formatter-regex-pattern" className="formatter-control formatter-control--code" value={advancedPattern} placeholder={ui.patternPlaceholder} maxLength={500} onChange={(event) => setAdvancedPattern(event.currentTarget.value)} />
              </div>
              <div className="formatter-field">
                <label htmlFor="formatter-regex-flags">{ui.flags}</label>
                <input id="formatter-regex-flags" className="formatter-control formatter-control--code" value={advancedFlags} onChange={(event) => setAdvancedFlags(event.currentTarget.value)} />
              </div>
              <div className="formatter-field formatter-field--wide">
                <label htmlFor="formatter-regex-replacement">{ui.replacement}</label>
                <input id="formatter-regex-replacement" className="formatter-control formatter-control--code" value={advancedReplacement} placeholder="$1" onChange={(event) => setAdvancedReplacement(event.currentTarget.value)} />
              </div>
            </div>
            <div className="formatter-replace-footer">
              <span className="formatter-replacement-count" aria-live="polite">{advancedPreview.replacements === 1 ? ui.oneReplacement : replaceToken(ui.replacementCount, "count", advancedPreview.replacements)}</span>
              <button type="button" className="formatter-button formatter-button--primary" onClick={addAdvancedRegex} disabled={!advancedPattern || Boolean(advancedPreview.issue)}><Plus size={16} />{ui.addRegex}</button>
            </div>
            {advancedPreview.issue && <p className="formatter-issue formatter-issue--error" role="alert"><AlertCircle size={15} />{issueText(advancedPreview.issue, locale)}</p>}
          </div>
        </details>
      </div>}

      {workspaceTab === "transformations" && <PipelineAnalysis analyses={analyses} locale={locale} />}
      <p className="formatter-live-region" aria-live="polite">{notice}</p>
    </div>
  );
}

export default TextFormatter;
