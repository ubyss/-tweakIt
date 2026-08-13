import type {
  CategoryId,
  Locale,
  LocalizedTool,
} from "../catalog/types";

export type SearchMatchKind =
  | "exact-name"
  | "exact-alias"
  | "exact-keyword"
  | "word-prefix"
  | "fuzzy"
  | "description";

export type SearchFieldKind =
  | "name"
  | "alias"
  | "keyword"
  | "tag"
  | "description";

export interface SearchMatch {
  kind: SearchMatchKind;
  field: SearchFieldKind;
  locale?: Locale;
  value: string;
}

export type SearchResult = LocalizedTool & {
  score: number;
  match: SearchMatch;
};

export interface SearchOptions {
  limit?: number;
  category?: CategoryId;
  fuzzy?: boolean;
}
