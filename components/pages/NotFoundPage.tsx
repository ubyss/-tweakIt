"use client";

import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { SearchBox } from "../search/SearchBox";

export function NotFoundPage() {
  const { copy } = useApp();
  return (
    <div className="not-found-page page-container">
      <div className="not-found-code">404</div>
      <SearchX size={32} />
      <h1>{copy.notFound.title}</h1>
      <p>{copy.notFound.subtitle}</p>
      <div className="not-found-search"><SearchBox /></div>
      <Link href="/" className="button button-ghost"><ArrowLeft size={16} />{copy.notFound.back}</Link>
    </div>
  );
}
