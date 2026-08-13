import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

type HostingConfig = {
  d1?: string | null;
  r2?: string | null;
};

function readHostingConfig(): HostingConfig {
  const hostingPath = resolve(process.cwd(), ".openai", "hosting.json");
  if (!existsSync(hostingPath)) return { d1: null, r2: null };
  try {
    return JSON.parse(readFileSync(hostingPath, "utf8")) as HostingConfig;
  } catch {
    return { d1: null, r2: null };
  }
}

const { d1, r2 } = readHostingConfig();

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const deployToVercel =
  process.env.VERCEL === "1" ||
  process.env.NITRO_PRESET === "vercel" ||
  process.env.NITRO_PRESET === "vercel_edge";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  if (deployToVercel) {
    const { nitro } = await import("nitro/vite");
    return {
      plugins: [vinext(), sites(), tailwindcss(), nitro()],
    };
  }

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      tailwindcss(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
