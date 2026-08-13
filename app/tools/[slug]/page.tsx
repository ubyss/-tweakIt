import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPageShell } from "@/components/tool/ToolPageShell";
import { ToolRuntime } from "@/components/tools/ToolRuntime";
import { getToolBySlug, localizeTool, tools } from "@/lib/catalog";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return tools.map(tool => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  const localized = localizeTool(tool, "pt-BR");
  return {
    title: localized.name,
    description: localized.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: `${localized.name} · TweakIt`, description: localized.description, url: `/tools/${tool.slug}` },
  };
}

export default async function ToolRoute({ params }: PageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();
  return <ToolPageShell tool={tool}><ToolRuntime tool={tool} /></ToolPageShell>;
}
