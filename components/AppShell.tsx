"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Command, Heart, Home, Menu, Monitor, Moon, Search, Sun, X } from "lucide-react";
import { useApp, type Theme } from "@/app/providers";
import { categories, localizeCategory } from "@/lib/catalog";
import { ToolIcon } from "./ToolIcon";
import { CommandPalette } from "./search/CommandPalette";

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Toolsy — início">
      <span className="brand-mark"><span /><span /><span /><span /></span>
      <span>Toolsy</span>
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
  return (
    <nav className="side-nav" aria-label={copy.nav.categories}>
      <Link href="/" onClick={close} className={pathname === "/" ? "is-active" : ""}><Home size={18} /><span>{copy.nav.home}</span></Link>
      <p>{copy.nav.categories}</p>
      {categories.map(category => (
        <Link key={category.id} href={`/category/${category.slug}`} onClick={close} className={pathname === `/category/${category.slug}` ? "is-active" : ""}>
          <ToolIcon name={category.icon} size={18} />
          <span>{localizeCategory(category, locale).name}</span>
        </Link>
      ))}
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
      <p>Toolsy · {copy.footer.built}</p>
    </footer>
  );
}
