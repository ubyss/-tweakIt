import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(() => server.close());

test("catalog invariants remain valid", async () => {
  const [{ validateCatalog }, { categories, tools }] = await Promise.all([
    server.ssrLoadModule("/lib/catalog/validate.ts"),
    server.ssrLoadModule("/lib/catalog/index.ts"),
  ]);
  assert.equal(categories.length, 10);
  assert.equal(tools.length, 86);
  assert.deepEqual(validateCatalog(), { valid: true, errors: [] });
});

test("intent search works across Portuguese and English", async () => {
  const { searchTools } = await server.ssrLoadModule("/lib/search/index.ts");
  const cases = [
    ["remove spaces", "text-formatter"],
    ["remover espaco em branco", "text-formatter"],
    ["wifi senha qr", "wifi-qr-code-generator"],
    ["remover acentuacao", "text-formatter"],
    ["porcentagem", "percentage-calculator"],
  ];
  for (const [query, expectedId] of cases) {
    assert.equal(searchTools(query, "pt-BR", { limit: 1 })[0]?.id, expectedId, query);
  }
  const minifiers = searchTools("minificar texto", "en", { limit: 12 }).map(result => result.id);
  assert.ok(minifiers.includes("text-formatter"));
  assert.ok(minifiers.some(id => id !== "text-formatter"));
});

test("formatter pipeline composes operations deterministically", async () => {
  const { createOperationInstance, runPipeline } = await server.ssrLoadModule("/lib/text-formatter/index.ts");
  const steps = [createOperationInstance("removeExtraSpaces"), createOperationInstance("trim")].filter(Boolean);
  const result = await runPipeline("  OlÃ¡   mundo  ", steps, "pt-BR");
  assert.equal(result.text, "OlÃ¡ mundo");
  assert.ok(result.executions.every(execution => execution.status === "success"));
});
