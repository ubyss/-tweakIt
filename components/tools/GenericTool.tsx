"use client";

import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Calculator,
  Eye,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useApp } from "@/app/providers";
import {
  ClearButton,
  CopyButton,
  DownloadButton,
  ToolStats,
} from "@/components/tool/ToolActions";
import type { Locale, ToolDefinition } from "@/lib/catalog";
import { isPotentiallyUnsafeRegex } from "@/lib/text-formatter/text-utils";
import {
  executeTool,
  unitOptions,
  type ToolExecution,
  type ToolOptions,
} from "@/lib/tools/operations";

type LocalText = Readonly<{ pt: string; en: string }>;
type InputKind = "none" | "single" | "textarea";
type ControlKind = "checkbox" | "number" | "select" | "text";

type Choice = Readonly<{
  value: string;
  label: LocalText | string;
}>;

type ControlDefinition = Readonly<{
  name: string;
  kind: ControlKind;
  label: LocalText;
  choices?: readonly Choice[];
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: LocalText | string;
  wide?: boolean;
}>;

type SecondaryDefinition = Readonly<{
  label: LocalText;
  placeholder: LocalText | string;
  kind: "number" | "password" | "text" | "textarea";
}>;

type ToolSpecification = Readonly<{
  inputKind: InputKind;
  inputType?: "number" | "password" | "text";
  inputLabel: LocalText;
  inputPlaceholder: LocalText | string;
  initialInput: string;
  initialSecondary: string;
  options: ToolOptions;
  controls: readonly ControlDefinition[];
  modes: readonly Choice[];
}>;

const t = (pt: string, en: string): LocalText => ({ pt, en });

const uiByLocale = {
  "pt-BR": {
    mode: "Modo",
    options: "Opções",
    input: "Entrada",
    result: "Resultado",
    secondary: "Entrada adicional",
    typeOrPaste: "Digite ou cole o conteúdo aqui…",
    resultPlaceholder: "O resultado aparecerá aqui.",
    processing: "Processando…",
    processError: "Não foi possível processar este conteúdo.",
    run: "Executar",
    generate: "Gerar",
    calculate: "Calcular",
    convert: "Converter",
    validate: "Validar",
    format: "Formatar",
    minify: "Minificar",
    encode: "Codificar",
    decode: "Decodificar",
    test: "Testar expressão",
    preview: "Atualizar prévia",
    analyze: "Analisar",
    search: "Buscar",
    transform: "Transformar",
    swapUnits: "Trocar unidades",
    markdownPreview: "Prévia renderizada",
    replacementPreview: "Prévia da substituição",
    matches: "Correspondências",
    noMatches: "Nenhuma correspondência encontrada.",
    matchCount: (count: number) => count === 1 ? "1 correspondência" : `${count} correspondências`,
    rowsLimited: (count: number) => `Exibindo as primeiras ${count} linhas. O arquivo completo continua disponível para copiar ou baixar.`,
    column: (number: number) => `Coluna ${number}`,
    sortAscending: "Ordenar em ordem crescente",
    sortDescending: "Ordenar em ordem decrescente",
    table: "Resultado em tabela",
    colorPreview: "Prévia da cor",
    cronSummary: "Resumo",
    nextRuns: "Próximas execuções",
    timezone: "Fuso horário",
    invalidCron: "A expressão cron é inválida.",
    invalidRegex: "A expressão regular é inválida.",
    regexRequired: "Informe uma expressão regular.",
    tooManyMatches: "A lista foi limitada a 1.000 correspondências.",
    useCtrlEnter: "Pressione Ctrl + Enter para executar",
    rawResult: "Resultado em texto",
  },
  en: {
    mode: "Mode",
    options: "Options",
    input: "Input",
    result: "Result",
    secondary: "Additional input",
    typeOrPaste: "Type or paste content here…",
    resultPlaceholder: "The result will appear here.",
    processing: "Processing…",
    processError: "This content could not be processed.",
    run: "Run",
    generate: "Generate",
    calculate: "Calculate",
    convert: "Convert",
    validate: "Validate",
    format: "Format",
    minify: "Minify",
    encode: "Encode",
    decode: "Decode",
    test: "Test expression",
    preview: "Update preview",
    analyze: "Analyze",
    search: "Search",
    transform: "Transform",
    swapUnits: "Swap units",
    markdownPreview: "Rendered preview",
    replacementPreview: "Replacement preview",
    matches: "Matches",
    noMatches: "No matches found.",
    matchCount: (count: number) => count === 1 ? "1 match" : `${count} matches`,
    rowsLimited: (count: number) => `Showing the first ${count} rows. The complete file remains available to copy or download.`,
    column: (number: number) => `Column ${number}`,
    sortAscending: "Sort ascending",
    sortDescending: "Sort descending",
    table: "Table result",
    colorPreview: "Color preview",
    cronSummary: "Summary",
    nextRuns: "Next runs",
    timezone: "Time zone",
    invalidCron: "The cron expression is invalid.",
    invalidRegex: "The regular expression is invalid.",
    regexRequired: "Enter a regular expression.",
    tooManyMatches: "The list was limited to 1,000 matches.",
    useCtrlEnter: "Press Ctrl + Enter to run",
    rawResult: "Text result",
  },
} as const;

const labels = {
  value: t("Valor", "Value"),
  text: t("Texto", "Text"),
  message: t("Mensagem", "Message"),
  password: t("Senha", "Password"),
  username: t("Usuário", "Username"),
  secret: t("Chave secreta", "Secret key"),
  originalJson: t("JSON original", "Original JSON"),
  comparisonJson: t("JSON para comparar", "JSON to compare"),
  baseUrl: t("URL base", "Base URL"),
  queryParameters: t("Parâmetros, um por linha", "Parameters, one per line"),
  title: t("Título", "Title"),
  description: t("Descrição", "Description"),
  firstValue: t("Primeiro valor", "First value"),
  secondValue: t("Segundo valor", "Second value"),
  newValue: t("Novo valor", "New value"),
  originalValue: t("Valor original", "Original value"),
  pattern: t("Expressão regular", "Regular expression"),
  flags: t("Flags", "Flags"),
  replacement: t("Substituição", "Replacement"),
  count: t("Quantidade", "Count"),
  length: t("Tamanho", "Length"),
  alphabet: t("Alfabeto", "Alphabet"),
  algorithm: t("Algoritmo", "Algorithm"),
  lowercase: t("Letras minúsculas", "Lowercase letters"),
  uppercase: t("Letras maiúsculas", "Uppercase letters"),
  numbers: t("Números", "Numbers"),
  symbols: t("Símbolos", "Symbols"),
  from: t("De", "From"),
  to: t("Para", "To"),
  indentation: t("Indentação", "Indentation"),
  delimiter: t("Delimitador", "Delimiter"),
  firstRowHeader: t("Primeira linha é cabeçalho", "First row is a header"),
  serviceName: t("Nome do serviço", "Service name"),
  percentage: t("Porcentagem", "Percentage"),
  minimum: t("Mínimo", "Minimum"),
  maximum: t("Máximo", "Maximum"),
  integersOnly: t("Somente inteiros", "Integers only"),
  separator: t("Separador", "Separator"),
  caseSensitive: t("Diferenciar maiúsculas e minúsculas", "Case sensitive"),
  trimLines: t("Ignorar espaços nas extremidades", "Ignore surrounding whitespace"),
  find: t("Localizar", "Find"),
  wholeWord: t("Somente palavra inteira", "Whole word only"),
  regularExpression: t("Usar expressão regular", "Use regular expression"),
  replaceAll: t("Substituir todas", "Replace all"),
  canonicalUrl: t("URL canônica", "Canonical URL"),
  socialImage: t("URL da imagem social", "Social image URL"),
  nextRunCount: t("Execuções futuras", "Future runs"),
} as const;

const modeLabels: Readonly<Record<string, LocalText>> = {
  encode: t("Codificar", "Encode"),
  decode: t("Decodificar", "Decode"),
  format: t("Formatar", "Format"),
  minify: t("Minificar", "Minify"),
  compress: t("Comprimir", "Compress"),
  expand: t("Expandir", "Expand"),
  hex: t("Hexadecimal", "Hexadecimal"),
  base64url: t("Base64URL", "Base64URL"),
  upper: t("MAIÚSCULAS", "UPPERCASE"),
  lower: t("minúsculas", "lowercase"),
  title: t("Iniciais Maiúsculas", "Title Case"),
  sentence: t("Frase", "Sentence case"),
  camel: t("camelCase", "camelCase"),
  pascal: t("PascalCase", "PascalCase"),
  snake: t("snake_case", "snake_case"),
  kebab: t("kebab-case", "kebab-case"),
  constant: t("CONSTANT_CASE", "CONSTANT_CASE"),
  dot: t("dot.case", "dot.case"),
  asc: t("A–Z", "A–Z"),
  desc: t("Z–A", "Z–A"),
  numeric: t("Numérica", "Numeric"),
  reverse: t("Inverter linhas", "Reverse lines"),
  html: t("HTML", "HTML"),
  markdown: t("Markdown", "Markdown"),
  percentage: t("X% de um valor", "X% of a value"),
  of: t("Descobrir o total", "Find the total"),
  change: t("Variação percentual", "Percentage change"),
};

const placeholders: Readonly<Record<string, LocalText | string>> = {
  base64: t("Digite um texto ou cole Base64…", "Type text or paste Base64…"),
  "url-encoder": "https://toolsy.app/busca?q=ferramentas úteis",
  "html-entities": "<section aria-label=\"Toolsy\">Texto & conteúdo</section>",
  "number-base-converter": t("Ex.: 255 ou FF", "E.g. 255 or FF"),
  "text-binary-converter": t("Texto ou bytes como 01010100 01101111…", "Text or bytes such as 01010100 01101111…"),
  "unix-timestamp-converter": t("Timestamp ou data, ex.: 1735689600", "Timestamp or date, e.g. 1735689600"),
  "date-time-converter": t("Data ISO, local ou deixe vazio para agora", "ISO/local date, or leave blank for now"),
  "color-converter": "#6366F1 ou rgb(99, 102, 241)",
  "roman-numeral-converter": t("Ex.: 2026 ou MMXXVI", "E.g. 2026 or MMXXVI"),
  "hash-generator": t("Texto do qual calcular o hash…", "Text to hash…"),
  "hmac-generator": t("Mensagem que será assinada…", "Message to sign…"),
  "password-strength-analyzer": t("Digite uma senha para analisar…", "Enter a password to analyze…"),
  "json-formatter": "{\n  \"tool\": \"Toolsy\"\n}",
  "json-minifier": "{ \"tool\": \"Toolsy\", \"ready\": true }",
  "json-validator": t("Cole um documento JSON…", "Paste a JSON document…"),
  "json-to-yaml": t("Cole um documento JSON…", "Paste a JSON document…"),
  "json-to-xml": t("Cole um documento JSON…", "Paste a JSON document…"),
  "json-to-csv": "[{ \"name\": \"Toolsy\", \"ready\": true }]",
  "yaml-to-json": "tool: Toolsy\nready: true",
  "xml-to-json": "<tool><name>Toolsy</name><ready>true</ready></tool>",
  "csv-table-viewer": "name,status\nToolsy,ready",
  "json-diff": t("Cole o primeiro documento JSON…", "Paste the first JSON document…"),
  "regex-tester": t("Texto usado para testar a expressão…", "Text used to test the expression…"),
  "cron-expression-parser": "*/15 * * * *",
  "html-formatter": "<main><h1>Toolsy</h1><p>Ready</p></main>",
  "css-formatter": ".toolsy{display:grid;gap:1rem;color:#6366f1}",
  "javascript-formatter": "const tool = { name: \"Toolsy\", ready: true };",
  "sql-formatter": "select id, name from tools where active = true order by name;",
  "xml-formatter": "<tools><tool id=\"1\">Toolsy</tool></tools>",
  "yaml-formatter": "tool: Toolsy\nfeatures:\n  - private\n  - fast",
  "markdown-preview": "# Toolsy\n\nFerramentas rápidas, privadas e úteis.",
  "chmod-calculator": t("Ex.: 755 ou u=rwx,g=rx,o=rx", "E.g. 755 or u=rwx,g=rx,o=rx"),
  "docker-run-to-compose": "docker run --name toolsy -p 3000:3000 -e NODE_ENV=production toolsy:latest",
  "math-evaluator": "(12 + 8) * 3 ^ 2",
  "average-calculator": t("Números separados por vírgulas, espaços ou linhas…", "Numbers separated by commas, spaces, or lines…"),
  "cidr-calculator": "192.168.1.10/24",
  "ipv4-converter": t("IPv4, inteiro, hexadecimal ou binário…", "IPv4, integer, hexadecimal, or binary…"),
  "ipv4-range-expander": "192.168.1.1 - 192.168.1.20 ou 192.168.1.0/28",
  "ipv6-compressor": "2001:0db8:0000:0000:0000:ff00:0042:8329",
  "case-converter": t("Digite o texto que deseja converter…", "Type the text you want to convert…"),
  "slug-generator": t("Título da página ou publicação…", "Page or post title…"),
  "line-sorter": t("Uma linha por item…", "One item per line…"),
  "duplicate-line-remover": t("Uma linha por item…", "One item per line…"),
  "text-statistics": t("Digite ou cole o texto que deseja analisar…", "Type or paste the text you want to analyze…"),
  "find-and-replace": t("Digite ou cole o texto em que deseja buscar…", "Type or paste the text you want to search…"),
  "unicode-inspector": t("Digite caracteres, símbolos ou emojis…", "Type characters, symbols, or emoji…"),
  "remove-markup": t("Cole HTML ou Markdown…", "Paste HTML or Markdown…"),
  "url-parser": "https://user@example.com:8080/path?q=toolsy#result",
  "url-query-editor": "https://example.com/search?old=value",
  "jwt-decoder": t("Cole um JSON Web Token…", "Paste a JSON Web Token…"),
  "basic-auth-generator": t("Nome de usuário", "Username"),
  "meta-tag-generator": t("Título da página", "Page title"),
  "user-agent-parser": t("Cole um User-Agent ou deixe vazio para usar o atual…", "Paste a User-Agent or leave blank to use the current one…"),
  "http-status-reference": t("Busque por código ou nome, ex.: 404", "Search by code or name, e.g. 404"),
  "mime-type-lookup": t("Busque por extensão ou MIME, ex.: .json", "Search by extension or MIME, e.g. .json"),
};

const noInputTools = new Set([
  "uuid-generator",
  "ulid-generator",
  "nano-id-generator",
  "password-generator",
  "random-token-generator",
  "random-number-generator",
  "mac-address-generator",
  "random-port-generator",
  "lorem-ipsum-generator",
]);

const singleInputTools = new Set([
  "number-base-converter",
  "unix-timestamp-converter",
  "date-time-converter",
  "color-converter",
  "roman-numeral-converter",
  "password-strength-analyzer",
  "cron-expression-parser",
  "chmod-calculator",
  "math-evaluator",
  "percentage-calculator",
  "ratio-calculator",
  "duration-calculator",
  "length-converter",
  "weight-converter",
  "temperature-converter",
  "area-converter",
  "volume-converter",
  "speed-converter",
  "data-size-converter",
  "cidr-calculator",
  "ipv4-converter",
  "ipv4-range-expander",
  "ipv6-compressor",
  "slug-generator",
  "url-parser",
  "basic-auth-generator",
  "meta-tag-generator",
  "http-status-reference",
  "mime-type-lookup",
]);

const numericInputTools = new Set([
  "percentage-calculator",
  "ratio-calculator",
  "duration-calculator",
  "length-converter",
  "weight-converter",
  "temperature-converter",
  "area-converter",
  "volume-converter",
  "speed-converter",
  "data-size-converter",
]);

function localize(locale: Locale, value: LocalText | string): string {
  if (typeof value === "string") return value;
  return locale === "pt-BR" ? value.pt : value.en;
}

function titleFromValue(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, character => character.toLocaleUpperCase());
}

function choice(value: string, label: LocalText | string = titleFromValue(value)): Choice {
  return { value, label };
}

function numberControl(
  name: string,
  label: LocalText,
  min: number,
  max: number,
  step: number | "any" = 1,
): ControlDefinition {
  return { name, kind: "number", label, min, max, step };
}

function textControl(
  name: string,
  label: LocalText,
  placeholder: LocalText | string = "",
  wide = false,
): ControlDefinition {
  return { name, kind: "text", label, placeholder, wide };
}

function checkboxControl(name: string, label: LocalText): ControlDefinition {
  return { name, kind: "checkbox", label };
}

function selectControl(
  name: string,
  label: LocalText,
  choices: readonly Choice[],
): ControlDefinition {
  return { name, kind: "select", label, choices };
}

function stringList(tool: ToolDefinition, key: string): string[] {
  const value = tool.config?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberList(tool: ToolDefinition, key: string): number[] {
  const value = tool.config?.[key];
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

function buildSpecification(tool: ToolDefinition): ToolSpecification {
  const options: ToolOptions = {};
  const controls: ControlDefinition[] = [];
  let modes = stringList(tool, "modes");
  let initialInput = "";
  let initialSecondary = "";
  let inputLabel = labels.text;
  let inputType: ToolSpecification["inputType"] = "text";

  if (modes.length) options.mode = modes[0];

  if (tool.id === "number-base-converter") {
    const bases = numberList(tool, "bases");
    const baseChoices = (bases.length ? bases : [2, 8, 10, 16]).map(base => choice(String(base), base === 2 ? t("2 — Binário", "2 — Binary") : base === 8 ? t("8 — Octal", "8 — Octal") : base === 10 ? t("10 — Decimal", "10 — Decimal") : t("16 — Hexadecimal", "16 — Hexadecimal")));
    options.from = "10";
    options.to = "16";
    controls.push(selectControl("from", labels.from, baseChoices), selectControl("to", labels.to, baseChoices));
    inputLabel = labels.value;
  }

  if (tool.id === "hash-generator" || tool.id === "hmac-generator") {
    const algorithms = stringList(tool, "algorithms");
    options.algorithm = algorithms[0] ?? "SHA-256";
    controls.push(selectControl("algorithm", labels.algorithm, algorithms.map(item => choice(item, item))));
    inputLabel = tool.id === "hmac-generator" ? labels.message : labels.text;
  }

  if (["uuid-generator", "ulid-generator"].includes(tool.id)) {
    options.count = 5;
    controls.push(numberControl("count", labels.count, 1, 100));
  }

  if (tool.id === "nano-id-generator") {
    options.count = 5;
    options.length = 21;
    options.alphabet = "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    controls.push(
      numberControl("count", labels.count, 1, 100),
      numberControl("length", labels.length, 1, 256),
      textControl("alphabet", labels.alphabet, t("Ao menos dois caracteres", "At least two characters"), true),
    );
  }

  if (tool.id === "password-generator") {
    options.count = 5;
    options.length = 20;
    options.lower = true;
    options.upper = true;
    options.numbers = true;
    options.symbols = true;
    controls.push(
      numberControl("count", labels.count, 1, 100),
      numberControl("length", labels.length, 4, 256),
      checkboxControl("lower", labels.lowercase),
      checkboxControl("upper", labels.uppercase),
      checkboxControl("numbers", labels.numbers),
      checkboxControl("symbols", labels.symbols),
    );
  }

  if (tool.id === "random-token-generator") {
    const encodings = stringList(tool, "encodings");
    modes = encodings.length ? encodings : ["hex", "base64url"];
    options.mode = modes[0];
    options.length = 32;
    controls.push(numberControl("length", t("Tamanho em bytes", "Length in bytes"), 1, 65536));
  }

  if (tool.id === "json-formatter" || tool.id === "yaml-formatter") {
    options.indent = 2;
    controls.push(selectControl("indent", labels.indentation, [choice("2", "2"), choice("4", "4")]));
  }

  if (tool.id === "csv-table-viewer") {
    options.delimiter = ",";
    options.firstRowHeader = true;
    controls.push(
      selectControl("delimiter", labels.delimiter, [
        choice(",", t("Vírgula (,)", "Comma (,)")),
        choice(";", t("Ponto e vírgula (;)", "Semicolon (;)")),
        choice("\t", t("Tabulação", "Tab")),
        choice("|", t("Barra vertical (|)", "Vertical bar (|)")),
      ]),
      checkboxControl("firstRowHeader", labels.firstRowHeader),
    );
  }

  if (tool.id === "regex-tester") {
    options.pattern = "\\b[A-Z][a-z]+\\b";
    options.flags = "gu";
    options.replacement = "";
    controls.push(
      textControl("pattern", labels.pattern, t("Ex.: \\b[A-Z][a-z]+\\b", "E.g. \\b[A-Z][a-z]+\\b"), true),
      textControl("flags", labels.flags, "gimuy", false),
      textControl("replacement", labels.replacement, t("Opcional; use $1 para grupos", "Optional; use $1 for groups"), true),
    );
  }

  if (tool.id === "cron-expression-parser") {
    options.count = 5;
    controls.push(numberControl("count", labels.nextRunCount, 1, 10));
    initialInput = "*/15 * * * *";
    inputLabel = t("Expressão cron", "Cron expression");
  }

  if (tool.id === "docker-run-to-compose") {
    options.service = "app";
    controls.push(textControl("service", labels.serviceName, "app"));
  }

  if (tool.id === "percentage-calculator") {
    modes = ["percentage", "of", "change"];
    options.mode = "percentage";
    options.percentage = 10;
    controls.push(numberControl("percentage", labels.percentage, -1000000, 1000000, "any"));
    initialInput = "100";
    inputLabel = labels.value;
  }

  if (tool.id === "random-number-generator") {
    options.min = 1;
    options.max = 100;
    options.count = 10;
    options.integer = true;
    controls.push(
      numberControl("min", labels.minimum, -1000000000000, 1000000000000, "any"),
      numberControl("max", labels.maximum, -1000000000000, 1000000000000, "any"),
      numberControl("count", labels.count, 1, 1000),
      checkboxControl("integer", labels.integersOnly),
    );
  }

  if (tool.id === "ratio-calculator") {
    initialInput = "16";
    initialSecondary = "9";
    inputLabel = labels.firstValue;
  }

  if (tool.id === "duration-calculator") {
    const units = unitOptions("duration");
    options.from = "h";
    controls.push(selectControl("from", labels.from, units.map(item => choice(item, item))));
    initialInput = "1";
    inputLabel = t("Duração", "Duration");
  }

  const unitGroup = tool.id.endsWith("-converter")
    ? tool.id.replace(/-converter$/, "")
    : "";
  if (["length", "weight", "temperature", "area", "volume", "speed", "data-size"].includes(unitGroup)) {
    const units = unitOptions(unitGroup);
    const preferred: Readonly<Record<string, readonly [string, string]>> = {
      length: ["m", "km"],
      weight: ["kg", "lb"],
      temperature: [units[0] ?? "", units[1] ?? ""],
      area: [units[0] ?? "", "ha"],
      volume: ["l", "gal"],
      speed: ["km/h", "mph"],
      "data-size": ["MB", "MiB"],
    };
    const [from, to] = preferred[unitGroup] ?? [units[0] ?? "", units[1] ?? units[0] ?? ""];
    options.from = units.includes(from) ? from : units[0] ?? "";
    options.to = units.includes(to) ? to : units[1] ?? units[0] ?? "";
    controls.push(
      selectControl("from", labels.from, units.map(item => choice(item, item))),
      selectControl("to", labels.to, units.map(item => choice(item, item))),
    );
    initialInput = "1";
    inputLabel = labels.value;
  }

  if (tool.id === "mac-address-generator") {
    options.count = 5;
    options.separator = ":";
    controls.push(
      numberControl("count", labels.count, 1, 100),
      selectControl("separator", labels.separator, [choice(":", t("Dois-pontos", "Colon")), choice("-", t("Hífen", "Hyphen")), choice("", t("Sem separador", "No separator"))]),
    );
  }

  if (tool.id === "random-port-generator") {
    options.count = 5;
    controls.push(numberControl("count", labels.count, 1, 100));
  }

  if (tool.id === "case-converter") {
    modes = ["upper", "lower", "title", "sentence", "camel", "pascal", "snake", "kebab", "constant", "dot"];
    options.mode = "camel";
  }

  if (tool.id === "slug-generator") {
    options.separator = "-";
    controls.push(selectControl("separator", labels.separator, [choice("-", t("Hífen (-)", "Hyphen (-)")), choice("_", t("Sublinhado (_)", "Underscore (_)") )]));
  }

  if (tool.id === "line-sorter") {
    modes = ["asc", "desc", "numeric", "reverse"];
    options.mode = "asc";
    options.caseSensitive = false;
    controls.push(checkboxControl("caseSensitive", labels.caseSensitive));
  }

  if (tool.id === "duplicate-line-remover") {
    options.trim = true;
    options.caseSensitive = false;
    controls.push(checkboxControl("trim", labels.trimLines), checkboxControl("caseSensitive", labels.caseSensitive));
  }

  if (tool.id === "lorem-ipsum-generator") {
    options.count = 3;
    controls.push(numberControl("count", t("Parágrafos", "Paragraphs"), 1, 100));
  }

  if (tool.id === "find-and-replace") {
    options.find = "";
    options.replacement = "";
    options.caseSensitive = false;
    options.wholeWord = false;
    options.regex = false;
    options.replaceAll = true;
    controls.push(
      textControl("find", labels.find, t("Texto ou padrão…", "Text or pattern…"), true),
      textControl("replacement", labels.replacement, t("Novo texto…", "New text…"), true),
      checkboxControl("caseSensitive", labels.caseSensitive),
      checkboxControl("wholeWord", labels.wholeWord),
      checkboxControl("regex", labels.regularExpression),
      checkboxControl("replaceAll", labels.replaceAll),
    );
  }

  if (tool.id === "meta-tag-generator") {
    options.url = "https://example.com";
    options.image = "";
    controls.push(
      textControl("url", labels.canonicalUrl, "https://example.com", true),
      textControl("image", labels.socialImage, "https://example.com/social.jpg", true),
    );
    inputLabel = labels.title;
  }

  if (tool.id === "basic-auth-generator") inputLabel = labels.username;
  if (tool.id === "json-diff") inputLabel = labels.originalJson;
  if (tool.id === "url-query-editor") inputLabel = labels.baseUrl;
  if (tool.id === "password-strength-analyzer") {
    inputLabel = labels.password;
    inputType = "password";
  }
  if (numericInputTools.has(tool.id)) inputType = "number";
  if (tool.id === "ipv6-compressor") {
    modes = stringList(tool, "modes");
    options.mode = modes[0] ?? "compress";
  }
  if (tool.id === "remove-markup") {
    modes = stringList(tool, "modes");
    options.mode = modes[0] ?? "html";
  }

  const normalizedModes = modes.map(value => choice(value, modeLabels[value] ?? titleFromValue(value)));
  const inputKind: InputKind = noInputTools.has(tool.id) ? "none" : singleInputTools.has(tool.id) ? "single" : "textarea";
  return {
    inputKind,
    inputType,
    inputLabel,
    inputPlaceholder: placeholders[tool.id] ?? t("Digite ou cole o conteúdo aqui…", "Type or paste content here…"),
    initialInput,
    initialSecondary,
    options,
    controls,
    modes: normalizedModes,
  };
}

function getSecondaryDefinition(toolId: string, mode: string): SecondaryDefinition | null {
  if (toolId === "hmac-generator") return { label: labels.secret, placeholder: t("Chave usada na assinatura", "Key used for signing"), kind: "password" };
  if (toolId === "json-diff") return { label: labels.comparisonJson, placeholder: t("Cole o segundo documento JSON…", "Paste the second JSON document…"), kind: "textarea" };
  if (toolId === "url-query-editor") return { label: labels.queryParameters, placeholder: "utm_source=toolsy\nutm_medium=web", kind: "textarea" };
  if (toolId === "basic-auth-generator") return { label: labels.password, placeholder: t("Senha", "Password"), kind: "password" };
  if (toolId === "meta-tag-generator") return { label: labels.description, placeholder: t("Descrição curta para mecanismos de busca e redes sociais", "Short description for search engines and social networks"), kind: "textarea" };
  if (toolId === "ratio-calculator") return { label: labels.secondValue, placeholder: "9", kind: "number" };
  if (toolId === "percentage-calculator" && mode === "change") return { label: labels.originalValue, placeholder: "80", kind: "number" };
  return null;
}

function getInputLabel(toolId: string, mode: string, fallback: LocalText): LocalText {
  if (toolId !== "percentage-calculator") return fallback;
  if (mode === "change") return labels.newValue;
  if (mode === "of") return t("Parte conhecida", "Known portion");
  return t("Valor base", "Base value");
}

function getActionLabel(
  tool: ToolDefinition,
  mode: string,
  ui: (typeof uiByLocale)[Locale],
): string {
  if (tool.id === "regex-tester") return ui.test;
  if (tool.id === "markdown-preview") return ui.preview;
  if (tool.kind === "reference") return ui.search;
  if (tool.kind === "generator") return ui.generate;
  if (tool.kind === "calculator") return ui.calculate;
  if (tool.kind === "validator") return ui.validate;
  if (tool.kind === "parser" || tool.kind === "inspector") return ui.analyze;
  if (tool.kind === "text-transform") return ui.transform;
  if (mode === "encode") return ui.encode;
  if (mode === "decode") return ui.decode;
  if (mode === "minify") return ui.minify;
  if (tool.kind === "formatter") return ui.format;
  if (tool.kind === "converter" || tool.kind === "codec") return ui.convert;
  return ui.run;
}

function getActionIcon(tool: ToolDefinition): ReactNode {
  if (tool.kind === "generator") return <Sparkles size={16} />;
  if (tool.kind === "calculator") return <Calculator size={16} />;
  if (tool.kind === "reference") return <Search size={16} />;
  if (tool.id === "markdown-preview") return <Eye size={16} />;
  return <Play size={16} />;
}

function getDownloadExtension(toolId: string): string {
  if (toolId === "json-to-csv" || toolId === "csv-table-viewer") return "csv";
  if (["yaml-to-json", "xml-to-json", "json-diff", "json-formatter"].includes(toolId)) return "json";
  if (["json-to-yaml", "yaml-formatter", "docker-run-to-compose"].includes(toolId)) return "yaml";
  if (["json-to-xml", "xml-formatter"].includes(toolId)) return "xml";
  if (["html-formatter", "meta-tag-generator"].includes(toolId)) return "html";
  if (toolId === "css-formatter") return "css";
  if (toolId === "javascript-formatter") return "js";
  if (toolId === "sql-formatter") return "sql";
  if (toolId === "markdown-preview") return "md";
  return "txt";
}

function localizeOperationMessage(message: string | undefined, locale: Locale, toolId: string, status: ToolExecution["status"]): string {
  if (!message) return "";
  if (locale === "en") return message;
  if (toolId === "json-validator" && status === "success") return "JSON válido";
  const replacements: readonly [RegExp, string][] = [
    [/Invalid date/i, "Data inválida"],
    [/Invalid Roman numeral/i, "Número romano inválido"],
    [/Use an integer from 1 to 3999/i, "Use um número inteiro de 1 a 3999"],
    [/Use HEX or RGB/i, "Use uma cor em HEX ou RGB"],
    [/Invalid XML/i, "XML inválido"],
    [/JSON must contain an array/i, "O JSON deve conter um array"],
    [/Enter valid numbers/i, "Digite números válidos"],
    [/Enter two valid values/i, "Digite dois valores válidos"],
    [/Maximum must be larger than minimum/i, "O máximo deve ser maior que o mínimo"],
    [/Invalid IPv4 address/i, "Endereço IPv4 inválido"],
    [/Invalid IPv4 integer/i, "Inteiro IPv4 inválido"],
    [/Invalid CIDR prefix/i, "Prefixo CIDR inválido"],
    [/Invalid IPv6 address/i, "Endereço IPv6 inválido"],
    [/Invalid expression/i, "Expressão inválida"],
    [/Mismatched parentheses/i, "Parênteses não correspondentes"],
    [/Invalid result/i, "Resultado inválido"],
    [/Invalid length or alphabet/i, "Tamanho ou alfabeto inválido"],
    [/A JWT must have three parts/i, "Um JWT deve ter três partes"],
    [/Unsupported unit/i, "Unidade não compatível"],
    [/Processing error/i, "Erro de processamento"],
  ];
  return replacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), message);
}

function referenceRows(toolId: string, output: string, locale: Locale): readonly (readonly string[])[] | undefined {
  const lines = output.split(/\r\n?|\n/u).filter(Boolean);
  if (toolId === "http-status-reference") {
    const header = locale === "pt-BR" ? ["Código", "Status"] : ["Code", "Status"];
    return [header, ...lines.map(line => {
      const match = line.match(/^(\d{3})\s+[^\p{L}\p{N}]+\s*(.+)$/u);
      return match ? [match[1], match[2]] : [line, ""];
    })];
  }
  if (toolId === "mime-type-lookup") {
    const header = locale === "pt-BR" ? ["Extensão", "Tipo MIME"] : ["Extension", "MIME type"];
    return [header, ...lines.map(line => {
      const [extension, ...mime] = line.split("\t");
      return [extension, mime.join("\t")];
    })];
  }
  return undefined;
}

function normalizeRows(
  toolId: string,
  rows: ToolExecution["rows"],
  locale: Locale,
): readonly (readonly string[])[] | undefined {
  if (!rows) return undefined;
  if (toolId !== "unicode-inspector" || !rows.length) return rows;
  const header = locale === "pt-BR"
    ? ["Caractere", "Ponto de código", "Decimal", "UTF-8"]
    : ["Character", "Code point", "Decimal", "UTF-8"];
  return [header, ...rows.slice(1)];
}

type RegexResult = Readonly<{
  execution: ToolExecution;
  rows: readonly (readonly string[])[];
}>;

function executeRegex(
  input: string,
  options: ToolOptions,
  locale: Locale,
): RegexResult {
  const ui = uiByLocale[locale];
  const pattern = String(options.pattern ?? "");
  const flags = String(options.flags ?? "").trim();
  const replacement = String(options.replacement ?? "");
  if (!pattern) return { execution: { output: "", status: "error", message: ui.regexRequired }, rows: [] };
  if (pattern.length > 500 || input.length > 250000 || isPotentiallyUnsafeRegex(pattern)) {
    return { execution: { output: "", status: "error", message: locale === "pt-BR" ? "A expressÃ£o pode ser lenta ou o texto Ã© grande demais para uma execuÃ§Ã£o segura." : "The expression may be slow or the text is too large for safe execution." }, rows: [] };
  }
  try {
    const regex = new RegExp(pattern, flags);
    const scanner = new RegExp(pattern, flags);
    const rows: string[][] = [[
      locale === "pt-BR" ? "Correspondência" : "Match",
      locale === "pt-BR" ? "Índice" : "Index",
      locale === "pt-BR" ? "Grupos" : "Groups",
    ]];
    let match: RegExpExecArray | null;
    let limited = false;
    while ((match = scanner.exec(input)) !== null) {
      const named = match.groups && Object.keys(match.groups).length ? ` ${JSON.stringify(match.groups)}` : "";
      rows.push([match[0], String(match.index), `${match.slice(1).map(value => value ?? "").join(" · ")}${named}`.trim()]);
      if (rows.length > 1000) {
        limited = true;
        break;
      }
      if (match[0] === "") scanner.lastIndex += 1;
      if (!scanner.global && !scanner.sticky) break;
    }
    const count = rows.length - 1;
    return {
      execution: {
        output: input.replace(regex, replacement),
        status: "success",
        message: limited ? `${ui.matchCount(count)}. ${ui.tooManyMatches}` : ui.matchCount(count),
      },
      rows,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    return {
      execution: { output: "", status: "error", message: detail ? `${ui.invalidRegex} ${detail}` : ui.invalidRegex },
      rows: [],
    };
  }
}

const cronAliases: Readonly<Record<string, string>> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const monthNames: Readonly<Record<string, number>> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const weekDayNames: Readonly<Record<string, number>> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function cronField(
  expression: string,
  minimum: number,
  maximum: number,
  names: Readonly<Record<string, number>> = {},
  weekDay = false,
): Set<number> {
  const result = new Set<number>();
  for (const rawPart of expression.split(",")) {
    const [base, stepText] = rawPart.split("/");
    if (!base || rawPart.split("/").length > 2) throw new Error("field");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error("field");
    let start: number;
    let end: number;
    if (base === "*") {
      start = minimum;
      end = maximum;
    } else if (base.includes("-")) {
      const [startText, endText, ...extra] = base.split("-");
      if (!startText || !endText || extra.length) throw new Error("field");
      const rawStart = names[startText.toLocaleUpperCase()] ?? Number(startText);
      const rawEnd = names[endText.toLocaleUpperCase()] ?? Number(endText);
      const acceptedMaximum = weekDay ? 7 : maximum;
      if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd) || rawStart < minimum || rawEnd > acceptedMaximum || rawStart > rawEnd) throw new Error("field");
      start = rawStart;
      end = rawEnd;
    } else {
      const rawStart = names[base.toLocaleUpperCase()] ?? Number(base);
      const acceptedMaximum = weekDay ? 7 : maximum;
      if (!Number.isInteger(rawStart) || rawStart < minimum || rawStart > acceptedMaximum) throw new Error("field");
      start = rawStart;
      end = stepText === undefined ? rawStart : maximum;
    }
    for (let value = start; value <= end; value += step) result.add(weekDay && value === 7 ? 0 : value);
  }
  if (!result.size) throw new Error("field");
  return result;
}

function describeCronField(raw: string, unit: LocalText, locale: Locale): string {
  const localizedUnit = localize(locale, unit);
  if (raw === "*") return locale === "pt-BR" ? `a cada ${localizedUnit}` : `every ${localizedUnit}`;
  const step = raw.match(/^\*\/(\d+)$/);
  if (step) return locale === "pt-BR" ? `a cada ${step[1]} ${localizedUnit}(s)` : `every ${step[1]} ${localizedUnit}s`;
  return locale === "pt-BR" ? `${localizedUnit}: ${raw}` : `${localizedUnit}: ${raw}`;
}

function executeCron(input: string, count: number, locale: Locale): ToolExecution {
  const ui = uiByLocale[locale];
  try {
    const trimmed = input.trim().toLocaleLowerCase();
    const expression = cronAliases[trimmed] ?? input.trim();
    const parts = expression.split(/\s+/u);
    if (parts.length !== 5) throw new Error("parts");
    const [minuteRaw, hourRaw, dayRaw, monthRaw, weekDayRaw] = parts;
    const minutes = cronField(minuteRaw, 0, 59);
    const hours = cronField(hourRaw, 0, 23);
    const days = cronField(dayRaw, 1, 31);
    const months = cronField(monthRaw, 1, 12, monthNames);
    const weekDays = cronField(weekDayRaw, 0, 6, weekDayNames, true);
    const dayRestricted = dayRaw !== "*";
    const weekDayRestricted = weekDayRaw !== "*";
    const dates: Date[] = [];
    const cursor = new Date();
    cursor.setSeconds(0, 0);
    cursor.setMinutes(cursor.getMinutes() + 1);
    const maximumChecks = 366 * 24 * 60 * 5;
    for (let checks = 0; checks < maximumChecks && dates.length < count; checks += 1) {
      const dayMatches = days.has(cursor.getDate());
      const weekDayMatches = weekDays.has(cursor.getDay());
      const calendarDayMatches = dayRestricted && weekDayRestricted
        ? dayMatches || weekDayMatches
        : dayMatches && weekDayMatches;
      if (
        minutes.has(cursor.getMinutes()) &&
        hours.has(cursor.getHours()) &&
        months.has(cursor.getMonth() + 1) &&
        calendarDayMatches
      ) dates.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    const fieldSummary = [
      describeCronField(minuteRaw, t("minuto", "minute"), locale),
      describeCronField(hourRaw, t("hora", "hour"), locale),
      describeCronField(dayRaw, t("dia do mês", "day of month"), locale),
      describeCronField(monthRaw, t("mês", "month"), locale),
      describeCronField(weekDayRaw, t("dia da semana", "weekday"), locale),
    ].join("; ");
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" });
    const dateLines = dates.map((date, index) => `${index + 1}. ${formatter.format(date)} — ${date.toISOString()}`);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      output: [
        `${ui.cronSummary}: ${fieldSummary}`,
        `${ui.timezone}: ${timezone}`,
        "",
        `${ui.nextRuns}:`,
        ...dateLines,
      ].join("\n"),
      status: "success",
      message: expression === input.trim() ? expression : `${input.trim()} → ${expression}`,
    };
  } catch {
    return { output: "", status: "error", message: `${ui.invalidCron} ${locale === "pt-BR" ? "Use cinco campos: minuto hora dia mês dia-da-semana." : "Use five fields: minute hour day month weekday."}` };
  }
}

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  if (/^(?:https?:|mailto:)/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  return null;
}

function inlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^\s)]+(?:\s+"[^"]*")?\))/gu;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(value.slice(cursor, start));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("`")) nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("**") || token.startsWith("__")) nodes.push(<strong key={key}>{inlineMarkdown(token.slice(2, -2), key)}</strong>);
    else if (token.startsWith("~~")) nodes.push(<del key={key}>{inlineMarkdown(token.slice(2, -2), key)}</del>);
    else if (token.startsWith("[") ) {
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) {
        const external = /^https?:/i.test(href);
        nodes.push(<a key={key} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined}>{inlineMarkdown(link[1], key)}</a>);
      } else nodes.push(token);
    } else nodes.push(<em key={key}>{inlineMarkdown(token.slice(1, -1), key)}</em>);
    cursor = start + token.length;
    index += 1;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function splitMarkdownRow(value: string): string[] {
  return value.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
}

function isMarkdownBlockStart(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return /^\s*(?:#{1,6}\s+|```|>|[-+*]\s+|\d+[.)]\s+|(?:-{3,}|\*{3,}|_{3,})\s*$)/u.test(line) || (line.includes("|") && /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/u.test(next));
}

function MarkdownPreview({ source, label }: { source: string; label: string }) {
  const blocks = useMemo(() => {
    const lines = source.replace(/\r\n?/gu, "\n").split("\n");
    const nodes: ReactNode[] = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      const fence = line.match(/^\s*```([^\s`]*)\s*$/u);
      if (fence) {
        const code: string[] = [];
        index += 1;
        while (index < lines.length && !/^\s*```\s*$/u.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        nodes.push(<pre key={`code-${index}`}><code data-language={fence[1] || undefined}>{code.join("\n")}</code></pre>);
        continue;
      }
      const heading = line.match(/^(#{1,6})\s+(.+)$/u);
      if (heading) {
        const content = inlineMarkdown(heading[2], `heading-${index}`);
        const level = heading[1].length;
        if (level === 1) nodes.push(<h1 key={`heading-${index}`}>{content}</h1>);
        else if (level === 2) nodes.push(<h2 key={`heading-${index}`}>{content}</h2>);
        else if (level === 3) nodes.push(<h3 key={`heading-${index}`}>{content}</h3>);
        else if (level === 4) nodes.push(<h4 key={`heading-${index}`}>{content}</h4>);
        else if (level === 5) nodes.push(<h5 key={`heading-${index}`}>{content}</h5>);
        else nodes.push(<h6 key={`heading-${index}`}>{content}</h6>);
        index += 1;
        continue;
      }
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line)) {
        nodes.push(<hr key={`rule-${index}`} />);
        index += 1;
        continue;
      }
      if (/^\s*>/u.test(line)) {
        const quote: string[] = [];
        const start = index;
        while (index < lines.length && /^\s*>/u.test(lines[index])) {
          quote.push(lines[index].replace(/^\s*>\s?/u, ""));
          index += 1;
        }
        nodes.push(<blockquote key={`quote-${start}`}>{quote.map((item, quoteIndex) => <Fragment key={`quote-${start}-${quoteIndex}`}>{inlineMarkdown(item, `quote-${start}-${quoteIndex}`)}{quoteIndex < quote.length - 1 && <br />}</Fragment>)}</blockquote>);
        continue;
      }
      const unordered = line.match(/^\s*[-+*]\s+(.+)$/u);
      if (unordered) {
        const items: string[] = [];
        const start = index;
        while (index < lines.length) {
          const item = lines[index].match(/^\s*[-+*]\s+(.+)$/u);
          if (!item) break;
          items.push(item[1]);
          index += 1;
        }
        nodes.push(<ul key={`list-${start}`}>{items.map((item, itemIndex) => {
          const task = item.match(/^\[([ xX])\]\s+(.+)$/);
          return <li key={`list-${start}-${itemIndex}`}>{task ? <label><input type="checkbox" checked={task[1].toLocaleLowerCase() === "x"} readOnly />{inlineMarkdown(task[2], `task-${start}-${itemIndex}`)}</label> : inlineMarkdown(item, `list-${start}-${itemIndex}`)}</li>;
        })}</ul>);
        continue;
      }
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/u);
      if (ordered) {
        const items: string[] = [];
        const start = index;
        while (index < lines.length) {
          const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/u);
          if (!item) break;
          items.push(item[1]);
          index += 1;
        }
        nodes.push(<ol key={`ordered-${start}`}>{items.map((item, itemIndex) => <li key={`ordered-${start}-${itemIndex}`}>{inlineMarkdown(item, `ordered-${start}-${itemIndex}`)}</li>)}</ol>);
        continue;
      }
      if (line.includes("|") && /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/u.test(lines[index + 1] ?? "")) {
        const start = index;
        const headers = splitMarkdownRow(line);
        index += 2;
        const rows: string[][] = [];
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          rows.push(splitMarkdownRow(lines[index]));
          index += 1;
        }
        nodes.push(
          <div className="generic-tool-markdown-table-wrap" key={`table-${start}`}>
            <table><thead><tr>{headers.map((header, headerIndex) => <th key={`table-${start}-h-${headerIndex}`}>{inlineMarkdown(header, `table-${start}-h-${headerIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`table-${start}-r-${rowIndex}`}>{headers.map((_, cellIndex) => <td key={`table-${start}-r-${rowIndex}-c-${cellIndex}`}>{inlineMarkdown(row[cellIndex] ?? "", `table-${start}-r-${rowIndex}-c-${cellIndex}`)}</td>)}</tr>)}</tbody></table>
          </div>,
        );
        continue;
      }
      const paragraph: string[] = [line];
      const start = index;
      index += 1;
      while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines, index)) {
        paragraph.push(lines[index]);
        index += 1;
      }
      nodes.push(<p key={`paragraph-${start}`}>{paragraph.map((item, paragraphIndex) => <Fragment key={`paragraph-${start}-${paragraphIndex}`}>{inlineMarkdown(item, `paragraph-${start}-${paragraphIndex}`)}{paragraphIndex < paragraph.length - 1 && <br />}</Fragment>)}</p>);
    }
    return nodes;
  }, [source]);
  return <article className="generic-tool-markdown-preview" aria-label={label}>{blocks}</article>;
}

function ResultTable({
  rows,
  locale,
  caption,
  sortable,
  firstRowHeader,
}: {
  rows: readonly (readonly string[])[];
  locale: Locale;
  caption: string;
  sortable: boolean;
  firstRowHeader: boolean;
}) {
  const ui = uiByLocale[locale];
  const [sort, setSort] = useState<Readonly<{ column: number; direction: "asc" | "desc" }> | null>(null);
  const columnCount = Math.max(0, ...rows.map(row => row.length));
  const headers = firstRowHeader
    ? Array.from({ length: columnCount }, (_, index) => rows[0]?.[index] ?? ui.column(index + 1))
    : Array.from({ length: columnCount }, (_, index) => ui.column(index + 1));
  const body = firstRowHeader ? rows.slice(1) : rows;
  const sortedRows = useMemo(() => {
    if (!sort) return body;
    return body.map((row, index) => ({ row, index })).sort((left, right) => {
      const comparison = String(left.row[sort.column] ?? "").localeCompare(String(right.row[sort.column] ?? ""), locale, { numeric: true, sensitivity: "base" });
      return (comparison || left.index - right.index) * (sort.direction === "asc" ? 1 : -1);
    }).map(item => item.row);
  }, [body, locale, sort]);
  const visibleRows = sortedRows.slice(0, 500);
  const updateSort = (column: number) => {
    setSort(current => current?.column === column ? { column, direction: current.direction === "asc" ? "desc" : "asc" } : { column, direction: "asc" });
  };
  if (!rows.length || !columnCount) return null;
  return (
    <div className="generic-tool-result-table-wrap">
      <table className="generic-tool-result-table">
        <caption>{caption}</caption>
        <thead><tr>{headers.map((header, index) => {
          const direction = sort?.column === index ? sort.direction : null;
          return (
            <th key={`header-${index}`} aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : "none"}>
              {sortable ? <button type="button" onClick={() => updateSort(index)} title={direction === "asc" ? ui.sortDescending : ui.sortAscending}>{header}{direction === "asc" ? <ArrowUp size={13} /> : direction === "desc" ? <ArrowDown size={13} /> : null}</button> : header}
            </th>
          );
        })}</tr></thead>
        <tbody>{visibleRows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{headers.map((_, columnIndex) => <td key={`cell-${rowIndex}-${columnIndex}`}>{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody>
      </table>
      {sortedRows.length > visibleRows.length && <p className="generic-tool-table-limit">{ui.rowsLimited(visibleRows.length)}</p>}
    </div>
  );
}

function GenericToolWorkspace({ tool }: { tool: ToolDefinition }) {
  const { locale } = useApp();
  const ui = uiByLocale[locale];
  const specification = useMemo(() => buildSpecification(tool), [tool]);
  const [input, setInput] = useState(specification.initialInput);
  const [secondary, setSecondary] = useState(specification.initialSecondary);
  const [options, setOptions] = useState<ToolOptions>(specification.options);
  const [execution, setExecution] = useState<ToolExecution>({ output: "" });
  const [rows, setRows] = useState<readonly (readonly string[])[]>([]);
  const [busy, setBusy] = useState(false);
  const runSequence = useRef(0);
  const mode = String(options.mode ?? "");
  const secondaryDefinition = getSecondaryDefinition(tool.id, mode);
  const inputLabel = getInputLabel(tool.id, mode, specification.inputLabel);
  const isMarkdown = tool.id === "markdown-preview";
  const isRegex = tool.id === "regex-tester";
  const isReference = tool.kind === "reference";
  const isUnitConverter = ["length", "weight", "temperature", "area", "volume", "speed", "data-size"].some(group => tool.id === `${group}-converter`);

  const run = useCallback(async () => {
    const sequence = runSequence.current + 1;
    runSequence.current = sequence;
    setBusy(true);
    const executionOptions = tool.id === "random-number-generator" && options.integer !== false
      ? { ...options, min: Math.ceil(Number(options.min)), max: Math.floor(Number(options.max)) }
      : options;
    const baseExecution = isRegex ? { output: "" } : await executeTool(tool.id, input, executionOptions, secondary);
    if (sequence !== runSequence.current) return;
    let nextExecution = baseExecution;
    let nextRows = normalizeRows(tool.id, baseExecution.rows, locale) ?? [];
    if (isRegex) {
      const regexResult = executeRegex(input, options, locale);
      nextExecution = regexResult.execution;
      nextRows = regexResult.rows;
    } else if (tool.id === "cron-expression-parser") {
      nextExecution = executeCron(input, Math.min(10, Math.max(1, Number(options.count ?? 5))), locale);
      nextRows = [];
    } else if (isMarkdown) {
      nextExecution = baseExecution.status === "error" ? baseExecution : { output: input, status: "success" };
      nextRows = [];
    } else {
      nextRows = nextRows.length ? nextRows : referenceRows(tool.id, baseExecution.output, locale) ?? [];
    }
    setExecution(nextExecution);
    setRows(nextRows);
    setBusy(false);
  }, [input, isMarkdown, isRegex, locale, options, secondary, tool.id]);

  useEffect(() => {
    if (!isReference && !isMarkdown) return;
    const timer = window.setTimeout(() => void run(), isMarkdown ? 180 : 120);
    return () => window.clearTimeout(timer);
  }, [isMarkdown, isReference, run]);

  const setOption = (name: string, value: string | number | boolean) => {
    setOptions(current => ({ ...current, [name]: value }));
  };

  const clear = () => {
    runSequence.current += 1;
    setInput("");
    setSecondary("");
    setOptions(specification.options);
    setExecution({ output: "" });
    setRows([]);
    setBusy(false);
  };

  const swapUnits = () => {
    setOptions(current => ({ ...current, from: current.to ?? "", to: current.from ?? "" }));
    if (execution.output) {
      const numeric = execution.output.trim().match(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i)?.[0];
      if (numeric) setInput(numeric);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const shouldRun = event.currentTarget instanceof HTMLInputElement
      ? event.key === "Enter"
      : event.key === "Enter" && (event.ctrlKey || event.metaKey);
    if (!shouldRun) return;
    event.preventDefault();
    void run();
  };

  const actionLabel = getActionLabel(tool, mode, ui);
  const message = localizeOperationMessage(execution.message, locale, tool.id, execution.status);
  const color = tool.id === "color-converter" ? execution.output.match(/#[0-9A-F]{6}/i)?.[0] ?? "" : "";
  const hasHeader = tool.id === "csv-table-viewer" ? options.firstRowHeader !== false : true;
  const outputExtension = getDownloadExtension(tool.id);

  return (
    <div className={`generic-tool generic-tool--${tool.kind} generic-tool--${tool.id}`} aria-busy={busy}>
      {(specification.modes.length > 1 || specification.controls.length > 0) && (
        <div className="generic-tool-controls tool-controls">
          {specification.modes.length > 1 && (
            <fieldset className="generic-tool-mode-selector">
              <legend>{ui.mode}</legend>
              <div className="generic-tool-mode-options">
                {specification.modes.map(item => <button className={`generic-tool-mode-button${mode === item.value ? " is-active" : ""}`} type="button" key={item.value} aria-pressed={mode === item.value} onClick={() => setOption("mode", item.value)}>{localize(locale, item.label)}</button>)}
              </div>
            </fieldset>
          )}
          {specification.controls.length > 0 && <span className="generic-tool-controls-heading">{ui.options}</span>}
          {specification.controls.map(control => {
            const fieldId = `generic-tool-${tool.id}-${control.name}`;
            if (control.kind === "checkbox") {
              return <label className="generic-tool-toggle toggle-field" key={control.name} htmlFor={fieldId}><input id={fieldId} type="checkbox" checked={Boolean(options[control.name])} onChange={event => setOption(control.name, event.target.checked)} /><span>{localize(locale, control.label)}</span></label>;
            }
            return (
              <label className={`generic-tool-field field${control.wide ? " generic-tool-field--wide" : ""}`} key={control.name} htmlFor={fieldId}>
                <span>{localize(locale, control.label)}</span>
                {control.kind === "select" ? (
                  <select id={fieldId} value={String(options[control.name] ?? "")} onChange={event => setOption(control.name, event.target.value)}>{control.choices?.map(item => <option value={item.value} key={item.value}>{localize(locale, item.label)}</option>)}</select>
                ) : (
                  <input id={fieldId} type={control.kind} min={control.min} max={control.max} step={control.step} value={String(options[control.name] ?? "")} placeholder={control.placeholder ? localize(locale, control.placeholder) : undefined} onChange={event => setOption(control.name, control.kind === "number" ? event.target.value : event.target.value)} onKeyDown={handleKeyDown} />
                )}
              </label>
            );
          })}
          {isUnitConverter && <button className="generic-tool-swap-units button button-ghost" type="button" onClick={swapUnits} title={ui.swapUnits}><ArrowLeftRight size={16} />{ui.swapUnits}</button>}
          <button className="generic-tool-run button button-primary" type="button" onClick={() => void run()} disabled={busy}>{getActionIcon(tool)}{busy ? ui.processing : actionLabel}</button>
        </div>
      )}

      {specification.modes.length <= 1 && specification.controls.length === 0 && (
        <div className="generic-tool-controls generic-tool-controls--action-only tool-controls">
          <button className="generic-tool-run button button-primary" type="button" onClick={() => void run()} disabled={busy}>{getActionIcon(tool)}{busy ? ui.processing : actionLabel}</button>
        </div>
      )}

      {message && <p className={`generic-tool-message result-message${execution.status === "success" ? " is-success" : ""}`} role={execution.status === "error" ? "alert" : "status"}>{execution.status === "error" && <strong>{ui.processError} </strong>}{message}</p>}

      <div className={`generic-tool-input-output input-output-grid${specification.inputKind === "none" ? " generic-tool-input-output--result-only" : ""}`}>
        {specification.inputKind !== "none" && (
          <section className="generic-tool-panel generic-tool-input-panel io-panel">
            <div className="generic-tool-panel-header io-header">
              <label htmlFor={`generic-tool-input-${tool.id}`}><strong>{localize(locale, inputLabel)}</strong></label>
              <div className="generic-tool-actions io-actions"><span className="generic-tool-shortcut">{ui.useCtrlEnter}</span><ClearButton onClear={clear} /></div>
            </div>
            <div className={`generic-tool-input-area${secondaryDefinition ? " generic-tool-input-area--with-secondary" : ""}`}>
              {specification.inputKind === "textarea" ? (
                <textarea id={`generic-tool-input-${tool.id}`} className="generic-tool-input tool-textarea" value={input} placeholder={localize(locale, specification.inputPlaceholder)} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} spellCheck={tool.kind === "text-transform" || tool.id === "markdown-preview"} />
              ) : (
                <input id={`generic-tool-input-${tool.id}`} className="generic-tool-input generic-tool-single-input control-input" type={specification.inputType ?? "text"} step={specification.inputType === "number" ? "any" : undefined} value={input} placeholder={localize(locale, specification.inputPlaceholder)} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} autoComplete={specification.inputType === "password" ? "new-password" : "off"} />
              )}
              {secondaryDefinition && (
                <div className="generic-tool-secondary">
                  <label htmlFor={`generic-tool-secondary-${tool.id}`}>{localize(locale, secondaryDefinition.label)}</label>
                  {secondaryDefinition.kind === "textarea" ? (
                    <textarea id={`generic-tool-secondary-${tool.id}`} className="generic-tool-secondary-input tool-textarea" value={secondary} placeholder={localize(locale, secondaryDefinition.placeholder)} onChange={event => setSecondary(event.target.value)} onKeyDown={handleKeyDown} spellCheck={false} />
                  ) : (
                    <input id={`generic-tool-secondary-${tool.id}`} className="generic-tool-secondary-input control-input" type={secondaryDefinition.kind} step={secondaryDefinition.kind === "number" ? "any" : undefined} value={secondary} placeholder={localize(locale, secondaryDefinition.placeholder)} onChange={event => setSecondary(event.target.value)} onKeyDown={handleKeyDown} autoComplete={secondaryDefinition.kind === "password" ? "new-password" : "off"} />
                  )}
                </div>
              )}
            </div>
            <ToolStats value={input} />
          </section>
        )}

        <section className="generic-tool-panel generic-tool-result-panel io-panel" aria-live="polite">
          <div className="generic-tool-panel-header io-header">
            <strong>{isMarkdown ? ui.markdownPreview : ui.result}</strong>
            <div className="generic-tool-actions io-actions">
              <CopyButton value={execution.output} />
              <DownloadButton value={execution.output} fileName={`toolsy-${tool.id}.${outputExtension}`} />
              {specification.inputKind === "none" && <ClearButton onClear={clear} />}
            </div>
          </div>
          {color && <div className="generic-tool-color-preview" aria-label={ui.colorPreview}><span className="generic-tool-color-swatch" style={{ backgroundColor: color }} /><strong>{color}</strong></div>}
          {isMarkdown ? (
            execution.output ? <MarkdownPreview source={execution.output} label={ui.markdownPreview} /> : <p className="generic-tool-empty-result">{ui.resultPlaceholder}</p>
          ) : rows.length ? (
            <>
              <ResultTable rows={rows} locale={locale} caption={isRegex ? ui.matches : ui.table} sortable={tool.id === "csv-table-viewer"} firstRowHeader={hasHeader} />
              {isRegex && <div className="generic-tool-regex-replacement"><strong>{ui.replacementPreview}</strong><pre>{execution.output}</pre></div>}
            </>
          ) : (
            <textarea className="generic-tool-result tool-textarea" value={execution.output} placeholder={ui.resultPlaceholder} readOnly aria-label={ui.rawResult} />
          )}
          <ToolStats value={execution.output} />
        </section>
      </div>
    </div>
  );
}

export function GenericTool({ tool }: { tool: ToolDefinition }) {
  return <GenericToolWorkspace key={tool.id} tool={tool} />;
}
