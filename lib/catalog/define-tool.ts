import type {
  CategoryId,
  IconKey,
  ToolDefinition,
  ToolKind,
  ToolTranslation,
} from "./types";

interface ToolInput {
  id: string;
  slug?: string;
  category: CategoryId;
  icon: IconKey;
  kind: ToolKind;
  pt: ToolTranslation;
  en: ToolTranslation;
  tags: readonly string[];
  relatedTools: readonly string[];
  config?: Readonly<Record<string, unknown>>;
  processing?: ToolDefinition["processing"];
}

export function defineTool(input: ToolInput): ToolDefinition {
  return {
    id: input.id,
    slug: input.slug ?? input.id,
    category: input.category,
    icon: input.icon,
    kind: input.kind,
    config: input.config,
    translations: {
      "pt-BR": input.pt,
      en: input.en,
    },
    tags: input.tags,
    relatedTools: input.relatedTools,
    isFavoriteCompatible: true,
    processing: input.processing ?? "local",
  };
}
