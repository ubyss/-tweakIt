"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "@/app/providers";
import { localizeCategory, toolCountByCategory, type CategoryDefinition } from "@/lib/catalog";
import { ToolIcon } from "../ToolIcon";

export function CategoryCard({ category }: { category: CategoryDefinition }) {
  const { locale, copy } = useApp();
  const localized = localizeCategory(category, locale);
  const count = toolCountByCategory[category.id];
  return (
    <Link className="category-card" href={`/category/${category.slug}`}>
      <span className="category-card-top"><span className="category-icon"><ToolIcon name={category.icon} size={22} /></span><ArrowUpRight size={18} /></span>
      <span className="category-card-name">{localized.name}</span>
      <span className="category-card-description">{localized.description}</span>
      <span className="category-card-count">{count} {count === 1 ? copy.category.tool : copy.category.tools}</span>
    </Link>
  );
}
