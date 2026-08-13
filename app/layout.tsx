import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { AppShell } from "@/components/AppShell";
import { getRequestBaseUrl } from "@/lib/site-url";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestBaseUrl();
  return {
    metadataBase,
    title: { default: "TweakIt — Ferramentas simples para transformar qualquer coisa", template: "%s · TweakIt" },
    description: "Ferramentas rápidas e privadas para texto, dados, desenvolvimento, imagens, conversões e muito mais.",
    applicationName: "TweakIt",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: "TweakIt",
      title: "TweakIt — Everything you need to tweak.",
      description: "Encontre a ferramenta certa em segundos. Rápida, bilíngue e privada.",
      images: [{ url: "/og.png", width: 1661, height: 947, alt: "TweakIt — Everything you need to tweak." }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
