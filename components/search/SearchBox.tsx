"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { getCategoryById, localizeCategory, type CategoryId } from "@/lib/catalog";
import { searchTools } from "@/lib/search";
import { ToolIcon } from "../ToolIcon";

type SearchBoxProps = {
  autoFocus?: boolean;
  compact?: boolean;
  initialQuery?: string;
  category?: CategoryId;
  onNavigate?: () => void;
};

export function SearchBox({ autoFocus, compact, initialQuery = "", category, onNavigate }: SearchBoxProps) {
  const { locale, copy } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchTools(deferredQuery, locale, { category, limit: compact ? 8 : 6 }), [deferredQuery, locale, category, compact]);
  const visible = query.trim().length > 0;

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const open = (index: number) => {
    const result = results[index];
    if (!result) return;
    onNavigate?.();
    router.push(`/tools/${result.slug}`);
  };

  return (
    <div className={`search-box ${compact ? "is-compact" : ""}`}>
      <div className="search-field-wrap">
        <Search size={compact ? 19 : 23} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive(current => Math.min(current + 1, results.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive(current => Math.max(current - 1, 0)); }
            if (event.key === "Enter") { event.preventDefault(); open(active); }
            if (event.key === "Escape") { if (query) setQuery(""); else onNavigate?.(); }
          }}
          placeholder={category ? copy.category.filter : copy.search.placeholder}
          aria-label={category ? copy.category.filter : copy.search.placeholder}
          aria-controls={visible ? listId : undefined}
          aria-activedescendant={visible && results[active] ? `${listId}-${active}` : undefined}
          role="combobox"
          aria-expanded={visible}
          autoComplete="off"
        />
        {query && <button className="search-clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label={copy.search.clear}><X size={17} /></button>}
      </div>
      {!compact && !visible && <p className="search-hint">{copy.search.examples}</p>}
      {visible && (
        <div className="search-results" id={listId} role="listbox">
          {results.length > 0 ? results.map((result, index) => {
            const categoryDefinition = getCategoryById(result.category);
            return (
              <button
                key={result.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={`search-result ${index === active ? "is-active" : ""}`}
                data-category={result.category}
                onMouseEnter={() => setActive(index)}
                onClick={() => open(index)}
              >
                <span className="search-result-icon"><ToolIcon name={result.icon} size={20} /></span>
                <span className="search-result-copy"><strong>{result.name}</strong><span>{result.description}</span></span>
                {categoryDefinition && <span className="search-result-category">{localizeCategory(categoryDefinition, locale).name}</span>}
                <ArrowRight size={17} className="search-result-arrow" />
              </button>
            );
          }) : (
            <div className="search-empty"><strong>{copy.search.noResults}</strong><span>{copy.search.suggestions}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
