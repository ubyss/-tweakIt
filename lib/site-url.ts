import { headers } from "next/headers";

export async function getRequestBaseUrl(): Promise<URL> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return new URL(`${protocol}://${host}`);
}
