import type { MetadataRoute } from "next";
import { getRequestBaseUrl } from "@/lib/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = (await getRequestBaseUrl()).origin;
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${base}/sitemap.xml` };
}
