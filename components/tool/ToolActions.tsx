"use client";

import { Check, Clipboard, Download, Eraser, Repeat2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/app/providers";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { copy } = useApp();
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };
  return <button className="button button-secondary" onClick={onCopy} disabled={!value}><span>{copied ? <Check size={16} /> : <Clipboard size={16} />}</span>{copied ? copy.tool.copied : label ?? copy.tool.copy}</button>;
}

export function ClearButton({ onClear }: { onClear: () => void }) {
  const { copy } = useApp();
  return <button className="button button-ghost" onClick={onClear}><Eraser size={16} />{copy.tool.clear}</button>;
}

export function SwapButton({ onSwap, disabled }: { onSwap: () => void; disabled?: boolean }) {
  const { copy } = useApp();
  return <button className="button button-ghost" onClick={onSwap} disabled={disabled}><Repeat2 size={16} />{copy.tool.swap}</button>;
}

export function DownloadButton({ value, fileName = "toolsy-result.txt", label }: { value: string; fileName?: string; label?: string }) {
  const { copy } = useApp();
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <button className="button button-secondary" onClick={download} disabled={!value}><Download size={16} />{label ?? copy.tool.download}</button>;
}

export function ToolStats({ value }: { value: string }) {
  const { locale, copy } = useApp();
  const chars = typeof Intl.Segmenter === "function" ? Array.from(new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(value)).length : Array.from(value).length;
  const words = value.trim() ? (typeof Intl.Segmenter === "function" ? Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(value)).filter(part => part.isWordLike).length : value.trim().split(/\s+/u).length) : 0;
  const lines = value ? value.split(/\r\n?|\n/u).length : 0;
  const bytes = new TextEncoder().encode(value).length;
  const size = bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  return (
    <div className="tool-stats" aria-label={`${chars} ${copy.stats.characters}, ${words} ${copy.stats.words}, ${lines} ${copy.stats.lines}`}>
      <span><strong>{chars.toLocaleString(locale)}</strong> {copy.stats.characters}</span>
      <span><strong>{words.toLocaleString(locale)}</strong> {copy.stats.words}</span>
      <span><strong>{lines.toLocaleString(locale)}</strong> {copy.stats.lines}</span>
      <span><strong>{size}</strong> {copy.stats.bytes}</span>
    </div>
  );
}
