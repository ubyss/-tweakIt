import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getRequestBaseUrl } from "@/lib/site-url";
import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getRequestBaseUrl();
  return {
    metadataBase,
    title: { default: "Toolsy — Uma ferramenta para cada tarefa", template: "%s · Toolsy" },
    description: "Ferramentas rápidas e privadas para texto, dados, desenvolvimento, imagens, conversões e muito mais.",
    applicationName: "Toolsy",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: "Toolsy",
      title: "Toolsy — Uma ferramenta para cada tarefa",
      description: "Encontre a ferramenta certa em segundos. Rápida, bilíngue e privada.",
      images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Toolsy — Uma ferramenta para cada tarefa" }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  );
}
