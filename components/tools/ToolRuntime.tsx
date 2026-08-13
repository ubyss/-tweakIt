"use client";

import { Suspense, lazy } from "react";
import type { ToolDefinition } from "@/lib/catalog";

const TextFormatter = lazy(() => import("./TextFormatter").then(module => ({ default: module.TextFormatter })));
const GenericTool = lazy(() => import("./GenericTool").then(module => ({ default: module.GenericTool })));
const ImageTool = lazy(() => import("./ImageTool").then(module => ({ default: module.ImageTool })));
const QrTool = lazy(() => import("./QrTool").then(module => ({ default: module.QrTool })));
const CurrencyTool = lazy(() => import("./CurrencyTool").then(module => ({ default: module.CurrencyTool })));

const imageIds = new Set(["image-converter", "image-compressor", "image-resizer", "image-cropper", "base64-image-converter", "image-color-picker"]);
const qrIds = new Set(["qr-code-generator", "wifi-qr-code-generator", "qr-code-reader"]);

function RuntimeLoading() {
  return <div className="runtime-loading"><span /><span /><span /><span /></div>;
}

export function ToolRuntime({ tool }: { tool: ToolDefinition }) {
  let Content = GenericTool;
  if (tool.id === "text-formatter") Content = TextFormatter;
  else if (tool.id === "currency-converter") Content = CurrencyTool;
  else if (imageIds.has(tool.id)) Content = ImageTool;
  else if (qrIds.has(tool.id)) Content = QrTool;
  return <Suspense fallback={<RuntimeLoading />}><Content key={tool.id} tool={tool} /></Suspense>;
}
