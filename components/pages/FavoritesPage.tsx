"use client";

import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { useApp } from "@/app/providers";
import { getToolById, type ToolDefinition } from "@/lib/catalog";
import { Footer } from "../AppShell";
import { ToolGrid } from "../catalog/ToolCard";

export function FavoritesPage() {
  const { favorites, copy } = useApp();
  const tools = favorites.map(getToolById).filter((tool): tool is ToolDefinition => Boolean(tool));
  return (
    <div>
      <div className="page-container listing-page">
        <header><span className="page-icon"><Heart size={24} /></span><h1>{copy.favorites.title}</h1><p>{copy.favorites.subtitle}</p></header>
        {tools.length > 0 ? <ToolGrid tools={tools} showCategory /> : <div className="empty-state favorites-empty"><Heart size={30} /><h2>{copy.favorites.empty}</h2><Link className="button button-primary" href="/"><span>{copy.favorites.action}</span><ArrowRight size={16} /></Link></div>}
      </div>
      <Footer />
    </div>
  );
}
