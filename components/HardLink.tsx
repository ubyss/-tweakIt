"use client";

import type { MouseEvent, ReactNode } from "react";

type HardLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  tabIndex?: number;
  "aria-label"?: string;
  "data-nav"?: string;
};

/**
 * Full document navigation.
 * vinext soft-nav via next/link can stall on some hosts (e.g. Vercel + Nitro)
 * while still working in local Cloudflare/vite dev.
 */
export function HardLink({
  href,
  className,
  children,
  onNavigate,
  tabIndex,
  "aria-label": ariaLabel,
  "data-nav": dataNav,
}: HardLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    onNavigate?.();
    window.location.assign(href);
  };

  return (
    <a
      href={href}
      className={className}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      data-nav={dataNav}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
