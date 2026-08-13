import type { MetadataRoute } from "next";
import { categories, tools } from "@/lib/catalog";
import { getRequestBaseUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (await getRequestBaseUrl()).origin;
  return [
    { url: base, priority: 1 },
    ...categories.map(category => ({ url: `${base}/category/${category.slug}`, priority: .8 })),
    ...tools.map(tool => ({ url: `${base}/tools/${tool.slug}`, priority: .7 })),
  ];
}
