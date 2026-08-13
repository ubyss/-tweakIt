const combiningMarks = /\p{M}+/gu;
const separators = /[^\p{L}\p{N}]+/gu;
const duplicateSpaces = /\s+/g;

const characterExpansions: Readonly<Record<string, string>> = {
  æ: "ae",
  đ: "d",
  ð: "d",
  ł: "l",
  ø: "o",
  œ: "oe",
  ß: "ss",
  þ: "th",
};

export interface NormalizedSearchText {
  value: string;
  compact: string;
  tokens: readonly string[];
}

export function analyzeSearchText(input: string): NormalizedSearchText {
  const expanded = Array.from(input.toLocaleLowerCase("en-US"), (character) =>
    characterExpansions[character] ?? character,
  ).join("");
  const value = expanded
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .replace(separators, " ")
    .replace(duplicateSpaces, " ")
    .trim();
  return {
    value,
    compact: value.replaceAll(" ", ""),
    tokens: value ? value.split(" ") : [],
  };
}

export function normalizeSearchText(input: string): NormalizedSearchText {
  return analyzeSearchText(input);
}
