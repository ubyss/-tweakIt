import type {
  FormatterIssue,
  FormatterLocale,
  Localized,
  TextMatch,
  TextReplaceResult,
  TextSearchOptions,
  TextSearchResult,
  TextStats,
} from "./types";

export const WORD_CHARACTER_SOURCE = "\\p{L}\\p{M}\\p{N}_";
export const WORD_SOURCE = `[${WORD_CHARACTER_SOURCE}]+(?:['’\\-][${WORD_CHARACTER_SOURCE}]+)*`;

export function localized<T>(pt: T, en: T): Localized<T> {
  return { "pt-BR": pt, en };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function graphemes(text: string, locale: FormatterLocale = "pt-BR"): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(
      new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text),
      ({ segment }) => segment,
    );
  }
  return Array.from(text);
}

export function countGraphemes(text: string, locale: FormatterLocale = "pt-BR"): number {
  return graphemes(text, locale).length;
}

export function wordTokens(text: string, locale: FormatterLocale = "pt-BR"): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(text))
      .filter((item) => item.isWordLike)
      .map(({ segment }) => segment);
  }
  return text.match(new RegExp(WORD_SOURCE, "gu")) ?? [];
}

export function formatBytes(bytes: number, locale: FormatterLocale): string {
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const maximumFractionDigits = unitIndex === 0 ? 0 : value < 10 ? 2 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)} ${units[unitIndex]}`;
}

export function getTextStats(text: string, locale: FormatterLocale = "pt-BR"): TextStats {
  const bytes = new TextEncoder().encode(text).byteLength;
  return {
    characters: countGraphemes(text, locale),
    words: wordTokens(text, locale).length,
    lines: text.length === 0 ? 0 : (text.match(/\r\n|\r|\n/g)?.length ?? 0) + 1,
    bytes,
    formattedBytes: formatBytes(bytes, locale),
  };
}

export type LineEnding = "\n" | "\r\n" | "\r";

export interface SplitLinesResult {
  readonly lines: string[];
  readonly ending: LineEnding;
}

export function detectLineEnding(text: string): LineEnding {
  const counts: Record<LineEnding, number> = { "\n": 0, "\r\n": 0, "\r": 0 };
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    counts[match[0] as LineEnding] += 1;
  }
  if (counts["\r\n"] >= counts["\n"] && counts["\r\n"] >= counts["\r"] && counts["\r\n"] > 0) {
    return "\r\n";
  }
  if (counts["\r"] > counts["\n"]) return "\r";
  return "\n";
}

export function splitLines(text: string): SplitLinesResult {
  return {
    lines: text.split(/\r\n|\r|\n/),
    ending: detectLineEnding(text),
  };
}

export function normalizeLineEndings(text: string, ending: LineEnding): string {
  return text.replace(/\r\n|\r|\n/g, ending);
}

export function stableSort<T>(values: readonly T[], compare: (left: T, right: T) => number): T[] {
  return values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => compare(left.value, right.value) || left.index - right.index)
    .map(({ value }) => value);
}

export function tokenizeCase(input: string): string[] {
  return (
    input
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
  );
}

export function hashSeed(seed: string | number): number {
  const value = String(seed);
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededShuffle<T>(values: readonly T[], seed: string | number): T[] {
  const result = [...values];
  let state = hashSeed(seed) || 0x6d2b79f5;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function nextCodePointIndex(text: string, index: number): number {
  const point = text.codePointAt(index);
  return index + (point !== undefined && point > 0xffff ? 2 : 1);
}

const supportedRegexFlags = new Set(["g", "i", "m", "s", "u"]);

export function validateRegexFlags(flags: string): FormatterIssue | undefined {
  const seen = new Set<string>();
  for (const flag of flags) {
    if (!supportedRegexFlags.has(flag)) {
      return {
        code: "unsupported-regex-flag",
        severity: "error",
        field: "flags",
        values: { flag },
      };
    }
    if (seen.has(flag)) {
      return {
        code: "duplicate-regex-flag",
        severity: "error",
        field: "flags",
        values: { flag },
      };
    }
    seen.add(flag);
  }
  return undefined;
}

export function isPotentiallyUnsafeRegex(pattern: string): boolean {
  const withoutEscapes = pattern.replace(/\\./g, "x");
  const nestedQuantifier = /\((?:\?:|\?=|\?!)?[^()]*(?:[+*]|\{\d+(?:,\d*)?\})[^()]*\)(?:[+*]|\{\d+(?:,\d*)?\})/;
  const repeatedWildcard = /(?:\.\*|\.\+)[^|)]{0,24}(?:\.\*|\.\+)/;
  const quantifiedBackreference = /\\[1-9].{0,16}(?:[+*]|\{\d+(?:,\d*)?\})/;
  const quantifiedAlternation = /\((?:\?:)?([^()]*(?:\|[^()]*)+)\)(?:[+*]|\{\d+(?:,\d*)?\})/g;
  const ambiguousAlternation = Array.from(withoutEscapes.matchAll(quantifiedAlternation)).some((match) => {
    const branches = match[1].split("|").filter(Boolean);
    return branches.some((branch, index) => branches.some((candidate, candidateIndex) => (
      index !== candidateIndex && (branch.startsWith(candidate) || candidate.startsWith(branch))
    ))) || branches.some((branch) => /[.*+?{}[\]]/.test(branch));
  });
  return (
    nestedQuantifier.test(withoutEscapes) ||
    repeatedWildcard.test(withoutEscapes) ||
    quantifiedBackreference.test(pattern) ||
    ambiguousAlternation
  );
}

interface InternalMatch extends TextMatch {
  readonly value: string;
  readonly captures: readonly (string | undefined)[];
  readonly groups: Readonly<Record<string, string>> | undefined;
}

interface MatchCollection {
  readonly matches: readonly InternalMatch[];
  readonly total: number;
  readonly truncated: boolean;
  readonly issue?: FormatterIssue;
}

function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? Array.from(text.slice(0, start)).at(-1) ?? "" : "";
  const after = end < text.length ? Array.from(text.slice(end))[0] ?? "" : "";
  const wordCharacter = new RegExp(`[${WORD_CHARACTER_SOURCE}]`, "u");
  return !wordCharacter.test(before) && !wordCharacter.test(after);
}

function collectMatches(
  text: string,
  query: string,
  options: TextSearchOptions,
  respectGlobalFlag: boolean,
): MatchCollection {
  const maximum = Math.max(1, options.maxMatches ?? 10_000);
  if (query.length === 0) return { matches: [], total: 0, truncated: false };
  if (options.regex && query.length > 500) {
    return {
      matches: [],
      total: 0,
      truncated: false,
      issue: { code: "invalid-value", severity: "error", field: "pattern" },
    };
  }
  if (options.regex && isPotentiallyUnsafeRegex(query)) {
    return {
      matches: [],
      total: 0,
      truncated: false,
      issue: { code: "regex-timeout", severity: "error", field: "pattern" },
    };
  }
  const requestedFlags = options.regex ? options.flags ?? "gu" : "";
  const flagIssue = validateRegexFlags(requestedFlags);
  if (flagIssue) return { matches: [], total: 0, truncated: false, issue: flagIssue };
  const shouldContinue = !respectGlobalFlag || !options.regex || requestedFlags.includes("g");
  const flags = Array.from(
    new Set(
      `${requestedFlags.replace(/g/g, "")}${options.caseSensitive ? "" : "i"}ug`,
    ),
  ).join("");
  let expression: RegExp;
  try {
    expression = new RegExp(options.regex ? query : escapeRegExp(query), flags);
  } catch (error) {
    return {
      matches: [],
      total: 0,
      truncated: false,
      issue: {
        code: "invalid-regex",
        severity: "error",
        field: "pattern",
        detail: error instanceof Error ? error.message : undefined,
      },
    };
  }
  const matches: InternalMatch[] = [];
  let total = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!options.wholeWord || isWholeWord(text, start, end)) {
      total += 1;
      if (matches.length < maximum) {
        matches.push({
          start,
          end,
          value: match[0],
          captures: Array.from(match).slice(1),
          groups: match.groups,
        });
      }
      if (!shouldContinue || total > maximum) break;
    }
    if (match[0].length === 0) expression.lastIndex = nextCodePointIndex(text, expression.lastIndex);
  }
  return { matches, total, truncated: total > maximum };
}

export function findTextMatches(
  text: string,
  query: string,
  options: TextSearchOptions = {},
): TextSearchResult {
  const result = collectMatches(text, query, options, false);
  return {
    matches: result.matches.map(({ start, end }) => ({ start, end })),
    total: result.total,
    truncated: result.truncated,
    issue: result.issue,
  };
}

export interface TextReplaceOptions extends TextSearchOptions {
  readonly replaceAll?: boolean;
}

function expandRegexReplacement(
  template: string,
  match: InternalMatch,
  input: string,
): string {
  return template.replace(/\$([$&`']|<[^>]+>|\d{1,2})/g, (token, reference: string) => {
    if (reference === "$") return "$";
    if (reference === "&") return match.value;
    if (reference === "`") return input.slice(0, match.start);
    if (reference === "'") return input.slice(match.end);
    if (reference.startsWith("<")) return match.groups?.[reference.slice(1, -1)] ?? token;
    const index = Number(reference);
    if (!Number.isInteger(index) || index === 0 || index > match.captures.length) return token;
    return match.captures[index - 1] ?? "";
  });
}

export function replaceTextMatches(
  text: string,
  query: string,
  replacement: string,
  options: TextReplaceOptions = {},
): TextReplaceResult {
  const regexGlobal = options.regex && (options.flags ?? "gu").includes("g");
  const replaceAll = options.regex ? regexGlobal : options.replaceAll ?? true;
  const collected = collectMatches(
    text,
    query,
    { ...options, maxMatches: options.maxMatches ?? 100_000 },
    true,
  );
  if (collected.issue || collected.matches.length === 0) {
    return {
      text,
      replacements: 0,
      matches: collected.matches.map(({ start, end }) => ({ start, end })),
      total: collected.total,
      truncated: collected.truncated,
      issue: collected.issue,
    };
  }
  const selected = replaceAll ? collected.matches : collected.matches.slice(0, 1);
  let cursor = 0;
  let output = "";
  for (const match of selected) {
    output += text.slice(cursor, match.start);
    output += options.regex ? expandRegexReplacement(replacement, match, text) : replacement;
    cursor = match.end;
  }
  output += text.slice(cursor);
  return {
    text: output,
    replacements: selected.length,
    matches: selected.map(({ start, end }) => ({ start, end })),
    total: collected.total,
    truncated: collected.truncated,
  };
}

export function mapWords(
  text: string,
  mapper: (word: string, index: number) => string,
): string {
  const expression = new RegExp(WORD_SOURCE, "gu");
  let wordIndex = 0;
  return text.replace(expression, (word) => mapper(word, wordIndex++));
}

export function wordsAndSeparators(text: string): { words: string[]; separators: string[] } {
  const expression = new RegExp(WORD_SOURCE, "gu");
  const words: string[] = [];
  const separators: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)) !== null) {
    separators.push(text.slice(cursor, match.index));
    words.push(match[0]);
    cursor = match.index + match[0].length;
  }
  separators.push(text.slice(cursor));
  return { words, separators };
}

export function joinWordsAndSeparators(words: readonly string[], separators: readonly string[]): string {
  let output = separators[0] ?? "";
  words.forEach((word, index) => {
    output += word + (separators[index + 1] ?? "");
  });
  return output;
}
