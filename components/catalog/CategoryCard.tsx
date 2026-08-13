"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, LayoutGrid } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import {
  localizeCategory,
  localizeTool,
  toolCountByCategory,
  tools,
  type CategoryDefinition,
} from "@/lib/catalog";
import { ToolIcon } from "../ToolIcon";

type CategoryCardProps = {
  category: CategoryDefinition;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function CategoryCard({ category, open, onToggle, onClose }: CategoryCardProps) {
  const { locale, copy } = useApp();
  const localized = localizeCategory(category, locale);
  const count = toolCountByCategory[category.id];
  const categoryTools = tools.filter((tool) => tool.category === category.id);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={`category-card${open ? " is-open" : ""}`} ref={cardRef}>
      <button
        type="button"
        className="category-card-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="category-card-top">
          <span className="category-icon"><ToolIcon name={category.icon} size={22} /></span>
          <ChevronDown className="category-card-chevron" size={18} />
        </span>
        <span className="category-card-name">{localized.name}</span>
        <span className="category-card-description">{localized.description}</span>
        <span className="category-card-count">{count} {count === 1 ? copy.category.tool : copy.category.tools}</span>
      </button>
      <div className="category-card-popover" hidden={!open}>
        <div className="category-card-tools">
          {categoryTools.map((tool) => (
            <Link key={tool.id} href={`/tools/${tool.slug}`} onClick={onClose}>
              {localizeTool(tool, locale).name}
              <ArrowUpRight size={13} />
            </Link>
          ))}
          <Link className="category-card-view-all" href={`/category/${category.slug}`} onClick={onClose}>
            <LayoutGrid size={14} />
            <span>{locale === "pt-BR" ? "Ver categoria" : "View category"}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CategoryGrid({ categories }: { categories: readonly CategoryDefinition[] }) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const handleClose = useCallback(() => setOpenCategoryId(null), []);

  return (
    <div className="category-grid">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          open={openCategoryId === category.id}
          onToggle={() => setOpenCategoryId((current) => current === category.id ? null : category.id)}
          onClose={handleClose}
        />
      ))}
    </div>
  );
}
