import { localizeTool } from "../catalog";
import type { Locale } from "../catalog/types";
import { searchIndex } from "./build-index";
import { analyzeSearchText } from "./normalize";
import { scoreIndexedTool } from "./score";
import type { SearchOptions, SearchResult } from "./types";

export type {
  SearchFieldKind,
  SearchMatch,
  SearchMatchKind,
  SearchOptions,
  SearchResult,
} from "./types";
export { normalizeSearchText } from "./normalize";

export function searchTools(
  query: string,
  locale: Locale,
  options: SearchOptions = {},
): SearchResult[] {
  const normalizedQuery = analyzeSearchText(query);
  if (!normalizedQuery.value) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 8, 50));
  const results: SearchResult[] = [];

  for (const entry of searchIndex) {
    if (options.category && entry.tool.category !== options.category) continue;
    const scored = scoreIndexedTool(
      entry,
      normalizedQuery,
      locale,
      options.fuzzy ?? true,
    );
    if (!scored) continue;
    results.push({
      ...localizeTool(entry.tool, locale),
      score: scored.score,
      match: scored.match,
    });
  }

  return results
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.name.localeCompare(right.name, locale, { sensitivity: "base" }),
    )
    .slice(0, limit);
}
