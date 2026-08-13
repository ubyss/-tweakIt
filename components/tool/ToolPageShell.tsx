"use client";

import Link from "next/link";
import { Check, ChevronRight, Heart, LockKeyhole } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/app/providers";
import { getCategoryById, getToolById, localizeCategory, localizeTool, type ToolDefinition } from "@/lib/catalog";
import { ToolIcon } from "../ToolIcon";
import { ToolCard } from "../catalog/ToolCard";

export function ToolPageShell({ tool, children }: { tool: ToolDefinition; children: React.ReactNode }) {
  const { locale, copy, favorites, toggleFavorite, addRecent } = useApp();
  const localized = localizeTool(tool, locale);
  const category = getCategoryById(tool.category);
  const isFavorite = favorites.includes(tool.id);
  useEffect(() => addRecent(tool.id), [tool.id, addRecent]);
  return (
    <div className="tool-page page-container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{copy.nav.home}</Link><ChevronRight size={14} />
        {category && <><Link href={`/category/${category.slug}`}>{localizeCategory(category, locale).name}</Link><ChevronRight size={14} /></>}
        <span aria-current="page">{localized.name}</span>
      </nav>
      <header className="tool-page-header">
        <div className="tool-title-row">
          <span className="tool-page-icon"><ToolIcon name={tool.icon} size={27} /></span>
          <div><h1>{localized.name}</h1><p>{localized.description}</p></div>
        </div>
        <button className={`favorite-large ${isFavorite ? "is-favorite" : ""}`} onClick={() => toggleFavorite(tool.id)} aria-pressed={isFavorite}>
          <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
          <span>{isFavorite ? copy.tool.unfavorite : copy.tool.favorite}</span>
        </button>
      </header>
      <div className="local-notice"><LockKeyhole size={16} /><span><strong>{copy.tool.local}</strong>{copy.tool.localDetail}</span><Check size={15} /></div>
      <section className="tool-workspace">{children}</section>
      {tool.relatedTools.length > 0 && (
        <section className="related-section">
          <div className="section-heading"><h2>{copy.tool.related}</h2></div>
          <div className="tool-grid related-grid">{tool.relatedTools.map(id => getToolById(id)).filter((item): item is ToolDefinition => Boolean(item)).slice(0, 4).map(item => <ToolCard key={item.id} tool={item} />)}</div>
        </section>
      )}
    </div>
  );
}
