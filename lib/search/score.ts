import type { Locale } from "../catalog/types";
import type { IndexedField, IndexedTool } from "./build-index";
import type { NormalizedSearchText } from "./normalize";
import type { SearchMatch, SearchMatchKind } from "./types";

interface ScoredMatch {
  score: number;
  match: SearchMatch;
}

const exactScores = {
  name: 100_000,
  alias: 90_000,
  keyword: 80_000,
  tag: 80_000,
} as const;

const fuzzyFieldBonus = {
  name: 500,
  alias: 400,
  keyword: 300,
  tag: 200,
} as const;

function localeBonus(field: IndexedField, locale: Locale): number {
  return field.locale === locale ? 20 : 0;
}

function toMatch(
  field: IndexedField,
  kind: SearchMatchKind,
): SearchMatch {
  return {
    kind,
    field: field.kind,
    locale: field.locale,
    value: field.original,
  };
}

function isExact(field: IndexedField, query: NormalizedSearchText): boolean {
  return (
    field.normalized === query.value ||
    (field.compact.length > 2 && field.compact === query.compact)
  );
}

function prefixStrength(
  field: IndexedField,
  query: NormalizedSearchText,
): number {
  if (!query.value || field.kind === "description") return 0;
  if (field.normalized.startsWith(query.value)) return 950;
  if (field.normalized.includes(` ${query.value}`)) return 850;
  const everyTokenStartsAWord = query.tokens.every((queryToken) =>
    field.tokens.some((fieldToken) => fieldToken.startsWith(queryToken)),
  );
  if (!everyTokenStartsAWord) return 0;
  const exactTokens = query.tokens.filter((queryToken) =>
    field.tokens.includes(queryToken),
  ).length;
  return 600 + Math.round((exactTokens / query.tokens.length) * 200);
}

function boundedDamerauLevenshtein(
  left: string,
  right: string,
  limit: number,
): number | undefined {
  if (Math.abs(left.length - right.length) > limit) return undefined;
  let previousPrevious: number[] | undefined;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      let distance = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
      if (
        previousPrevious &&
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(
          distance,
          (previousPrevious[rightIndex - 2] ?? 0) + 1,
        );
      }
      current[rightIndex] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > limit) return undefined;
    previousPrevious = previous;
    previous = current;
  }

  const result = previous[right.length];
  return result !== undefined && result <= limit ? result : undefined;
}

function fuzzyThreshold(length: number): {
  maxDistance: number;
  minimumSimilarity: number;
} | undefined {
  if (length <= 4) return undefined;
  if (length <= 7) return { maxDistance: 1, minimumSimilarity: 0.8 };
  if (length <= 12) return { maxDistance: 2, minimumSimilarity: 0.8 };
  return { maxDistance: 3, minimumSimilarity: 0.82 };
}

function tokenSimilarity(left: string, right: string): number | undefined {
  if (left === right) return 1;
  const threshold = fuzzyThreshold(left.length);
  if (!threshold) return undefined;
  const distance = boundedDamerauLevenshtein(
    left,
    right,
    threshold.maxDistance,
  );
  if (distance === undefined) return undefined;
  const similarity = 1 - distance / Math.max(left.length, right.length);
  return similarity >= threshold.minimumSimilarity ? similarity : undefined;
}

function fuzzySimilarity(
  field: IndexedField,
  query: NormalizedSearchText,
): number | undefined {
  if (field.kind === "description" || query.tokens.length === 0) {
    return undefined;
  }
  const tokenScores = query.tokens.map((queryToken) => {
    let best: number | undefined;
    for (const fieldToken of field.tokens) {
      const similarity = tokenSimilarity(queryToken, fieldToken);
      if (similarity !== undefined && (best === undefined || similarity > best)) {
        best = similarity;
      }
    }
    return best;
  });
  let total = 0;
  for (const score of tokenScores) {
    if (score === undefined) return undefined;
    total += score;
  }
  return total / tokenScores.length;
}

function descriptionStrength(
  field: IndexedField,
  query: NormalizedSearchText,
): number {
  if (field.kind !== "description") return 0;
  if (field.normalized.includes(query.value)) return 900;
  const matches = query.tokens.filter((queryToken) =>
    field.tokens.some((fieldToken) => fieldToken.startsWith(queryToken)),
  ).length;
  return matches === query.tokens.length
    ? 500 + Math.round((matches / field.tokens.length) * 100)
    : 0;
}

export function scoreIndexedTool(
  entry: IndexedTool,
  query: NormalizedSearchText,
  locale: Locale,
  fuzzy: boolean,
): ScoredMatch | undefined {
  let best: ScoredMatch | undefined;

  const consider = (candidate: ScoredMatch): void => {
    if (!best || candidate.score > best.score) best = candidate;
  };

  for (const field of entry.fields) {
    if (field.kind !== "description" && isExact(field, query)) {
      const base = exactScores[field.kind];
      const kind: SearchMatchKind =
        field.kind === "name"
          ? "exact-name"
          : field.kind === "alias"
            ? "exact-alias"
            : "exact-keyword";
      consider({
        score: base + localeBonus(field, locale),
        match: toMatch(field, kind),
      });
    }

    const prefix = prefixStrength(field, query);
    if (prefix > 0) {
      consider({
        score: 70_000 + prefix + localeBonus(field, locale),
        match: toMatch(field, "word-prefix"),
      });
    }

    if (fuzzy && field.kind !== "description") {
      const similarity = fuzzySimilarity(field, query);
      if (similarity !== undefined && similarity < 1) {
        consider({
          score:
            60_000 +
            Math.round(similarity * 1_000) +
            fuzzyFieldBonus[field.kind] +
            localeBonus(field, locale),
          match: toMatch(field, "fuzzy"),
        });
      }
    }

    const description = descriptionStrength(field, query);
    if (description > 0) {
      consider({
        score: 20_000 + description + localeBonus(field, locale),
        match: toMatch(field, "description"),
      });
    }
  }

  return best;
}
