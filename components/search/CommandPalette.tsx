"use client";

import { useEffect, useRef } from "react";
import { Command, CornerDownLeft } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { SearchBox } from "./SearchBox";

export function CommandPalette() {
  const { commandOpen, setCommandOpen, copy } = useApp();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!commandOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCommandOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter(element => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("keydown", onKeyDown); document.body.classList.remove("modal-open"); previous?.focus(); };
  }, [commandOpen, setCommandOpen]);
  if (!commandOpen) return null;
  return (
    <div className="command-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && setCommandOpen(false)}>
      <div className="command-palette" ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.search.dialogTitle}>
        <div className="command-label"><Command size={16} /><span>{copy.search.dialogTitle}</span><button onClick={() => setCommandOpen(false)}>{copy.search.close}<kbd>Esc</kbd></button></div>
        <SearchBox compact onNavigate={() => setCommandOpen(false)} />
        <div className="command-help"><span>↑↓ {copy.search.navigate}</span><span><CornerDownLeft size={13} /> {copy.search.select}</span></div>
      </div>
    </div>
  );
}
