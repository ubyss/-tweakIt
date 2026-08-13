import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      IMAGES: { input() { throw new Error("Image optimization is not used in this test"); } },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the TweakIt home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>TweakIt[^<]*Ferramentas simples para transformar qualquer coisa[^<]*<\/title>/i);
  assert.match(html, /Ferramentas simples para transformar qualquer coisa/);
  assert.match(html, /O que você precisa fazer/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("renders direct category and tool URLs", async () => {
  const [categoryResponse, toolResponse] = await Promise.all([
    render("/category/text"),
    render("/tools/text-formatter"),
  ]);
  assert.equal(categoryResponse.status, 200);
  assert.equal(toolResponse.status, 200);
  assert.match(await categoryResponse.text(), /<h1>Texto<\/h1>/);
  assert.match(await toolResponse.text(), /Formatador de Texto/);
});

test("rejects unknown category and tool slugs", async () => {
  const [categoryResponse, toolResponse] = await Promise.all([
    render("/category/unknown-category"),
    render("/tools/unknown-tool"),
  ]);
  assert.equal(categoryResponse.status, 404);
  assert.equal(toolResponse.status, 404);
});

test("returns a useful not-found page", async () => {
  const response = await render("/does-not-exist");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Não encontrou o que queria/);
  assert.match(html, /O que você precisa fazer/);
});
