import { categories } from "./categories";
import { cryptoTools } from "./definitions/crypto";
import { converterTools } from "./definitions/converters";
import { dataTools } from "./definitions/data";
import { developmentTools } from "./definitions/development";
import { imageVideoTools } from "./definitions/images-video";
import { mathTools } from "./definitions/math";
import { measurementTools } from "./definitions/measurements";
import { networkTools } from "./definitions/network";
import { textTools } from "./definitions/text";
import { webTools } from "./definitions/web";
import type {
  CategoryDefinition,
  CategoryId,
  Locale,
  LocalizedCategory,
  LocalizedTool,
  ToolDefinition,
} from "./types";

export { categories };
export { getCompactToolNames } from "./tool-labels";
export type {
  CategoryDefinition,
  CategoryId,
  CategoryTranslation,
  IconKey,
  Locale,
  Localized,
  LocalizedCategory,
  LocalizedTool,
  ToolDefinition,
  ToolKind,
  ToolTranslation,
} from "./types";

export const tools: readonly ToolDefinition[] = Object.freeze([
  ...cryptoTools,
  ...converterTools,
  ...webTools,
  ...imageVideoTools,
  ...developmentTools,
  ...networkTools,
  ...mathTools,
  ...measurementTools,
  ...textTools,
  ...dataTools,
]);

const toolsById = new Map(tools.map((tool) => [tool.id, tool]));
const toolsBySlug = new Map(tools.map((tool) => [tool.slug, tool]));
const categoriesById = new Map<CategoryId, CategoryDefinition>(
  categories.map((category) => [category.id, category]),
);
const categoriesBySlug = new Map<string, CategoryDefinition>(
  categories.map((category) => [category.slug, category]),
);

export const toolCountByCategory: Readonly<Record<CategoryId, number>> =
  Object.freeze(
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        tools.filter((tool) => tool.category === category.id).length,
      ]),
    ) as Record<CategoryId, number>,
  );

export function getToolById(id: string): ToolDefinition | undefined {
  return toolsById.get(id);
}

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return toolsBySlug.get(slug);
}

export function getCategoryById(
  id: CategoryId | string,
): CategoryDefinition | undefined {
  return categoriesById.get(id as CategoryId);
}

export function getCategoryBySlug(
  slug: string,
): CategoryDefinition | undefined {
  return categoriesBySlug.get(slug);
}

export function localizeTool(
  tool: ToolDefinition,
  locale: Locale,
): LocalizedTool {
  return {
    ...tool,
    ...tool.translations[locale],
    locale,
    translations: tool.translations,
  };
}

export function localizeCategory(
  category: CategoryDefinition,
  locale: Locale,
): LocalizedCategory {
  return {
    ...category,
    ...category.translations[locale],
    locale,
    translations: category.translations,
  };
}
