import { categories, tools } from "./index";

export interface CatalogValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function validateCatalog(): CatalogValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const categoryIds = new Set(categories.map((category) => category.id));

  for (const tool of tools) {
    if (ids.has(tool.id)) errors.push(`Duplicate tool id: ${tool.id}`);
    if (slugs.has(tool.slug)) errors.push(`Duplicate tool slug: ${tool.slug}`);
    ids.add(tool.id);
    slugs.add(tool.slug);
    if (!categoryIds.has(tool.category)) {
      errors.push(`Unknown category ${tool.category} on ${tool.id}`);
    }
    if (!tool.translations.en.name || !tool.translations["pt-BR"].name) {
      errors.push(`Missing translated name on ${tool.id}`);
    }
    if (
      !tool.translations.en.description ||
      !tool.translations["pt-BR"].description
    ) {
      errors.push(`Missing translated description on ${tool.id}`);
    }
    if (tool.relatedTools.length > 4) {
      errors.push(`Too many related tools on ${tool.id}`);
    }
  }

  for (const tool of tools) {
    for (const relatedId of tool.relatedTools) {
      if (!ids.has(relatedId)) {
        errors.push(`Unknown related tool ${relatedId} on ${tool.id}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
