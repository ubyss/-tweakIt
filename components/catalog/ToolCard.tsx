"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useApp } from "@/app/providers";
import { getCategoryById, localizeCategory, localizeTool, type ToolDefinition } from "@/lib/catalog";
import { ToolIcon } from "../ToolIcon";

export function ToolCard({ tool, showCategory = false }: { tool: ToolDefinition; showCategory?: boolean }) {
  const router = useRouter();
  const { locale, copy, favorites, toggleFavorite } = useApp();
  const localized = localizeTool(tool, locale);
  const category = getCategoryById(tool.category);
  const isFavorite = favorites.includes(tool.id);
  const href = `/tools/${tool.slug}`;
  const prefetch = () => router.prefetch(href);
  return (
    <article className="tool-card">
      <Link className="tool-card-link" href={href} onPointerEnter={prefetch} onFocus={prefetch}>
        <span className="tool-card-icon"><ToolIcon name={tool.icon} size={21} strokeWidth={1.8} /></span>
        <span className="tool-card-content">
          <span className="tool-card-name">{localized.name}</span>
          <span className="tool-card-description">{localized.description}</span>
          {showCategory && category && <span className="tool-card-category">{localizeCategory(category, locale).name}</span>}
        </span>
      </Link>
      {tool.isFavoriteCompatible && (
        <button
          className={`favorite-button ${isFavorite ? "is-favorite" : ""}`}
          aria-label={isFavorite ? copy.tool.unfavorite : copy.tool.favorite}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(tool.id)}
        >
          <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}

export function ToolGrid({ tools, showCategory = false }: { tools: readonly ToolDefinition[]; showCategory?: boolean }) {
  return <div className="tool-grid">{tools.map(tool => <ToolCard key={tool.id} tool={tool} showCategory={showCategory} />)}</div>;
}
