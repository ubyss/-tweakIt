import type { Metadata } from "next";
import { HomePage } from "@/components/pages/HomePage";

export const metadata: Metadata = {
  title: { absolute: "Toolsy — Uma ferramenta para cada tarefa" },
  description: "Conversores, formatadores, ferramentas de desenvolvimento e utilitários rápidos, privados e fáceis de encontrar.",
};

export default function Home() {
  return <HomePage />;
}
