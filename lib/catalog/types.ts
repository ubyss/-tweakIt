export type Locale = "pt-BR" | "en";

export type CategoryId =
  | "crypto"
  | "converters"
  | "web"
  | "images-video"
  | "development"
  | "network"
  | "math"
  | "measurements"
  | "text"
  | "data";

export type IconKey =
  | "shield"
  | "key"
  | "hash"
  | "fingerprint"
  | "lock"
  | "sparkles"
  | "repeat"
  | "link"
  | "code"
  | "calendar"
  | "clock"
  | "palette"
  | "binary"
  | "file-code"
  | "globe"
  | "qr-code"
  | "scan"
  | "image"
  | "image-down"
  | "image-up"
  | "crop"
  | "file-image"
  | "braces"
  | "regex"
  | "terminal"
  | "square-code"
  | "network"
  | "wifi"
  | "router"
  | "gauge"
  | "calculator"
  | "percent"
  | "dices"
  | "ruler"
  | "weight"
  | "thermometer"
  | "box"
  | "wind"
  | "database"
  | "type"
  | "text-cursor-input"
  | "case-upper"
  | "between-horizontal-start"
  | "list"
  | "remove-format"
  | "align-left"
  | "whole-word"
  | "quote"
  | "columns"
  | "table"
  | "brackets"
  | "files"
  | "git-compare"
  | "wand-sparkles"
  | "banknote";

export type ToolKind =
  | "calculator"
  | "codec"
  | "converter"
  | "formatter"
  | "generator"
  | "image"
  | "inspector"
  | "parser"
  | "reference"
  | "text-transform"
  | "validator"
  | "workspace";

export interface ToolTranslation {
  name: string;
  description: string;
  aliases: readonly string[];
  keywords: readonly string[];
}

export interface CategoryTranslation {
  name: string;
  description: string;
}

export type Localized<T> = Readonly<Record<Locale, T>>;

export interface ToolDefinition {
  id: string;
  slug: string;
  category: CategoryId;
  icon: IconKey;
  kind: ToolKind;
  config?: Readonly<Record<string, unknown>>;
  translations: Localized<ToolTranslation>;
  tags: readonly string[];
  relatedTools: readonly string[];
  isFavoriteCompatible: boolean;
  processing: "local" | "network";
}

export interface CategoryDefinition {
  id: CategoryId;
  slug: string;
  icon: IconKey;
  translations: Localized<CategoryTranslation>;
}

export type LocalizedTool = Omit<ToolDefinition, "translations"> &
  ToolTranslation & {
    locale: Locale;
    translations: ToolDefinition["translations"];
  };

export type LocalizedCategory = Omit<CategoryDefinition, "translations"> &
  CategoryTranslation & {
    locale: Locale;
    translations: CategoryDefinition["translations"];
  };
