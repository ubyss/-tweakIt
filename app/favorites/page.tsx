import type { Metadata } from "next";
import { FavoritesPage } from "@/components/pages/FavoritesPage";

export const metadata: Metadata = { title: "Favoritos", description: "Suas ferramentas favoritas no Toolsy." };

export default function FavoritesRoute() {
  return <FavoritesPage />;
}
