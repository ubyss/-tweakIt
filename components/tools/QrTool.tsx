"use client";

import { Download, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import type { ToolDefinition } from "@/lib/catalog";

const labels = {
  "pt-BR": { content: "Conteúdo", placeholder: "Digite texto, URL ou qualquer conteúdo...", size: "Tamanho", margin: "Margem", level: "Correção de erro", download: "Baixar PNG", ssid: "Nome da rede (SSID)", password: "Senha", security: "Segurança", hidden: "Rede oculta", scan: "Escolher imagem com QR Code", result: "Conteúdo lido", unsupported: "A leitura de QR Code não está disponível neste navegador.", empty: "Preencha os dados para gerar o QR Code." },
  en: { content: "Content", placeholder: "Enter text, URL, or any content...", size: "Size", margin: "Margin", level: "Error correction", download: "Download PNG", ssid: "Network name (SSID)", password: "Password", security: "Security", hidden: "Hidden network", scan: "Choose QR Code image", result: "Scanned content", unsupported: "QR Code scanning is not available in this browser.", empty: "Fill in the details to generate the QR Code." },
} as const;

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> };

export function QrTool({ tool }: { tool: ToolDefinition }) {
  const { locale } = useApp();
  const ui = labels[locale];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [content, setContent] = useState("https://tweakit.local");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState("WPA");
  const [hidden, setHidden] = useState(false);
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const [level, setLevel] = useState("M");
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState("");
  const value = tool.id === "wifi-qr-code-generator" ? `WIFI:T:${security};S:${ssid.replace(/([\\;,:"])/g, "\\$1")};P:${password.replace(/([\\;,:"])/g, "\\$1")};H:${hidden ? "true" : "false"};;` : content;

  useEffect(() => {
    if (tool.id === "qr-code-reader" || !value || !canvasRef.current) return;
    let active = true;
    import("qrcode").then(module => module.toCanvas(canvasRef.current, value, { width: size, margin, errorCorrectionLevel: level as "L" | "M" | "Q" | "H", color: { dark: "#181917", light: "#ffffff" } })).then(() => active && setError("")).catch(errorValue => active && setError(errorValue instanceof Error ? errorValue.message : "QR error"));
    return () => { active = false; };
  }, [value, size, margin, level, tool.id]);

  const download = () => {
    const link = document.createElement("a");
    link.href = canvasRef.current?.toDataURL("image/png") ?? "";
    link.download = "tweakit-qr-code.png";
    link.click();
  };

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) throw new Error(ui.unsupported);
      const bitmap = await createImageBitmap(file);
      const values = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
      bitmap.close();
      setScanResult(values[0]?.rawValue ?? "");
      if (!values.length) throw new Error(ui.unsupported.replace(/not available|não está disponível/iu, locale === "pt-BR" ? "não foi encontrado" : "was not found"));
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : ui.unsupported);
    }
  };

  if (tool.id === "qr-code-reader") {
    return (
      <div className="qr-tool qr-reader">
        <label className="image-upload"><QrCode size={18} /><span>{ui.scan}</span><input type="file" accept="image/*" onChange={event => scan(event.target.files?.[0])} /></label>
        {error && <p className="result-message">{error}</p>}
        <label className="field"><span>{ui.result}</span><textarea readOnly value={scanResult} /></label>
      </div>
    );
  }

  return (
    <div className="qr-tool">
      <div className="qr-config">
        {tool.id === "wifi-qr-code-generator" ? <><label className="field"><span>{ui.ssid}</span><input value={ssid} onChange={event => setSsid(event.target.value)} /></label><label className="field"><span>{ui.password}</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field"><span>{ui.security}</span><select value={security} onChange={event => setSecurity(event.target.value)}><option>WPA</option><option>WEP</option><option value="nopass">None</option></select></label><label className="toggle-field"><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} />{ui.hidden}</label></> : <label className="field qr-content-field"><span>{ui.content}</span><textarea value={content} placeholder={ui.placeholder} onChange={event => setContent(event.target.value)} /></label>}
        <div className="qr-options"><label className="field"><span>{ui.size}</span><select value={size} onChange={event => setSize(Number(event.target.value))}><option value="240">240 px</option><option value="320">320 px</option><option value="480">480 px</option><option value="720">720 px</option></select></label><label className="field"><span>{ui.margin}</span><input type="number" min="0" max="10" value={margin} onChange={event => setMargin(Number(event.target.value))} /></label><label className="field"><span>{ui.level}</span><select value={level} onChange={event => setLevel(event.target.value)}><option>L</option><option>M</option><option>Q</option><option>H</option></select></label></div>
      </div>
      <div className="qr-preview"><div className="qr-canvas-wrap">{value ? <canvas ref={canvasRef} /> : <div className="image-empty"><QrCode size={30} /><p>{ui.empty}</p></div>}</div><button className="button button-primary" onClick={download} disabled={!value}><Download size={16} />{ui.download}</button>{error && <p className="result-message">{error}</p>}</div>
    </div>
  );
}
