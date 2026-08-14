import type { Locale } from "./types";

const SHARED_TERM_THRESHOLD = 3;

const byLengthDesc = (terms: readonly string[]): readonly string[] =>
  [...terms].sort((first, second) => second.length - first.length);

const ROLE_PREFIXES_PT = byLengthDesc([
  "Analisador de",
  "Calculadora de",
  "Codificador de",
  "Comparador de",
  "Compressor de",
  "Contador de",
  "Conversor de",
  "Editor de",
  "Extrator de",
  "Formatador de",
  "Gerador de",
  "Otimizador de",
  "Validador de",
  "Visualizador de",
  "Calculadora",
  "Codificador",
  "Conversor",
  "Gerador",
]);

const ROLE_SUFFIXES_EN = byLengthDesc([
  "Analyzer",
  "Calculator",
  "Comparer",
  "Compressor",
  "Converter",
  "Counter",
  "Editor",
  "Encoder",
  "Extractor",
  "Formatter",
  "Generator",
  "Optimizer",
  "Validator",
  "Viewer",
]);

/**
 * Drops the role word that most tools of a category repeat ("Conversor de X",
 * "X Converter") so sidebar lists stay short and scannable. Only applies when
 * enough siblings share the term, otherwise the label would lose meaning.
 */
export function getCompactToolNames(
  names: readonly string[],
  locale: Locale,
): string[] {
  const isPortuguese = locale === "pt-BR";
  const roleTerms = isPortuguese ? ROLE_PREFIXES_PT : ROLE_SUFFIXES_EN;
  const hasTerm = (name: string, term: string): boolean =>
    isPortuguese ? name.startsWith(`${term} `) : name.endsWith(` ${term}`);

  const sharedTerm = roleTerms.find(
    (term) => names.filter((name) => hasTerm(name, term)).length >= SHARED_TERM_THRESHOLD,
  );
  if (!sharedTerm) return [...names];

  return names.map((name) => {
    if (!hasTerm(name, sharedTerm)) return name;
    const compact = isPortuguese
      ? name.slice(sharedTerm.length + 1)
      : name.slice(0, name.length - sharedTerm.length - 1);
    return compact.trim() || name;
  });
}
