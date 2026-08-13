import type { CategoryDefinition } from "./types";

export const categories = [
  {
    id: "crypto",
    slug: "crypto",
    icon: "shield",
    translations: {
      "pt-BR": {
        name: "Cripto",
        description: "Gere, inspecione e proteja dados sensíveis localmente.",
      },
      en: {
        name: "Crypto",
        description: "Generate, inspect, and protect sensitive data locally.",
      },
    },
  },
  {
    id: "converters",
    slug: "converters",
    icon: "repeat",
    translations: {
      "pt-BR": {
        name: "Conversores",
        description: "Converta textos, datas, cores e números entre formatos.",
      },
      en: {
        name: "Converters",
        description: "Convert text, dates, colors, and numbers between formats.",
      },
    },
  },
  {
    id: "web",
    slug: "web",
    icon: "globe",
    translations: {
      "pt-BR": {
        name: "Web",
        description: "Utilitários rápidos para URLs, navegadores e padrões web.",
      },
      en: {
        name: "Web",
        description: "Quick utilities for URLs, browsers, and web standards.",
      },
    },
  },
  {
    id: "images-video",
    slug: "images-video",
    icon: "image",
    translations: {
      "pt-BR": {
        name: "Imagens & Vídeos",
        description: "Converta, compacte e prepare mídia sem enviar arquivos.",
      },
      en: {
        name: "Images & Video",
        description: "Convert, compress, and prepare media without uploading files.",
      },
    },
  },
  {
    id: "development",
    slug: "development",
    icon: "terminal",
    translations: {
      "pt-BR": {
        name: "Desenvolvimento",
        description: "Formate código e resolva tarefas comuns de desenvolvimento.",
      },
      en: {
        name: "Development",
        description: "Format code and solve common development tasks.",
      },
    },
  },
  {
    id: "network",
    slug: "network",
    icon: "network",
    translations: {
      "pt-BR": {
        name: "Rede",
        description: "Calcule e inspecione endereços, sub-redes e portas.",
      },
      en: {
        name: "Network",
        description: "Calculate and inspect addresses, subnets, and ports.",
      },
    },
  },
  {
    id: "math",
    slug: "math",
    icon: "calculator",
    translations: {
      "pt-BR": {
        name: "Matemática",
        description: "Faça cálculos cotidianos com respostas imediatas.",
      },
      en: {
        name: "Math",
        description: "Handle everyday calculations with immediate answers.",
      },
    },
  },
  {
    id: "measurements",
    slug: "measurements",
    icon: "ruler",
    translations: {
      "pt-BR": {
        name: "Medidas",
        description: "Converta unidades físicas e digitais com precisão.",
      },
      en: {
        name: "Measurements",
        description: "Convert physical and digital units accurately.",
      },
    },
  },
  {
    id: "text",
    slug: "text",
    icon: "type",
    translations: {
      "pt-BR": {
        name: "Texto",
        description: "Formate, limpe e transforme textos.",
      },
      en: {
        name: "Text",
        description: "Format, clean, and transform text.",
      },
    },
  },
  {
    id: "data",
    slug: "data",
    icon: "database",
    translations: {
      "pt-BR": {
        name: "Dados",
        description: "Valide, formate e converta dados estruturados.",
      },
      en: {
        name: "Data",
        description: "Validate, format, and convert structured data.",
      },
    },
  },
] as const satisfies readonly CategoryDefinition[];
