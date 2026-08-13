"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useApp } from "@/app/providers";
import { categories, getToolById, type ToolDefinition } from "@/lib/catalog";
import { CategoryCard } from "../catalog/CategoryCard";
import { ToolGrid } from "../catalog/ToolCard";
import { Footer } from "../AppShell";
import { SearchBox } from "../search/SearchBox";

export function HomePage() {
  const { copy, favorites, recents } = useApp();
  const favoriteTools = favorites.map(getToolById).filter((tool): tool is ToolDefinition => Boolean(tool));
  const recentTools = recents.map(getToolById).filter((tool): tool is ToolDefinition => Boolean(tool));
  return (
    <div className="home-page">
      <section className="hero page-container">
        <div className="hero-eyebrow"><Sparkles size={15} />{copy.home.eyebrow}</div>
        <h1>{copy.home.title}</h1>
        <p>{copy.home.subtitle}</p>
        <div className="hero-search"><SearchBox /></div>
        <div className="hero-privacy"><LockKeyhole size={14} />{copy.tool.local}</div>
      </section>
      <div className="page-container home-sections">
        {favoriteTools.length > 0 && (
          <section className="home-tools-section">
            <div className="section-heading"><div><span className="section-kicker">01</span><h2>{copy.home.favorites}</h2></div><Link href="/favorites">{copy.home.viewAll}<ArrowRight size={15} /></Link></div>
            <ToolGrid tools={favoriteTools.slice(0, 6)} />
          </section>
        )}
        {recentTools.length > 0 && (
          <section className="home-tools-section">
            <div className="section-heading"><div><span className="section-kicker">{favoriteTools.length ? "02" : "01"}</span><h2>{copy.home.recent}</h2></div></div>
            <ToolGrid tools={recentTools.slice(0, 6)} />
          </section>
        )}
        <section className="categories-section">
          <div className="section-heading section-heading-large"><div><span className="section-kicker">{favoriteTools.length || recentTools.length ? "03" : "01"}</span><h2>{copy.home.categories}</h2><p>{copy.home.categoriesSubtitle}</p></div></div>
          <div className="category-grid">{categories.map(category => <CategoryCard key={category.id} category={category} />)}</div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
