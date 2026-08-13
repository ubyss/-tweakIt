"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { categories, getToolById, type ToolDefinition } from "@/lib/catalog";
import { CategoryGrid } from "../catalog/CategoryCard";
import { ToolGrid } from "../catalog/ToolCard";
import { Footer } from "../AppShell";
import { SearchBox } from "../search/SearchBox";

export function HomePage() {
  const { copy, favorites, recents, storageReady } = useApp();
  const favoriteTools = favorites.map(getToolById).filter((tool): tool is ToolDefinition => Boolean(tool));
  const recentTools = recents.map(getToolById).filter((tool): tool is ToolDefinition => Boolean(tool));
  const hasFavorites = storageReady && favoriteTools.length > 0;
  const hasRecents = storageReady && recentTools.length > 0;

  return (
    <div className="home-page">
      <section className="hero page-container">
        <div className="hero-eyebrow"><Sparkles size={15} />{copy.home.eyebrow}</div>
        <h1>{copy.home.title}</h1>
        <p>{copy.home.subtitle}</p>
        <div className="hero-search"><SearchBox /></div>
        <div className="hero-privacy"><LockKeyhole size={14} />{copy.tool.local}</div>
      </section>
      <div
        className={`page-container home-sections${storageReady ? " page-cascade home-sections--ready" : " home-sections--pending"}`}
      >
        {hasFavorites && (
          <section className="home-tools-section">
            <div className="section-heading"><div><span className="section-kicker">01</span><h2>{copy.home.favorites}</h2></div><Link href="/favorites">{copy.home.viewAll}<ArrowRight size={15} /></Link></div>
            <ToolGrid tools={favoriteTools.slice(0, 6)} />
          </section>
        )}
        {hasRecents && (
          <section className="home-tools-section">
            <div className="section-heading"><div><span className="section-kicker">{hasFavorites ? "02" : "01"}</span><h2>{copy.home.recent}</h2></div></div>
            <ToolGrid tools={recentTools.slice(0, 6)} />
          </section>
        )}
        <section className="categories-section">
          <div className="section-heading section-heading-large"><div><span className="section-kicker">{hasFavorites || hasRecents ? "03" : "01"}</span><h2>{copy.home.categories}</h2><p>{copy.home.categoriesSubtitle}</p></div></div>
          <CategoryGrid categories={categories} />
        </section>
      </div>
      <Footer />
    </div>
  );
}
