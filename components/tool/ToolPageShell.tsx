"use client";

import Link from "next/link";
import { ChevronRight, Heart, LockKeyhole, Radio } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { getCategoryById, getToolById, localizeCategory, localizeTool, type ToolDefinition } from "@/lib/catalog";
import { ToolIcon } from "../ToolIcon";
import { ToolCard } from "../catalog/ToolCard";

export function ToolPageShell({ tool, children }: { tool: ToolDefinition; children: React.ReactNode }) {
  const { locale, copy, favorites, toggleFavorite, addRecent } = useApp();
  const localized = localizeTool(tool, locale);
  const category = getCategoryById(tool.category);
  const isFavorite = favorites.includes(tool.id);
  const isNetworkTool = tool.processing === "network";
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
          <span className="tool-page-icon"><ToolIcon name={tool.icon} size={22} /></span>
          <div>
            <h1>{localized.name}</h1>
            <p>{localized.description}</p>
          </div>
        </div>
        <div className="tool-page-header-actions">
          <span
            className={`local-notice${isNetworkTool ? " local-notice--network" : ""}`}
            title={isNetworkTool ? copy.tool.networkDetail : copy.tool.localDetail}
          >
            {isNetworkTool ? <Radio size={14} /> : <LockKeyhole size={14} />}
            <span>{isNetworkTool ? copy.tool.network : copy.tool.local}</span>
          </span>
          <button
            className={`favorite-large ${isFavorite ? "is-favorite" : ""}`}
            onClick={() => toggleFavorite(tool.id)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? copy.tool.unfavorite : copy.tool.favorite}
            title={isFavorite ? copy.tool.unfavorite : copy.tool.favorite}
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </header>
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
