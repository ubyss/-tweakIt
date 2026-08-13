"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Command, Heart, Home, LayoutGrid, Menu, Monitor, Moon, Search, Sun, X } from "lucide-react";
import { useApp, type Theme } from "@/lib/app-context";
import { categories, localizeCategory, localizeTool, tools } from "@/lib/catalog";
import { ToolIcon } from "./ToolIcon";
import { CommandPalette } from "./search/CommandPalette";

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="TweakIt — início">
      <span className="brand-mark"><span /><span /><span /><span /></span>
      <span>TweakIt</span>
    </Link>
  );
}

function LanguageSelector() {
  const { locale, copy, setLocale } = useApp();
  return (
    <div className="segmented-control" aria-label={copy.header.language}>
      <button className={locale === "pt-BR" ? "is-active" : ""} onClick={() => setLocale("pt-BR")} aria-pressed={locale === "pt-BR"}>PT</button>
      <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
    </div>
  );
}

function ThemeSelector() {
  const { theme, setTheme, copy } = useApp();
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: copy.theme.light, icon: Sun },
    { value: "dark", label: copy.theme.dark, icon: Moon },
    { value: "system", label: copy.theme.system, icon: Monitor },
  ];
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === theme) ?? options[2];
  const SelectedIcon = selected.icon;
  return (
    <div className="theme-menu">
      <button className="icon-button theme-trigger" onClick={() => setOpen(current => !current)} aria-label={`${copy.header.theme}: ${selected.label}`} aria-expanded={open}>
        <SelectedIcon size={18} /><ChevronDown size={13} />
      </button>
      {open && (
        <div className="theme-popover" role="menu">
          {options.map(option => {
            const Icon = option.icon;
            return (
              <button key={option.value} role="menuitem" onClick={() => { setTheme(option.value); setOpen(false); }}>
                <Icon size={16} /><span>{option.label}</span>{theme === option.value && <Check size={15} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { locale, copy } = useApp();
  const activeCategoryId = categories.find((category) => {
    const categoryTools = tools.filter((tool) => tool.category === category.id);
    return pathname === `/category/${category.slug}` || categoryTools.some((tool) => pathname === `/tools/${tool.slug}`);
  })?.id ?? null;
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(activeCategoryId);

  useEffect(() => {
    setOpenCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  return (
    <nav className="side-nav" aria-label={copy.nav.categories}>
      <Link href="/" onClick={close} className={pathname === "/" ? "is-active" : ""}><Home size={18} /><span>{copy.nav.home}</span></Link>
      <p>{copy.nav.categories}</p>
      {categories.map((category) => {
        const categoryTools = tools.filter((tool) => tool.category === category.id);
        const isOpen = openCategoryId === category.id;
        return (
          <div className={`side-category${isOpen ? " is-open" : ""}`} key={category.id}>
            <button
              type="button"
              className="side-category-trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenCategoryId((current) => current === category.id ? null : category.id)}
            >
              <ToolIcon name={category.icon} size={18} />
              <span>{localizeCategory(category, locale).name}</span>
              <ChevronDown className="side-category-chevron" size={15} />
            </button>
            <div className="side-category-panel" aria-hidden={!isOpen}>
              <div className="side-category-tools">
                <Link
                  href={`/category/${category.slug}`}
                  onClick={close}
                  className={`side-category-view-all${pathname === `/category/${category.slug}` ? " is-active" : ""}`}
                  tabIndex={isOpen ? undefined : -1}
                >
                  <LayoutGrid size={14} />
                  <span>{locale === "pt-BR" ? "Ver todas" : "View all"}</span>
                </Link>
                {categoryTools.map((tool) => (
                  <Link key={tool.id} href={`/tools/${tool.slug}`} onClick={close} className={pathname === `/tools/${tool.slug}` ? "is-active" : ""} tabIndex={isOpen ? undefined : -1}>
                    {localizeTool(tool, locale).name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <p className="side-nav-divider" />
      <Link href="/favorites" onClick={close} className={pathname === "/favorites" ? "is-active" : ""}><Heart size={18} /><span>{copy.nav.favorites}</span></Link>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { copy, setCommandOpen } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])")).filter(element => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus(), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKeyDown); document.body.classList.remove("modal-open"); previous?.focus(); };
  }, [drawerOpen]);
  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="header-inner">
          <button className="icon-button mobile-menu-button" onClick={() => setDrawerOpen(true)} aria-label={copy.nav.menu}><Menu size={20} /></button>
          <Brand />
          <button className="header-search" onClick={() => setCommandOpen(true)}>
            <Search size={17} />
            <span>{copy.header.search}</span>
            <kbd><Command size={12} />K</kbd>
          </button>
          <div className="header-actions"><LanguageSelector /><ThemeSelector /></div>
        </div>
      </header>
      <div className="shell-grid">
        <aside className="desktop-sidebar"><SidebarContent /></aside>
        <main className="main-content">{children}</main>
      </div>
      {drawerOpen && (
        <div className="drawer-layer" role="presentation">
          <button className="drawer-backdrop" aria-label={copy.nav.close} onClick={() => setDrawerOpen(false)} />
          <aside className="mobile-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label={copy.nav.menu}>
            <div className="drawer-header"><Brand /><button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label={copy.nav.close}><X size={20} /></button></div>
            <SidebarContent close={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}
      <CommandPalette />
    </div>
  );
}

export function Footer() {
  const { copy } = useApp();
  return (
    <footer className="site-footer">
      <div><span className="status-dot" /> <strong>{copy.footer.privacy}</strong><span>{copy.footer.detail}</span></div>
      <p>TweakIt · {copy.footer.built}</p>
    </footer>
  );
}
