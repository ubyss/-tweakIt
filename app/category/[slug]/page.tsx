import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryPage } from "@/components/pages/CategoryPage";
import { categories, getCategoryBySlug, localizeCategory, tools } from "@/lib/catalog";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return categories.map(category => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return {};
  const localized = localizeCategory(category, "pt-BR");
  return { title: localized.name, description: localized.description, alternates: { canonical: `/category/${category.slug}` } };
}

export default async function CategoryRoute({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();
  return <CategoryPage category={category} tools={tools.filter(tool => tool.category === category.id)} />;
}
