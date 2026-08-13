"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import { localizeCategory, type CategoryDefinition, type ToolDefinition } from "@/lib/catalog";
import { normalizeSearchText } from "@/lib/search";
import { Footer } from "../AppShell";
import { ToolGrid } from "../catalog/ToolCard";
import { Search } from "lucide-react";

export function CategoryPage({ category, tools }: { category: CategoryDefinition; tools: readonly ToolDefinition[] }) {
  const { locale, copy } = useApp();
  const localized = localizeCategory(category, locale);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const normalized = normalizeSearchText(deferredQuery).value;
    if (!normalized) return tools;
    return tools.filter(tool => {
      const text = Object.values(tool.translations).flatMap(value => [value.name, value.description, ...value.aliases, ...value.keywords]).join(" ");
      return normalizeSearchText(text).value.includes(normalized);
    });
  }, [deferredQuery, tools]);
  return (
    <div>
      <div className="page-container category-page">
        <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">{copy.nav.home}</Link><ChevronRight size={14} /><span aria-current="page">{localized.name}</span></nav>
        <header className="category-header"><p className="category-overline">{copy.nav.categories}</p><h1>{localized.name}</h1><p>{localized.description}</p><span>{tools.length} {tools.length === 1 ? copy.category.tool : copy.category.tools}</span></header>
        <div className="category-filter"><Search size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.category.filter} aria-label={copy.category.filter} /></div>
        {filtered.length > 0 ? <ToolGrid tools={filtered} /> : <div className="empty-state"><Search size={28} /><h2>{copy.category.empty}</h2><p>{query}</p></div>}
      </div>
      <Footer />
    </div>
  );
}
