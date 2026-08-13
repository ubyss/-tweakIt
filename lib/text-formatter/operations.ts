import type {
  FieldDefinition,
  FormatterIssue,
  FormatterLocale,
  OperationGroup,
  ParamRecord,
  RegisteredOperation,
  TransformContext,
  TransformResult,
} from "./types";
import {
  WORD_CHARACTER_SOURCE,
  countGraphemes,
  escapeRegExp,
  graphemes,
  joinWordsAndSeparators,
  localized,
  mapWords,
  normalizeLineEndings,
  replaceTextMatches,
  seededShuffle,
  splitLines,
  stableSort,
  tokenizeCase,
  validateRegexFlags,
  wordTokens,
  wordsAndSeparators,
} from "./text-utils";

type OperationTransform = (
  input: string,
  params: ParamRecord,
  context: TransformContext,
) => TransformResult | Promise<TransformResult>;

interface OperationSpec {
  readonly id: string;
  readonly group: OperationGroup;
  readonly pt: string;
  readonly en: string;
  readonly ptDescription: string;
  readonly enDescription: string;
  readonly ptKeywords?: readonly string[];
  readonly enKeywords?: readonly string[];
  readonly defaults?: ParamRecord;
  readonly fields?: readonly FieldDefinition[];
  readonly validate?: (params: ParamRecord) => readonly FormatterIssue[];
  readonly transform: OperationTransform;
}

const noIssues = (): readonly FormatterIssue[] => [];
const asText = (text: string, issues?: readonly FormatterIssue[]): TransformResult => ({ text, issues });
const stringParam = (params: ParamRecord, key: string, fallback = ""): string =>
  typeof params[key] === "string" ? params[key] : fallback;
const numberParam = (params: ParamRecord, key: string, fallback = 0): number =>
  typeof params[key] === "number" && Number.isFinite(params[key]) ? params[key] : fallback;
const booleanParam = (params: ParamRecord, key: string, fallback = false): boolean =>
  typeof params[key] === "boolean" ? params[key] : fallback;

const textField = (
  key: string,
  pt: string,
  en: string,
  required = false,
  multiline = false,
): FieldDefinition => ({ type: "text", key, label: localized(pt, en), required, multiline });

const numberField = (
  key: string,
  pt: string,
  en: string,
  min?: number,
  max?: number,
  step = 1,
): FieldDefinition => ({ type: "number", key, label: localized(pt, en), min, max, step });

const toggleField = (key: string, pt: string, en: string): FieldDefinition => ({
  type: "toggle",
  key,
  label: localized(pt, en),
});

const selectField = (
  key: string,
  pt: string,
  en: string,
  options: readonly (readonly [string, string, string])[],
): FieldDefinition => ({
  type: "select",
  key,
  label: localized(pt, en),
  options: options.map(([value, optionPt, optionEn]) => ({ value, label: localized(optionPt, optionEn) })),
});

function validateFields(fields: readonly FieldDefinition[], params: ParamRecord): readonly FormatterIssue[] {
  const issues: FormatterIssue[] = [];
  for (const field of fields) {
    const value = params[field.key];
    if (field.type === "text") {
      if (field.required && (typeof value !== "string" || value.length === 0)) {
        issues.push({ code: "required", severity: "error", field: field.key });
      } else if (value !== undefined && typeof value !== "string") {
        issues.push({ code: "invalid-value", severity: "error", field: field.key });
      }
    } else if (field.type === "number") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      ) {
        issues.push({ code: "invalid-value", severity: "error", field: field.key });
      }
    } else if (field.type === "toggle") {
      if (typeof value !== "boolean") {
        issues.push({ code: "invalid-value", severity: "error", field: field.key });
      }
    } else if (typeof value !== "string" || !field.options.some((option) => option.value === value)) {
      issues.push({ code: "invalid-value", severity: "error", field: field.key });
    }
  }
  return issues;
}

function operation(spec: OperationSpec): RegisteredOperation {
  const fields = spec.fields ?? [];
  const validate = spec.validate ?? noIssues;
  return {
    id: spec.id,
    group: spec.group,
    label: localized(spec.pt, spec.en),
    description: localized(spec.ptDescription, spec.enDescription),
    keywords: localized([spec.pt, ...(spec.ptKeywords ?? [])], [spec.en, ...(spec.enKeywords ?? [])]),
    defaults: spec.defaults ?? {},
    fields,
    validate: (params) => [...validateFields(fields, params), ...validate(params)],
    transform: spec.transform,
  };
}

function requirePositiveInteger(params: ParamRecord, key: string): readonly FormatterIssue[] {
  const value = params[key];
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? []
    : [{ code: "invalid-value", severity: "error", field: key }];
}

function lineCompareValue(line: string, trim: boolean): string {
  return trim ? line.trim() : line;
}

function removeOrKeepLines(
  input: string,
  term: string,
  caseSensitive: boolean,
  keep: boolean,
): string {
  const { lines, ending } = splitLines(input);
  const needle = caseSensitive ? term : term.toLocaleLowerCase();
  return lines
    .filter((line) => {
      const haystack = caseSensitive ? line : line.toLocaleLowerCase();
      return haystack.includes(needle) === keep;
    })
    .join(ending);
}

function transformLinesWithFinalBreak(
  input: string,
  transform: (lines: readonly string[]) => readonly string[],
): string {
  const { lines, ending } = splitLines(input);
  const hasFinalBreak = /(?:\r\n|\r|\n)$/.test(input);
  const content = hasFinalBreak ? lines.slice(0, -1) : lines;
  const transformed = transform(content);
  return transformed.join(ending) + (hasFinalBreak && transformed.length > 0 ? ending : "");
}

const spacingOperations: readonly RegisteredOperation[] = [
  operation({
    id: "removeExtraSpaces",
    group: "spacing",
    pt: "Remover espaços extras",
    en: "Remove extra whitespace",
    ptDescription: "Reduz espaços horizontais e limpa as bordas de cada linha.",
    enDescription: "Collapses horizontal whitespace and trims each line.",
    ptKeywords: ["limpar espaços", "espaço em branco"],
    enKeywords: ["clean whitespace", "trim lines"],
    transform: (input) => asText(input.replace(/[^\S\r\n]+/g, " ").replace(/^ | $/gm, "")),
  }),
  operation({
    id: "collapseSpaces",
    group: "spacing",
    pt: "Transformar múltiplos espaços em um",
    en: "Collapse multiple spaces",
    ptDescription: "Reduz sequências de espaços comuns sem alterar tabs ou quebras.",
    enDescription: "Collapses ordinary spaces without changing tabs or line breaks.",
    ptKeywords: ["juntar espaços", "espaços duplicados"],
    enKeywords: ["duplicate spaces", "single space"],
    transform: (input) => asText(input.replace(/ {2,}/g, " ")),
  }),
  operation({
    id: "trimLineStart",
    group: "spacing",
    pt: "Remover espaços no início das linhas",
    en: "Trim line starts",
    ptDescription: "Remove espaços horizontais no início de cada linha.",
    enDescription: "Removes horizontal whitespace from the start of each line.",
    ptKeywords: ["recuo", "início linha"],
    enKeywords: ["indent", "leading whitespace"],
    transform: (input) => asText(input.replace(/(^|\r\n|\r|\n)[^\S\r\n]+/g, "$1")),
  }),
  operation({
    id: "trimLineEnd",
    group: "spacing",
    pt: "Remover espaços no final das linhas",
    en: "Trim line ends",
    ptDescription: "Remove espaços horizontais no final de cada linha.",
    enDescription: "Removes horizontal whitespace from the end of each line.",
    ptKeywords: ["fim linha", "espaço final"],
    enKeywords: ["trailing whitespace", "line end"],
    transform: (input) => asText(input.replace(/[^\S\r\n]+(?=\r\n|\r|\n|$)/g, "")),
  }),
  operation({
    id: "trim",
    group: "spacing",
    pt: "Trim completo",
    en: "Trim text",
    ptDescription: "Remove espaços Unicode somente nas extremidades do texto.",
    enDescription: "Removes Unicode whitespace only at the outer edges of the text.",
    ptKeywords: ["aparar texto", "bordas"],
    enKeywords: ["outer whitespace", "trim edges"],
    transform: (input) => asText(input.trim()),
  }),
  operation({
    id: "removeTabs",
    group: "spacing",
    pt: "Remover tabs",
    en: "Remove tabs",
    ptDescription: "Remove caracteres de tabulação.",
    enDescription: "Removes tab characters.",
    ptKeywords: ["tabulação"],
    enKeywords: ["tab characters"],
    transform: (input) => asText(input.replace(/\t/g, "")),
  }),
  operation({
    id: "tabsToSpaces",
    group: "spacing",
    pt: "Tabs para espaços",
    en: "Tabs to spaces",
    ptDescription: "Substitui cada tab por uma quantidade configurável de espaços.",
    enDescription: "Replaces every tab with a configurable number of spaces.",
    ptKeywords: ["converter tabulação"],
    enKeywords: ["convert indentation"],
    defaults: { spaces: 4 },
    fields: [numberField("spaces", "Espaços", "Spaces", 1, 8)],
    validate: (params) => requirePositiveInteger(params, "spaces"),
    transform: (input, params) => asText(input.replace(/\t/g, " ".repeat(numberParam(params, "spaces", 4)))),
  }),
  operation({
    id: "removeLineBreaks",
    group: "spacing",
    pt: "Remover quebras de linha",
    en: "Remove line breaks",
    ptDescription: "Troca quebras de linha por espaço ou remove-as por completo.",
    enDescription: "Replaces line breaks with spaces or removes them completely.",
    ptKeywords: ["juntar linhas", "texto em uma linha"],
    enKeywords: ["join lines", "single line"],
    defaults: { replacement: "space" },
    fields: [
      selectField("replacement", "Substituição", "Replacement", [
        ["space", "Espaço", "Space"],
        ["none", "Nada", "Nothing"],
      ]),
    ],
    transform: (input, params) => {
      const replacement = stringParam(params, "replacement", "space");
      const joinsWords = replacement === "none" && new RegExp(`[${WORD_CHARACTER_SOURCE}](?:\\r\\n|\\r|\\n)[${WORD_CHARACTER_SOURCE}]`, "u").test(input);
      return asText(input.replace(/\r\n|\r|\n/g, replacement === "space" ? " " : ""), joinsWords
        ? [{ code: "invalid-value", severity: "warning", field: "replacement" }]
        : undefined);
    },
  }),
  operation({
    id: "normalizeLineBreaks",
    group: "spacing",
    pt: "Normalizar quebras de linha",
    en: "Normalize line endings",
    ptDescription: "Converte todas as quebras para LF ou CRLF.",
    enDescription: "Converts every line ending to LF or CRLF.",
    ptKeywords: ["lf", "crlf", "quebra de linha"],
    enKeywords: ["lf", "crlf", "newline"],
    defaults: { style: "lf" },
    fields: [
      selectField("style", "Estilo", "Style", [
        ["lf", "LF", "LF"],
        ["crlf", "CRLF", "CRLF"],
      ]),
    ],
    transform: (input, params) => asText(normalizeLineEndings(input, stringParam(params, "style", "lf") === "crlf" ? "\r\n" : "\n")),
  }),
  operation({
    id: "removeEmptyLines",
    group: "spacing",
    pt: "Remover linhas vazias",
    en: "Remove empty lines",
    ptDescription: "Remove linhas vazias ou compostas apenas por espaços.",
    enDescription: "Removes empty or whitespace-only lines.",
    ptKeywords: ["linhas em branco"],
    enKeywords: ["blank lines"],
    defaults: { whitespaceOnly: true },
    fields: [toggleField("whitespaceOnly", "Considerar linhas só com espaços", "Include whitespace-only lines")],
    transform: (input, params) => {
      const { lines, ending } = splitLines(input);
      const whitespaceOnly = booleanParam(params, "whitespaceOnly", true);
      return asText(lines.filter((line) => whitespaceOnly ? line.trim().length > 0 : line.length > 0).join(ending));
    },
  }),
  operation({
    id: "limitEmptyLines",
    group: "spacing",
    pt: "Limitar linhas vazias consecutivas",
    en: "Limit consecutive empty lines",
    ptDescription: "Limita a quantidade de linhas vazias consecutivas.",
    enDescription: "Limits the number of consecutive empty lines.",
    ptKeywords: ["linhas em branco", "espaçamento vertical"],
    enKeywords: ["blank lines", "vertical spacing"],
    defaults: { maximum: 1, whitespaceOnly: true },
    fields: [
      numberField("maximum", "Máximo", "Maximum", 0, 10),
      toggleField("whitespaceOnly", "Considerar linhas só com espaços", "Include whitespace-only lines"),
    ],
    validate: (params) => Number.isInteger(params.maximum) ? [] : [{ code: "invalid-value", severity: "error", field: "maximum" }],
    transform: (input, params) => {
      const { lines, ending } = splitLines(input);
      const maximum = numberParam(params, "maximum", 1);
      const whitespaceOnly = booleanParam(params, "whitespaceOnly", true);
      let emptyCount = 0;
      const output: string[] = [];
      for (const line of lines) {
        const empty = whitespaceOnly ? line.trim().length === 0 : line.length === 0;
        if (empty) {
          emptyCount += 1;
          if (emptyCount <= maximum) output.push("");
        } else {
          emptyCount = 0;
          output.push(line);
        }
      }
      return asText(output.join(ending));
    },
  }),
];

const lineOperations: readonly RegisteredOperation[] = [
  operation({
    id: "uniqueLines",
    group: "lines",
    pt: "Remover linhas duplicadas",
    en: "Remove duplicate lines",
    ptDescription: "Mantém uma ocorrência de cada linha em ordem estável.",
    enDescription: "Keeps one occurrence of each line in stable order.",
    ptKeywords: ["linhas únicas", "deduplicar"],
    enKeywords: ["unique lines", "deduplicate"],
    defaults: { caseSensitive: true, trimBeforeCompare: false, keep: "first" },
    fields: [
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
      toggleField("trimBeforeCompare", "Aparar antes de comparar", "Trim before comparing"),
      selectField("keep", "Manter", "Keep", [
        ["first", "Primeira", "First"],
        ["last", "Última", "Last"],
      ]),
    ],
    transform: (input, params) => {
      const { lines, ending } = splitLines(input);
      const caseSensitive = booleanParam(params, "caseSensitive", true);
      const trim = booleanParam(params, "trimBeforeCompare", false);
      const key = (line: string) => {
        const value = lineCompareValue(line, trim);
        return caseSensitive ? value : value.toLocaleLowerCase();
      };
      const keepLast = stringParam(params, "keep", "first") === "last";
      if (keepLast) {
        const lastIndexes = new Map<string, number>();
        lines.forEach((line, index) => lastIndexes.set(key(line), index));
        return asText(lines.filter((line, index) => lastIndexes.get(key(line)) === index).join(ending));
      }
      const seen = new Set<string>();
      return asText(lines.filter((line) => {
        const value = key(line);
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      }).join(ending));
    },
  }),
  ...(["sortLinesAsc", "sortLinesDesc"] as const).map((id) => operation({
    id,
    group: "lines",
    pt: id === "sortLinesAsc" ? "Ordenar linhas A–Z" : "Ordenar linhas Z–A",
    en: id === "sortLinesAsc" ? "Sort lines A–Z" : "Sort lines Z–A",
    ptDescription: id === "sortLinesAsc" ? "Ordena linhas em ordem alfabética crescente." : "Ordena linhas em ordem alfabética decrescente.",
    enDescription: id === "sortLinesAsc" ? "Sorts lines in ascending alphabetical order." : "Sorts lines in descending alphabetical order.",
    ptKeywords: ["ordem alfabética", "classificar linhas"],
    enKeywords: ["alphabetical order", "order lines"],
    defaults: { caseSensitive: false, trimBeforeCompare: true },
    fields: [
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
      toggleField("trimBeforeCompare", "Aparar antes de comparar", "Trim before comparing"),
    ],
    transform: (input, params, context) => asText(transformLinesWithFinalBreak(input, (lines) => {
      const sensitivity = booleanParam(params, "caseSensitive") ? "variant" : "base";
      const trim = booleanParam(params, "trimBeforeCompare", true);
      const collator = new Intl.Collator(context.locale, { sensitivity, numeric: false });
      const direction = id === "sortLinesAsc" ? 1 : -1;
      return stableSort(lines, (left, right) => direction * collator.compare(lineCompareValue(left, trim), lineCompareValue(right, trim)));
    })),
  })),
  operation({
    id: "sortLinesNumeric",
    group: "lines",
    pt: "Ordenar numericamente",
    en: "Sort lines numerically",
    ptDescription: "Ordena linhas numéricas e mantém as demais no final.",
    enDescription: "Sorts numeric lines and leaves all other lines at the end.",
    ptKeywords: ["números", "classificar valores"],
    enKeywords: ["numbers", "sort values"],
    transform: (input, _params, context) => asText(transformLinesWithFinalBreak(input, (lines) => {
      const parse = (line: string): number | undefined => {
        const value = line.trim();
        const source = context.locale === "pt-BR" ? /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/ : /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
        return source.test(value) ? Number(value.replace(",", ".")) : undefined;
      };
      return stableSort(lines, (left, right) => {
        const leftNumber = parse(left);
        const rightNumber = parse(right);
        if (leftNumber === undefined && rightNumber === undefined) return 0;
        if (leftNumber === undefined) return 1;
        if (rightNumber === undefined) return -1;
        return leftNumber - rightNumber;
      });
    })),
  }),
  operation({
    id: "reverseLines",
    group: "lines",
    pt: "Inverter ordem das linhas",
    en: "Reverse line order",
    ptDescription: "Inverte as linhas preservando uma quebra final.",
    enDescription: "Reverses lines while preserving a trailing line break.",
    ptKeywords: ["linhas ao contrário"],
    enKeywords: ["lines backwards"],
    transform: (input) => asText(transformLinesWithFinalBreak(input, (lines) => [...lines].reverse())),
  }),
  ...(["removeLinesContaining", "keepLinesContaining"] as const).map((id) => operation({
    id,
    group: "lines",
    pt: id === "removeLinesContaining" ? "Remover linhas contendo" : "Manter somente linhas contendo",
    en: id === "removeLinesContaining" ? "Remove lines containing" : "Keep only lines containing",
    ptDescription: id === "removeLinesContaining" ? "Remove linhas que contêm o termo informado." : "Mantém apenas linhas que contêm o termo informado.",
    enDescription: id === "removeLinesContaining" ? "Removes lines containing the supplied term." : "Keeps only lines containing the supplied term.",
    ptKeywords: ["filtrar linhas", "termo"],
    enKeywords: ["filter lines", "term"],
    defaults: { term: "", caseSensitive: false },
    fields: [
      textField("term", "Termo", "Term", true),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
    ],
    transform: (input, params) => asText(removeOrKeepLines(
      input,
      stringParam(params, "term"),
      booleanParam(params, "caseSensitive"),
      id === "keepLinesContaining",
    )),
  })),
  operation({
    id: "removeFirstLine",
    group: "lines",
    pt: "Remover primeira linha",
    en: "Remove first line",
    ptDescription: "Remove a primeira linha do texto.",
    enDescription: "Removes the first line of the text.",
    ptKeywords: ["excluir topo"],
    enKeywords: ["delete top line"],
    transform: (input) => {
      if (input.length === 0) return asText(input);
      const match = /\r\n|\r|\n/.exec(input);
      return asText(match ? input.slice(match.index + match[0].length) : "");
    },
  }),
  operation({
    id: "removeLastLine",
    group: "lines",
    pt: "Remover última linha",
    en: "Remove last line",
    ptDescription: "Remove a última linha do texto.",
    enDescription: "Removes the last line of the text.",
    ptKeywords: ["excluir final"],
    enKeywords: ["delete bottom line"],
    transform: (input) => {
      if (input.length === 0) return asText(input);
      const matches = Array.from(input.matchAll(/\r\n|\r|\n/g));
      const last = matches.at(-1);
      if (!last) return asText("");
      if ((last.index ?? 0) + last[0].length === input.length) {
        const previous = matches.at(-2);
        return asText(previous ? input.slice(0, previous.index) : "");
      }
      return asText(input.slice(0, last.index));
    },
  }),
  ...(["addLinePrefix", "addLineSuffix"] as const).map((id) => operation({
    id,
    group: "lines",
    pt: id === "addLinePrefix" ? "Adicionar prefixo nas linhas" : "Adicionar sufixo nas linhas",
    en: id === "addLinePrefix" ? "Add line prefix" : "Add line suffix",
    ptDescription: id === "addLinePrefix" ? "Adiciona texto antes de cada linha." : "Adiciona texto depois de cada linha.",
    enDescription: id === "addLinePrefix" ? "Adds text before every line." : "Adds text after every line.",
    ptKeywords: ["adicionar em cada linha"],
    enKeywords: ["add to every line"],
    defaults: { value: "", skipEmpty: false },
    fields: [textField("value", "Valor", "Value", true), toggleField("skipEmpty", "Ignorar linhas vazias", "Skip empty lines")],
    transform: (input, params) => {
      const { lines, ending } = splitLines(input);
      const value = stringParam(params, "value");
      const skipEmpty = booleanParam(params, "skipEmpty");
      return asText(lines.map((line) => {
        if (skipEmpty && line.length === 0) return line;
        return id === "addLinePrefix" ? value + line : line + value;
      }).join(ending));
    },
  })),
  operation({
    id: "numberLines",
    group: "lines",
    pt: "Numerar linhas",
    en: "Number lines",
    ptDescription: "Adiciona uma sequência numérica configurável às linhas.",
    enDescription: "Adds a configurable numeric sequence to lines.",
    ptKeywords: ["lista numerada", "índice"],
    enKeywords: ["numbered list", "index"],
    defaults: { start: 1, step: 1, separator: ". ", padLength: 0, skipEmpty: false },
    fields: [
      numberField("start", "Início", "Start"),
      numberField("step", "Incremento", "Step"),
      textField("separator", "Separador", "Separator"),
      numberField("padLength", "Casas mínimas", "Minimum digits", 0, 20),
      toggleField("skipEmpty", "Ignorar linhas vazias", "Skip empty lines"),
    ],
    validate: (params) => Number.isInteger(params.padLength) ? [] : [{ code: "invalid-value", severity: "error", field: "padLength" }],
    transform: (input, params) => {
      const { lines, ending } = splitLines(input);
      let current = numberParam(params, "start", 1);
      const step = numberParam(params, "step", 1);
      const separator = stringParam(params, "separator", ". ");
      const padLength = numberParam(params, "padLength", 0);
      const skipEmpty = booleanParam(params, "skipEmpty");
      return asText(lines.map((line) => {
        if (skipEmpty && line.length === 0) return line;
        const sign = current < 0 ? "-" : "";
        const number = `${sign}${String(Math.abs(current)).padStart(padLength, "0")}`;
        current += step;
        return number + separator + line;
      }).join(ending));
    },
  }),
];

function operationWordPattern(term: string): string {
  return `(?<![${WORD_CHARACTER_SOURCE}])${escapeRegExp(term)}(?![${WORD_CHARACTER_SOURCE}])`;
}

function removeMultipleWords(input: string, terms: readonly string[], caseSensitive: boolean): string {
  if (terms.length === 0) return input;
  const alternatives = [...terms]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const expression = new RegExp(
    `(?<![${WORD_CHARACTER_SOURCE}])(?:${alternatives})(?![${WORD_CHARACTER_SOURCE}])`,
    caseSensitive ? "gu" : "giu",
  );
  return input.replace(expression, "");
}

function removeControlCharacters(input: string, preserveTabsAndLineBreaks: boolean): string {
  return Array.from(input).filter((character) => {
    const point = character.codePointAt(0) ?? 0;
    if (preserveTabsAndLineBreaks && (point === 9 || point === 10 || point === 13)) return true;
    return !((point >= 0 && point <= 31) || (point >= 127 && point <= 159));
  }).join("");
}

function consecutiveDuplicateWords(input: string, caseSensitive: boolean, locale: FormatterLocale): string {
  const { words, separators } = wordsAndSeparators(input);
  if (words.length < 2) return input;
  let output = separators[0] ?? "";
  let previous = "";
  words.forEach((word, index) => {
    const comparable = caseSensitive ? word : word.toLocaleLowerCase(locale);
    const separator = separators[index] ?? "";
    const duplicate = index > 0 && comparable === previous && /^[^\S\r\n]+$/.test(separator);
    if (!duplicate) {
      if (index > 0) output += separator;
      output += word;
      previous = comparable;
    }
  });
  output += separators.at(-1) ?? "";
  return output;
}

const wordOperations: readonly RegisteredOperation[] = [
  operation({
    id: "removeWord",
    group: "words",
    pt: "Remover palavra específica",
    en: "Remove a specific word",
    ptDescription: "Remove todas as ocorrências de uma palavra inteira.",
    enDescription: "Removes every whole-word occurrence.",
    ptKeywords: ["excluir palavra", "apagar termo"],
    enKeywords: ["delete word", "erase term"],
    defaults: { word: "", caseSensitive: false },
    fields: [
      textField("word", "Palavra", "Word", true),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
    ],
    transform: (input, params) => asText(input.replace(
      new RegExp(operationWordPattern(stringParam(params, "word")), booleanParam(params, "caseSensitive") ? "gu" : "giu"),
      "",
    )),
  }),
  operation({
    id: "removeWords",
    group: "words",
    pt: "Remover várias palavras",
    en: "Remove multiple words",
    ptDescription: "Remove uma lista de palavras separadas por vírgula ou linha.",
    enDescription: "Removes a list of words separated by commas or lines.",
    ptKeywords: ["lista de palavras", "excluir termos"],
    enKeywords: ["word list", "delete terms"],
    defaults: { words: "", caseSensitive: false },
    fields: [
      textField("words", "Palavras", "Words", true, true),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
    ],
    transform: (input, params, context) => {
      const caseSensitive = booleanParam(params, "caseSensitive");
      const values = stringParam(params, "words").split(/,|\r\n|\r|\n/).map((value) => value.trim()).filter(Boolean);
      const seen = new Set<string>();
      const terms = values.filter((value) => {
        const key = caseSensitive ? value : value.toLocaleLowerCase(context.locale);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return asText(removeMultipleWords(input, terms, caseSensitive));
    },
  }),
  operation({
    id: "replaceWord",
    group: "words",
    pt: "Substituir palavra",
    en: "Replace word",
    ptDescription: "Substitui todas as ocorrências de uma palavra inteira.",
    enDescription: "Replaces every whole-word occurrence.",
    ptKeywords: ["trocar palavra", "localizar e substituir"],
    enKeywords: ["change word", "find and replace"],
    defaults: { find: "", replacement: "", caseSensitive: false },
    fields: [
      textField("find", "Buscar", "Find", true),
      textField("replacement", "Substituir por", "Replace with"),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
    ],
    transform: (input, params) => {
      const result = replaceTextMatches(input, stringParam(params, "find"), stringParam(params, "replacement"), {
        caseSensitive: booleanParam(params, "caseSensitive"),
        wholeWord: true,
        replaceAll: true,
      });
      return { text: result.text, issues: result.issue ? [result.issue] : undefined, analysis: [{ kind: "match-count", count: result.replacements, truncated: result.truncated }] };
    },
  }),
  operation({
    id: "replaceAllOccurrences",
    group: "substrings",
    pt: "Substituir ocorrências",
    en: "Replace occurrences",
    ptDescription: "Localiza e substitui texto literal ou uma expressão regular.",
    enDescription: "Finds and replaces literal text or a regular expression.",
    ptKeywords: ["buscar e substituir", "find replace", "trocar trecho"],
    enKeywords: ["find and replace", "replace all", "change substring"],
    defaults: {
      find: "",
      replacement: "",
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      flags: "gu",
      replaceAll: true,
    },
    fields: [
      textField("find", "Buscar", "Find", true),
      textField("replacement", "Substituir por", "Replace with"),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
      toggleField("wholeWord", "Palavra inteira", "Whole word"),
      toggleField("regex", "Expressão regular", "Regular expression"),
      textField("flags", "Flags", "Flags"),
      toggleField("replaceAll", "Todas as ocorrências", "All occurrences"),
    ],
    validate: (params) => {
      if (!booleanParam(params, "regex")) return [];
      const issue = validateRegexFlags(stringParam(params, "flags", "gu"));
      return issue ? [issue] : [];
    },
    transform: (input, params) => {
      const regex = booleanParam(params, "regex");
      const result = replaceTextMatches(input, stringParam(params, "find"), stringParam(params, "replacement"), {
        caseSensitive: booleanParam(params, "caseSensitive"),
        wholeWord: booleanParam(params, "wholeWord"),
        regex,
        flags: stringParam(params, "flags", "gu"),
        replaceAll: booleanParam(params, "replaceAll", true),
      });
      return {
        text: result.text,
        issues: result.issue ? [result.issue] : undefined,
        analysis: [{ kind: "match-count", count: result.replacements, truncated: result.truncated }],
      };
    },
  }),
  operation({
    id: "removeConsecutiveDuplicateWords",
    group: "words",
    pt: "Remover palavras duplicadas consecutivas",
    en: "Remove consecutive duplicate words",
    ptDescription: "Mantém apenas uma palavra quando repetições são separadas por espaços.",
    enDescription: "Keeps one word when repetitions are separated by horizontal whitespace.",
    ptKeywords: ["palavras repetidas", "duplicatas"],
    enKeywords: ["repeated words", "duplicates"],
    defaults: { caseSensitive: false },
    fields: [toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive")],
    transform: (input, params, context) => asText(consecutiveDuplicateWords(input, booleanParam(params, "caseSensitive"), context.locale)),
  }),
  ...(["removeShortWords", "removeLongWords"] as const).map((id) => operation({
    id,
    group: "words",
    pt: id === "removeShortWords" ? "Remover palavras menores que X" : "Remover palavras maiores que X",
    en: id === "removeShortWords" ? "Remove words shorter than X" : "Remove words longer than X",
    ptDescription: id === "removeShortWords" ? "Remove palavras abaixo do limite de grafemas." : "Remove palavras acima do limite de grafemas.",
    enDescription: id === "removeShortWords" ? "Removes words below the grapheme limit." : "Removes words above the grapheme limit.",
    ptKeywords: ["tamanho da palavra", "comprimento"],
    enKeywords: ["word length", "size"],
    defaults: { length: id === "removeShortWords" ? 3 : 12 },
    fields: [numberField("length", "Comprimento", "Length", 1, 10_000)],
    validate: (params) => requirePositiveInteger(params, "length"),
    transform: (input, params, context) => {
      const limit = numberParam(params, "length", id === "removeShortWords" ? 3 : 12);
      return asText(mapWords(input, (word) => {
        const length = countGraphemes(word, context.locale);
        return id === "removeShortWords" ? (length < limit ? "" : word) : (length > limit ? "" : word);
      }));
    },
  })),
  operation({
    id: "wordFrequency",
    group: "words",
    pt: "Contar frequência das palavras",
    en: "Count word frequency",
    ptDescription: "Analisa frequência sem alterar o texto.",
    enDescription: "Analyzes word frequency without changing the text.",
    ptKeywords: ["contagem de palavras", "estatísticas"],
    enKeywords: ["word count", "statistics"],
    defaults: { caseSensitive: false, minimumLength: 1, sort: "frequency" },
    fields: [
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
      numberField("minimumLength", "Comprimento mínimo", "Minimum length", 1, 10_000),
      selectField("sort", "Ordenar por", "Sort by", [
        ["frequency", "Frequência", "Frequency"],
        ["alphabetical", "Alfabética", "Alphabetical"],
      ]),
    ],
    validate: (params) => requirePositiveInteger(params, "minimumLength"),
    transform: (input, params, context) => {
      const caseSensitive = booleanParam(params, "caseSensitive");
      const minimumLength = numberParam(params, "minimumLength", 1);
      const counts = new Map<string, { word: string; count: number }>();
      for (const word of wordTokens(input, context.locale)) {
        if (countGraphemes(word, context.locale) < minimumLength) continue;
        const key = caseSensitive ? word : word.toLocaleLowerCase(context.locale);
        const current = counts.get(key);
        counts.set(key, { word: current?.word ?? (caseSensitive ? word : key), count: (current?.count ?? 0) + 1 });
      }
      const total = Array.from(counts.values()).reduce((sum, row) => sum + row.count, 0);
      const collator = new Intl.Collator(context.locale, { sensitivity: caseSensitive ? "variant" : "base" });
      const rows = stableSort(Array.from(counts.values()), (left, right) =>
        stringParam(params, "sort", "frequency") === "alphabetical"
          ? collator.compare(left.word, right.word)
          : right.count - left.count || collator.compare(left.word, right.word),
      ).map((row) => ({ ...row, percentage: total === 0 ? 0 : (row.count / total) * 100 }));
      return { text: input, analysis: [{ kind: "word-frequency", total, unique: rows.length, rows }] };
    },
  }),
  operation({
    id: "removeSubstring",
    group: "substrings",
    pt: "Remover trecho",
    en: "Remove substring",
    ptDescription: "Remove todas as ocorrências não sobrepostas de um trecho literal.",
    enDescription: "Removes every non-overlapping occurrence of a literal substring.",
    ptKeywords: ["remover sílaba", "remover silaba", "remover trecho", "remover sequência", "remover sequencia", "remover subtexto"],
    enKeywords: ["remove syllable", "remove substring", "remove sequence", "delete text fragment"],
    defaults: { value: "", caseSensitive: false },
    fields: [
      textField("value", "Trecho", "Substring", true),
      toggleField("caseSensitive", "Diferenciar maiúsculas e minúsculas", "Case sensitive"),
    ],
    transform: (input, params) => {
      const result = replaceTextMatches(input, stringParam(params, "value"), "", {
        caseSensitive: booleanParam(params, "caseSensitive"),
        replaceAll: true,
      });
      return { text: result.text, issues: result.issue ? [result.issue] : undefined };
    },
  }),
  operation({
    id: "regexReplace",
    group: "substrings",
    pt: "Substituição com regex",
    en: "Regex replacement",
    ptDescription: "Substitui texto usando uma expressão regular e grupos de captura.",
    enDescription: "Replaces text using a regular expression and capture groups.",
    ptKeywords: ["expressão regular", "padrão avançado"],
    enKeywords: ["regular expression", "advanced pattern"],
    defaults: { pattern: "", flags: "gu", replacement: "" },
    fields: [
      textField("pattern", "Padrão", "Pattern", true),
      textField("flags", "Flags", "Flags"),
      textField("replacement", "Substituição", "Replacement"),
    ],
    validate: (params) => {
      if (stringParam(params, "pattern").length > 500) return [{ code: "invalid-value", severity: "error", field: "pattern" }];
      const issue = validateRegexFlags(stringParam(params, "flags", "gu"));
      return issue ? [issue] : [];
    },
    transform: (input, params) => {
      const result = replaceTextMatches(input, stringParam(params, "pattern"), stringParam(params, "replacement"), {
        regex: true,
        flags: stringParam(params, "flags", "gu"),
      });
      return {
        text: result.text,
        issues: result.issue ? [result.issue] : undefined,
        analysis: [{ kind: "match-count", count: result.replacements, truncated: result.truncated }],
      };
    },
  }),
];

const emojiExpression = /\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/gu;

const characterOperations: readonly RegisteredOperation[] = [
  operation({
    id: "removeDiacritics",
    group: "characters",
    pt: "Remover acentos",
    en: "Remove diacritics",
    ptDescription: "Remove marcas diacríticas e retorna texto em NFC.",
    enDescription: "Removes diacritic marks and returns NFC text.",
    ptKeywords: ["acentos", "desacentuar"],
    enKeywords: ["accents", "unaccent"],
    transform: (input) => asText(input.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC")),
  }),
  operation({
    id: "removeNumbers",
    group: "characters",
    pt: "Remover números",
    en: "Remove numbers",
    ptDescription: "Remove dígitos e números Unicode.",
    enDescription: "Removes Unicode digits and numbers.",
    ptKeywords: ["excluir dígitos"],
    enKeywords: ["delete digits"],
    transform: (input) => asText(input.replace(/\p{N}/gu, "")),
  }),
  operation({
    id: "keepNumbers",
    group: "characters",
    pt: "Manter somente números",
    en: "Keep numbers only",
    ptDescription: "Mantém números Unicode e espaços opcionais.",
    enDescription: "Keeps Unicode numbers and optional whitespace.",
    ptKeywords: ["extrair dígitos", "só números"],
    enKeywords: ["extract digits", "digits only"],
    defaults: { keepWhitespace: false },
    fields: [toggleField("keepWhitespace", "Manter espaços", "Keep whitespace")],
    transform: (input, params) => asText(input.replace(booleanParam(params, "keepWhitespace") ? /[^\p{N}\s]/gu : /[^\p{N}]/gu, "")),
  }),
  operation({
    id: "removeLetters",
    group: "characters",
    pt: "Remover letras",
    en: "Remove letters",
    ptDescription: "Remove letras Unicode e suas marcas associadas.",
    enDescription: "Removes Unicode letters and their associated marks.",
    ptKeywords: ["excluir alfabeto"],
    enKeywords: ["delete alphabetic"],
    transform: (input) => asText(input.replace(/\p{L}\p{M}*|\p{M}/gu, "")),
  }),
  operation({
    id: "keepLetters",
    group: "characters",
    pt: "Manter somente letras",
    en: "Keep letters only",
    ptDescription: "Mantém letras, marcas Unicode e espaços opcionais.",
    enDescription: "Keeps Unicode letters, marks and optional whitespace.",
    ptKeywords: ["só letras", "alfabeto"],
    enKeywords: ["letters only", "alphabetic"],
    defaults: { keepWhitespace: true },
    fields: [toggleField("keepWhitespace", "Manter espaços", "Keep whitespace")],
    transform: (input, params) => asText(input.replace(booleanParam(params, "keepWhitespace", true) ? /[^\p{L}\p{M}\s]/gu : /[^\p{L}\p{M}]/gu, "")),
  }),
  operation({
    id: "removePunctuation",
    group: "characters",
    pt: "Remover pontuação",
    en: "Remove punctuation",
    ptDescription: "Remove toda pontuação Unicode.",
    enDescription: "Removes all Unicode punctuation.",
    ptKeywords: ["sinais de pontuação"],
    enKeywords: ["punctuation marks"],
    transform: (input) => asText(input.replace(/\p{P}/gu, "")),
  }),
  operation({
    id: "removeSpecialCharacters",
    group: "characters",
    pt: "Remover caracteres especiais",
    en: "Remove special characters",
    ptDescription: "Remove pontuação e símbolos, preservando letras, números e espaços.",
    enDescription: "Removes punctuation and symbols while keeping letters, numbers and whitespace.",
    ptKeywords: ["limpar símbolos"],
    enKeywords: ["clean symbols"],
    transform: (input) => asText(input.replace(/[\p{P}\p{S}]/gu, "")),
  }),
  operation({
    id: "removeEmoji",
    group: "characters",
    pt: "Remover emojis",
    en: "Remove emoji",
    ptDescription: "Remove pictogramas e sequências completas de emoji.",
    enDescription: "Removes pictographs and complete emoji sequences.",
    ptKeywords: ["apagar emoji", "pictogramas"],
    enKeywords: ["delete emoji", "pictographs"],
    transform: (input) => asText(input.replace(emojiExpression, "")),
  }),
  operation({
    id: "removeNonAscii",
    group: "characters",
    pt: "Remover caracteres não ASCII",
    en: "Remove non-ASCII characters",
    ptDescription: "Remove tudo fora do intervalo ASCII básico.",
    enDescription: "Removes everything outside the basic ASCII range.",
    ptKeywords: ["ascii", "caracteres estrangeiros"],
    enKeywords: ["ascii", "foreign characters"],
    transform: (input) => asText(Array.from(input).filter((character) => (character.codePointAt(0) ?? 128) <= 127).join("")),
  }),
  operation({
    id: "removeCharacters",
    group: "characters",
    pt: "Remover caracteres específicos",
    en: "Remove specific characters",
    ptDescription: "Remove um conjunto literal de caracteres informados.",
    enDescription: "Removes a supplied literal set of characters.",
    ptKeywords: ["excluir caracteres", "conjunto"],
    enKeywords: ["delete characters", "character set"],
    defaults: { characters: "" },
    fields: [textField("characters", "Caracteres", "Characters", true)],
    transform: (input, params) => {
      const remove = new Set(Array.from(stringParam(params, "characters")));
      return asText(Array.from(input).filter((character) => !remove.has(character)).join(""));
    },
  }),
];

function capitalizeToken(token: string, locale: FormatterLocale): string {
  const parts = graphemes(token, locale);
  const letterIndex = parts.findIndex((part) => /\p{L}/u.test(part));
  if (letterIndex < 0) return token;
  parts[letterIndex] = parts[letterIndex].toLocaleUpperCase(locale);
  return parts.join("");
}

function separatedCase(input: string, separator: string, locale: FormatterLocale, upper = false): string {
  const words = tokenizeCase(input).map((word) => upper ? word.toLocaleUpperCase(locale) : word.toLocaleLowerCase(locale));
  return words.join(separator);
}

const capitalizationOperations: readonly RegisteredOperation[] = [
  operation({
    id: "uppercase",
    group: "capitalization",
    pt: "MAIÚSCULAS",
    en: "UPPERCASE",
    ptDescription: "Converte todo o texto para maiúsculas respeitando o idioma.",
    enDescription: "Converts all text to uppercase using locale rules.",
    ptKeywords: ["caixa alta"],
    enKeywords: ["upper case"],
    transform: (input, _params, context) => asText(input.toLocaleUpperCase(context.locale)),
  }),
  operation({
    id: "lowercase",
    group: "capitalization",
    pt: "minúsculas",
    en: "lowercase",
    ptDescription: "Converte todo o texto para minúsculas respeitando o idioma.",
    enDescription: "Converts all text to lowercase using locale rules.",
    ptKeywords: ["caixa baixa"],
    enKeywords: ["lower case"],
    transform: (input, _params, context) => asText(input.toLocaleLowerCase(context.locale)),
  }),
  operation({
    id: "capitalizeFirst",
    group: "capitalization",
    pt: "Primeira letra maiúscula",
    en: "Capitalize first letter",
    ptDescription: "Capitaliza a primeira letra Unicode encontrada.",
    enDescription: "Capitalizes the first Unicode letter found.",
    ptKeywords: ["inicial maiúscula"],
    enKeywords: ["uppercase initial"],
    transform: (input, _params, context) => asText(capitalizeToken(input, context.locale)),
  }),
  operation({
    id: "titleCase",
    group: "capitalization",
    pt: "Title Case",
    en: "Title Case",
    ptDescription: "Capitaliza todas as palavras do texto.",
    enDescription: "Capitalizes every word in the text.",
    ptKeywords: ["títulos", "iniciais maiúsculas"],
    enKeywords: ["headings", "capitalized words"],
    defaults: { lowercaseRest: true },
    fields: [toggleField("lowercaseRest", "Converter restante para minúsculas", "Lowercase the rest")],
    transform: (input, params, context) => asText(mapWords(input, (word) => capitalizeToken(
      booleanParam(params, "lowercaseRest", true) ? word.toLocaleLowerCase(context.locale) : word,
      context.locale,
    ))),
  }),
  operation({
    id: "sentenceCase",
    group: "capitalization",
    pt: "Sentence case",
    en: "Sentence case",
    ptDescription: "Capitaliza o início de frases e linhas.",
    enDescription: "Capitalizes the beginning of sentences and lines.",
    ptKeywords: ["frases", "pontuação"],
    enKeywords: ["sentences", "punctuation"],
    defaults: { lowercaseRest: true },
    fields: [toggleField("lowercaseRest", "Converter restante para minúsculas", "Lowercase the rest")],
    transform: (input, params, context) => {
      const source = booleanParam(params, "lowercaseRest", true) ? input.toLocaleLowerCase(context.locale) : input;
      let capitalizeNext = true;
      return asText(graphemes(source, context.locale).map((part) => {
        if (/\p{L}/u.test(part)) {
          const result = capitalizeNext ? part.toLocaleUpperCase(context.locale) : part;
          capitalizeNext = false;
          return result;
        }
        if (/[.!?…\r\n]/u.test(part)) capitalizeNext = true;
        return part;
      }).join(""));
    },
  }),
  operation({
    id: "camelCase",
    group: "capitalization",
    pt: "camelCase",
    en: "camelCase",
    ptDescription: "Converte palavras para camelCase.",
    enDescription: "Converts words to camelCase.",
    ptKeywords: ["identificador javascript"],
    enKeywords: ["javascript identifier"],
    transform: (input, _params, context) => {
      const words = tokenizeCase(input).map((word) => word.toLocaleLowerCase(context.locale));
      return asText(words.map((word, index) => index === 0 ? word : capitalizeToken(word, context.locale)).join(""));
    },
  }),
  operation({
    id: "pascalCase",
    group: "capitalization",
    pt: "PascalCase",
    en: "PascalCase",
    ptDescription: "Converte palavras para PascalCase.",
    enDescription: "Converts words to PascalCase.",
    ptKeywords: ["identificador de classe"],
    enKeywords: ["class identifier"],
    transform: (input, _params, context) => asText(tokenizeCase(input).map((word) => capitalizeToken(word.toLocaleLowerCase(context.locale), context.locale)).join("")),
  }),
  ...([
    ["snakeCase", "snake_case", "snake_case", "_", false],
    ["kebabCase", "kebab-case", "kebab-case", "-", false],
    ["constantCase", "CONSTANT_CASE", "CONSTANT_CASE", "_", true],
    ["dotCase", "dot.case", "dot.case", ".", false],
  ] as const).map(([id, pt, en, separator, upper]) => operation({
    id,
    group: "capitalization",
    pt,
    en,
    ptDescription: `Converte palavras para ${pt}.`,
    enDescription: `Converts words to ${en}.`,
    ptKeywords: ["formato de identificador", "separador"],
    enKeywords: ["identifier format", "separator"],
    transform: (input, _params, context) => asText(separatedCase(input, separator, context.locale, upper)),
  })),
];

const minificationOperations: readonly RegisteredOperation[] = [
  operation({
    id: "minifyText",
    group: "minification",
    pt: "Minificar texto",
    en: "Minify text",
    ptDescription: "Compacta quebras, tabs e espaços conforme as opções.",
    enDescription: "Compacts line breaks, tabs and spaces according to the options.",
    ptKeywords: ["compactar", "reduzir texto", "uma linha"],
    enKeywords: ["compact", "shrink text", "one line"],
    defaults: {
      removeLineBreaks: true,
      removeTabs: true,
      collapseSpaces: true,
      removeSpacesCompletely: false,
      trimResult: true,
    },
    fields: [
      toggleField("removeLineBreaks", "Remover quebras de linha", "Remove line breaks"),
      toggleField("removeTabs", "Remover tabs", "Remove tabs"),
      toggleField("collapseSpaces", "Reduzir espaços", "Collapse spaces"),
      toggleField("removeSpacesCompletely", "Remover espaços completamente", "Remove whitespace completely"),
      toggleField("trimResult", "Aparar resultado", "Trim result"),
    ],
    transform: (input, params) => {
      if (booleanParam(params, "removeSpacesCompletely")) {
        return asText(input.replace(/\s/gu, ""), [{ code: "invalid-value", severity: "warning", field: "removeSpacesCompletely" }]);
      }
      let output = input;
      if (booleanParam(params, "removeLineBreaks", true)) output = output.replace(/\r\n|\r|\n/g, " ");
      if (booleanParam(params, "removeTabs", true)) output = output.replace(/\t/g, " ");
      if (booleanParam(params, "collapseSpaces", true)) output = output.replace(/[^\S\r\n]+/g, " ");
      if (booleanParam(params, "trimResult", true)) output = output.trim();
      return asText(output);
    },
  }),
];

function stripHtml(input: string): string {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(input, "text/html");
    document.querySelectorAll("script, style, template, noscript").forEach((node) => node.remove());
    document.querySelectorAll("br").forEach((node) => node.replaceWith(document.createTextNode("\n")));
    document.querySelectorAll("address, article, aside, blockquote, div, dl, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, nav, ol, p, pre, section, table, tr, ul").forEach((node) => node.append(document.createTextNode("\n")));
    return (document.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
  }
  const withoutUnsafe = input.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return decodeHtmlEntities(withoutUnsafe.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:p|div|li|h[1-6]|blockquote|pre|tr|section|article)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
}

function decodeHtmlEntities(input: string): string {
  const entities: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return input.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const hexadecimal = body[1]?.toLowerCase() === "x";
      const value = Number.parseInt(body.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      try {
        return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
      } catch {
        return entity;
      }
    }
    return entities[body.toLowerCase()] ?? entity;
  });
}

function stripMarkdown(input: string): string {
  let output = input.replace(/```(?:[^\r\n]*)?(?:\r\n|\r|\n)([\s\S]*?)```/g, "$1");
  output = output.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  output = output.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  output = output.replace(/`([^`]+)`/g, "$1");
  output = output.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+\[[ xX]\]\s+|[-+*]\s+|\d+[.)]\s+)/gm, "");
  output = output.replace(/(\*\*|__|~~)(.*?)\1/g, "$2");
  output = output.replace(/(?<!\*)\*([^*\r\n]+)\*(?!\*)|(?<!_)_([^_\r\n]+)_(?!_)/g, "$1$2");
  return output;
}

const URL_SOURCE = String.raw`(?:https?:\/\/|www\.)[^\s<>"']+`;
const EMAIL_SOURCE = String.raw`[\p{L}\p{N}.!#$%&'*+\/=?^_` + "`" + String.raw`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?)+`;
const HASHTAG_SOURCE = String.raw`(?<![\p{L}\p{M}\p{N}_])#[\p{L}\p{M}\p{N}_]+`;
const MENTION_SOURCE = String.raw`(?<![\p{L}\p{M}\p{N}_@])@[\p{L}\p{M}\p{N}_]+`;

function trimUrlPunctuation(value: string): string {
  return value.replace(/[.,!?;:]+$/u, "").replace(/[)\]}]+$/u, (suffix) => {
    const open = (value.match(/[([{]/g) ?? []).length;
    const close = (value.match(/[)\]}]/g) ?? []).length;
    return close > open ? suffix.slice(1) : suffix;
  });
}

function replaceUrls(input: string, replacement: string): string {
  return input.replace(new RegExp(URL_SOURCE, "giu"), (value) => {
    const trimmed = trimUrlPunctuation(value);
    return replacement + value.slice(trimmed.length);
  });
}

const cleanupOperations: readonly RegisteredOperation[] = [
  operation({
    id: "stripHtml",
    group: "cleanup",
    pt: "Remover HTML mantendo texto",
    en: "Remove HTML while keeping text",
    ptDescription: "Remove marcação e conteúdo inseguro, preservando somente texto.",
    enDescription: "Removes markup and unsafe content while preserving plain text.",
    ptKeywords: ["limpar html", "texto puro", "tags"],
    enKeywords: ["clean html", "plain text", "tags"],
    transform: (input) => asText(stripHtml(input)),
  }),
  operation({
    id: "stripMarkdown",
    group: "cleanup",
    pt: "Remover Markdown básico",
    en: "Remove basic Markdown",
    ptDescription: "Remove marcadores Markdown preservando o conteúdo.",
    enDescription: "Removes Markdown markers while preserving content.",
    ptKeywords: ["limpar markdown", "texto puro"],
    enKeywords: ["clean markdown", "plain text"],
    transform: (input) => asText(stripMarkdown(input)),
  }),
  operation({
    id: "removeUrls",
    group: "cleanup",
    pt: "Remover URLs",
    en: "Remove URLs",
    ptDescription: "Remove endereços HTTP, HTTPS e www sem consumir pontuação final.",
    enDescription: "Removes HTTP, HTTPS and www addresses without consuming trailing punctuation.",
    ptKeywords: ["apagar links", "endereços web"],
    enKeywords: ["delete links", "web addresses"],
    transform: (input) => asText(replaceUrls(input, "")),
  }),
  operation({
    id: "removeEmails",
    group: "cleanup",
    pt: "Remover emails",
    en: "Remove email addresses",
    ptDescription: "Remove endereços de email com uma correspondência conservadora.",
    enDescription: "Removes email addresses using conservative matching.",
    ptKeywords: ["apagar email", "correio eletrônico"],
    enKeywords: ["delete email", "mail addresses"],
    transform: (input) => asText(input.replace(new RegExp(EMAIL_SOURCE, "giu"), "")),
  }),
  ...([
    ["removeHashtags", "Remover hashtags", "Remove hashtags", HASHTAG_SOURCE],
    ["removeMentions", "Remover @mentions", "Remove @mentions", MENTION_SOURCE],
  ] as const).map(([id, pt, en, source]) => operation({
    id,
    group: "cleanup",
    pt,
    en,
    ptDescription: id === "removeHashtags" ? "Remove hashtags Unicode." : "Remove menções Unicode iniciadas por @.",
    enDescription: id === "removeHashtags" ? "Removes Unicode hashtags." : "Removes Unicode @mentions.",
    ptKeywords: id === "removeHashtags" ? ["apagar hashtag", "cerquilha"] : ["apagar menção", "arroba"],
    enKeywords: id === "removeHashtags" ? ["delete hashtag", "hash"] : ["delete mention", "at sign"],
    transform: (input) => asText(input.replace(new RegExp(source, "gu"), "")),
  })),
  operation({
    id: "removeInvisibleCharacters",
    group: "cleanup",
    pt: "Remover caracteres invisíveis",
    en: "Remove invisible characters",
    ptDescription: "Remove zero-width, controles bidi, soft hyphen e controles ocultos.",
    enDescription: "Removes zero-width, bidi controls, soft hyphens and hidden controls.",
    ptKeywords: ["zero width", "caracteres ocultos"],
    enKeywords: ["zero width", "hidden characters"],
    defaults: { preserveTabsAndLineBreaks: true },
    fields: [toggleField("preserveTabsAndLineBreaks", "Preservar tabs e quebras", "Preserve tabs and line breaks")],
    transform: (input, params) => {
      const invisible = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;
      let output = input.replace(invisible, "");
      output = removeControlCharacters(output, booleanParam(params, "preserveTabsAndLineBreaks", true));
      return asText(output);
    },
  }),
  operation({
    id: "normalizeUnicode",
    group: "cleanup",
    pt: "Normalizar Unicode",
    en: "Normalize Unicode",
    ptDescription: "Normaliza o texto em NFC, NFD, NFKC ou NFKD.",
    enDescription: "Normalizes text as NFC, NFD, NFKC or NFKD.",
    ptKeywords: ["unicode", "normalização"],
    enKeywords: ["unicode", "normalization"],
    defaults: { form: "NFC" },
    fields: [selectField("form", "Forma", "Form", [
      ["NFC", "NFC", "NFC"],
      ["NFD", "NFD", "NFD"],
      ["NFKC", "NFKC", "NFKC"],
      ["NFKD", "NFKD", "NFKD"],
    ])],
    transform: (input, params) => asText(input.normalize(stringParam(params, "form", "NFC") as "NFC" | "NFD" | "NFKC" | "NFKD")),
  }),
];

function extractMatches(input: string, source: string, flags = "gu", unique = false): string {
  const expression = new RegExp(source, flags.includes("g") ? flags : flags + "g");
  const values: string[] = [];
  const seen = new Set<string>();
  for (const match of input.matchAll(expression)) {
    const value = match[0];
    if (!unique || !seen.has(value)) {
      values.push(value);
      seen.add(value);
    }
  }
  return values.join("\n");
}

const otherOperations: readonly RegisteredOperation[] = [
  operation({
    id: "reverseText",
    group: "other",
    pt: "Inverter texto",
    en: "Reverse text",
    ptDescription: "Inverte o texto por grafemas completos.",
    enDescription: "Reverses text by complete grapheme clusters.",
    ptKeywords: ["texto ao contrário", "espelhar"],
    enKeywords: ["text backwards", "mirror"],
    transform: (input, _params, context) => asText(graphemes(input, context.locale).reverse().join("")),
  }),
  operation({
    id: "reverseWords",
    group: "other",
    pt: "Inverter palavras",
    en: "Reverse words",
    ptDescription: "Inverte a ordem das palavras preservando separadores.",
    enDescription: "Reverses word order while preserving separators.",
    ptKeywords: ["palavras ao contrário", "ordem inversa"],
    enKeywords: ["words backwards", "inverse order"],
    transform: (input) => {
      const { words, separators } = wordsAndSeparators(input);
      return asText(joinWordsAndSeparators([...words].reverse(), separators));
    },
  }),
  operation({
    id: "reverseEachWord",
    group: "other",
    pt: "Inverter cada palavra",
    en: "Reverse each word",
    ptDescription: "Inverte grafemas dentro de cada palavra.",
    enDescription: "Reverses graphemes within every word.",
    ptKeywords: ["cada palavra ao contrário"],
    enKeywords: ["every word backwards"],
    transform: (input, _params, context) => asText(mapWords(input, (word) => graphemes(word, context.locale).reverse().join(""))),
  }),
  operation({
    id: "shuffleLines",
    group: "other",
    pt: "Embaralhar linhas",
    en: "Shuffle lines",
    ptDescription: "Embaralha linhas de forma determinística usando uma seed.",
    enDescription: "Deterministically shuffles lines using a seed.",
    ptKeywords: ["linhas aleatórias", "misturar linhas"],
    enKeywords: ["random lines", "mix lines"],
    defaults: { seed: "tweakit" },
    fields: [textField("seed", "Seed", "Seed", true)],
    transform: (input, params) => asText(transformLinesWithFinalBreak(input, (lines) => seededShuffle(lines, stringParam(params, "seed", "tweakit")))),
  }),
  operation({
    id: "shuffleWords",
    group: "other",
    pt: "Embaralhar palavras",
    en: "Shuffle words",
    ptDescription: "Embaralha palavras preservando separadores e usando uma seed.",
    enDescription: "Shuffles words while preserving separators and using a seed.",
    ptKeywords: ["palavras aleatórias", "misturar palavras"],
    enKeywords: ["random words", "mix words"],
    defaults: { seed: "tweakit" },
    fields: [textField("seed", "Seed", "Seed", true)],
    transform: (input, params) => {
      const { words, separators } = wordsAndSeparators(input);
      return asText(joinWordsAndSeparators(seededShuffle(words, stringParam(params, "seed", "tweakit")), separators));
    },
  }),
  operation({
    id: "extractUrls",
    group: "other",
    pt: "Extrair URLs",
    en: "Extract URLs",
    ptDescription: "Extrai uma URL por linha.",
    enDescription: "Extracts one URL per line.",
    ptKeywords: ["listar links", "capturar urls"],
    enKeywords: ["list links", "capture urls"],
    defaults: { unique: false },
    fields: [toggleField("unique", "Somente únicas", "Unique only")],
    transform: (input, params) => {
      const matches = Array.from(input.matchAll(new RegExp(URL_SOURCE, "giu"))).map((match) => trimUrlPunctuation(match[0]));
      const values = booleanParam(params, "unique") ? Array.from(new Set(matches)) : matches;
      return asText(values.join("\n"));
    },
  }),
  operation({
    id: "extractEmails",
    group: "other",
    pt: "Extrair emails",
    en: "Extract email addresses",
    ptDescription: "Extrai um endereço de email por linha.",
    enDescription: "Extracts one email address per line.",
    ptKeywords: ["listar emails", "capturar emails"],
    enKeywords: ["list emails", "capture emails"],
    defaults: { unique: false },
    fields: [toggleField("unique", "Somente únicos", "Unique only")],
    transform: (input, params) => asText(extractMatches(input, EMAIL_SOURCE, "giu", booleanParam(params, "unique"))),
  }),
  operation({
    id: "extractNumbers",
    group: "other",
    pt: "Extrair números",
    en: "Extract numbers",
    ptDescription: "Extrai inteiros e decimais com sinal.",
    enDescription: "Extracts signed integers and decimal numbers.",
    ptKeywords: ["listar números", "capturar valores"],
    enKeywords: ["list numbers", "capture values"],
    defaults: { unique: false },
    fields: [toggleField("unique", "Somente únicos", "Unique only")],
    transform: (input, params) => asText(extractMatches(input, String.raw`(?<![\p{L}\p{N}])[+-]?(?:\p{N}+(?:[.,]\p{N}+)?|[.,]\p{N}+)(?![\p{L}\p{N}])`, "gu", booleanParam(params, "unique"))),
  }),
  operation({
    id: "extractHashtags",
    group: "other",
    pt: "Extrair hashtags",
    en: "Extract hashtags",
    ptDescription: "Extrai uma hashtag por linha.",
    enDescription: "Extracts one hashtag per line.",
    ptKeywords: ["listar hashtags", "capturar hashtags"],
    enKeywords: ["list hashtags", "capture hashtags"],
    defaults: { unique: false },
    fields: [toggleField("unique", "Somente únicas", "Unique only")],
    transform: (input, params) => asText(extractMatches(input, HASHTAG_SOURCE, "gu", booleanParam(params, "unique"))),
  }),
  operation({
    id: "extractMentions",
    group: "other",
    pt: "Extrair mentions",
    en: "Extract mentions",
    ptDescription: "Extrai uma menção por linha.",
    enDescription: "Extracts one mention per line.",
    ptKeywords: ["listar menções", "capturar arrobas"],
    enKeywords: ["list mentions", "capture handles"],
    defaults: { unique: false },
    fields: [toggleField("unique", "Somente únicas", "Unique only")],
    transform: (input, params) => asText(extractMatches(input, MENTION_SOURCE, "gu", booleanParam(params, "unique"))),
  }),
  operation({
    id: "slugify",
    group: "other",
    pt: "Gerar slug",
    en: "Generate slug",
    ptDescription: "Cria um slug minúsculo com separador configurável.",
    enDescription: "Creates a lowercase slug using a configurable separator.",
    ptKeywords: ["url amigável", "texto para url", "permalink"],
    enKeywords: ["friendly url", "text to url", "permalink"],
    defaults: { separator: "-", preserveUnicode: true },
    fields: [
      textField("separator", "Separador", "Separator", true),
      toggleField("preserveUnicode", "Manter letras Unicode", "Preserve Unicode letters"),
    ],
    transform: (input, params, context) => {
      const separator = stringParam(params, "separator", "-");
      const preserveUnicode = booleanParam(params, "preserveUnicode", true);
      let output = input.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(context.locale);
      output = preserveUnicode ? output.replace(/[^\p{L}\p{N}]+/gu, separator) : output.replace(/[^a-z0-9]+/g, separator);
      const escaped = escapeRegExp(separator);
      output = output.replace(new RegExp(`(?:${escaped}){2,}`, "g"), separator).replace(new RegExp(`^(?:${escaped})|(?:${escaped})$`, "g"), "");
      return asText(output.normalize("NFC"));
    },
  }),
];

export const operationList: readonly RegisteredOperation[] = [
  ...spacingOperations,
  ...lineOperations,
  ...wordOperations,
  ...characterOperations,
  ...capitalizationOperations,
  ...minificationOperations,
  ...cleanupOperations,
  ...otherOperations,
];

export const operationRegistry: Readonly<Record<string, RegisteredOperation>> = Object.freeze(
  Object.fromEntries(operationList.map((definition) => [definition.id, definition])),
);

export function getOperationDefinition(operationId: string): RegisteredOperation | undefined {
  return operationRegistry[operationId];
}
