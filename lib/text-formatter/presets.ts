import type { FormatterPreset, ParamRecord } from "./types";
import { localized } from "./text-utils";

const step = (operationId: string, params: ParamRecord = {}) => ({ operationId, params });

export const formatterPresets: readonly FormatterPreset[] = [
  {
    id: "cleanText",
    label: localized("Limpar texto", "Clean text"),
    operations: [
      step("normalizeUnicode", { form: "NFC" }),
      step("removeInvisibleCharacters", { preserveTabsAndLineBreaks: true }),
      step("removeExtraSpaces"),
      step("limitEmptyLines", { maximum: 1, whitespaceOnly: true }),
      step("trim"),
    ],
  },
  {
    id: "textToUrl",
    label: localized("Texto para URL", "Text to URL"),
    operations: [
      step("normalizeUnicode", { form: "NFKD" }),
      step("removeDiacritics"),
      step("slugify", { separator: "-", preserveUnicode: true }),
    ],
  },
  {
    id: "normalizeText",
    label: localized("Normalizar texto", "Normalize text"),
    operations: [
      step("normalizeUnicode", { form: "NFC" }),
      step("normalizeLineBreaks", { style: "lf" }),
      step("tabsToSpaces", { spaces: 4 }),
      step("trimLineEnd"),
      step("limitEmptyLines", { maximum: 1, whitespaceOnly: true }),
      step("trim"),
    ],
  },
  {
    id: "removeFormatting",
    label: localized("Remover formatação", "Remove formatting"),
    operations: [
      step("stripHtml"),
      step("stripMarkdown"),
      step("removeInvisibleCharacters", { preserveTabsAndLineBreaks: true }),
      step("removeExtraSpaces"),
      step("trim"),
    ],
  },
  {
    id: "prepareList",
    label: localized("Preparar lista", "Prepare list"),
    operations: [
      step("trimLineStart"),
      step("trimLineEnd"),
      step("removeEmptyLines", { whitespaceOnly: true }),
      step("uniqueLines", { caseSensitive: false, trimBeforeCompare: true, keep: "first" }),
      step("sortLinesAsc", { caseSensitive: false, trimBeforeCompare: true }),
    ],
  },
  {
    id: "minify",
    label: localized("Minificar", "Minify"),
    operations: [step("minifyText", {
      removeLineBreaks: true,
      removeTabs: true,
      collapseSpaces: true,
      removeSpacesCompletely: false,
      trimResult: true,
    })],
  },
];

export const formatterPresetRegistry: Readonly<Record<string, FormatterPreset>> = Object.freeze(
  Object.fromEntries(formatterPresets.map((preset) => [preset.id, preset])),
);
