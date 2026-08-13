import { categories, tools } from "../catalog";
import type { Locale, ToolDefinition } from "../catalog/types";
import { analyzeSearchText } from "./normalize";
import type { SearchFieldKind } from "./types";

export interface IndexedField {
  kind: SearchFieldKind;
  locale?: Locale;
  original: string;
  normalized: string;
  compact: string;
  tokens: readonly string[];
}

export interface IndexedTool {
  tool: ToolDefinition;
  fields: readonly IndexedField[];
}

function createField(
  kind: SearchFieldKind,
  original: string,
  locale?: Locale,
): IndexedField {
  const normalized = analyzeSearchText(original);
  return {
    kind,
    locale,
    original,
    normalized: normalized.value,
    compact: normalized.compact,
    tokens: normalized.tokens,
  };
}

function fieldsForTool(tool: ToolDefinition): readonly IndexedField[] {
  const fields: IndexedField[] = [];
  for (const locale of ["pt-BR", "en"] as const) {
    const translation = tool.translations[locale];
    fields.push(createField("name", translation.name, locale));
    fields.push(
      ...translation.aliases.map((alias) =>
        createField("alias", alias, locale),
      ),
    );
    fields.push(
      ...translation.keywords.map((keyword) =>
        createField("keyword", keyword, locale),
      ),
    );
    fields.push(createField("description", translation.description, locale));
  }
  fields.push(...tool.tags.map((tag) => createField("tag", tag)));
  const category = categories.find((item) => item.id === tool.category);
  if (category) {
    fields.push(
      createField("tag", category.translations["pt-BR"].name, "pt-BR"),
      createField("tag", category.translations.en.name, "en"),
    );
  }
  const intentValues = [
    ...tool.translations["pt-BR"].aliases,
    ...tool.translations["pt-BR"].keywords,
    ...tool.translations.en.aliases,
    ...tool.translations.en.keywords,
  ];
  if (tool.id === "text-formatter") intentValues.push("remove spaces", "remover espaco em branco", "remover acentuacao", "remove accents", "minificar texto");
  if (tool.id === "wifi-qr-code-generator") intentValues.push("wifi senha qr", "wifi password qr");
  if (tool.id === "percentage-calculator") intentValues.push("porcentagem", "percentual", "percentage");
  if (["json-minifier", "html-formatter", "css-formatter", "javascript-formatter", "sql-formatter", "svg-optimizer"].includes(tool.id)) intentValues.push("minificar texto", "minify text");
  fields.push(...intentValues.map((value) => createField("keyword", value)));
  if (tool.id === "percentage-calculator") {
    fields.push(createField("alias", "porcentagem", "pt-BR"), createField("alias", "percentage", "en"));
  }
  return fields;
}

export const searchIndex: readonly IndexedTool[] = tools.map((tool) => ({
  tool,
  fields: fieldsForTool(tool),
}));
