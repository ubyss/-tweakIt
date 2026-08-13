"use client";

import { Download, Image as ImageIcon, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/app/providers";
import type { ToolDefinition } from "@/lib/catalog";
import { CopyButton } from "@/components/tool/ToolActions";

const copyByLocale = {
  "pt-BR": {
    format: "Formato",
    quality: "Qualidade",
    width: "Largura",
    height: "Altura",
    keepRatio: "Manter proporção",
    file: "Escolha uma imagem",
    original: "Original",
    result: "Resultado",
    convert: "Processar imagem",
    download: "Baixar imagem",
    dataUrl: "Data URL Base64",
    base64Placeholder: "Cole uma data URL Base64 para restaurar a imagem...",
    x: "X",
    y: "Y",
    cropWidth: "Largura do recorte",
    cropHeight: "Altura do recorte",
    color: "Clique na imagem para capturar uma cor",
    error: "Não foi possível ler esta imagem.",
    fileSize: "Tamanho",
    dimensions: "Dimensões",
  },
  en: {
    format: "Format",
    quality: "Quality",
    width: "Width",
    height: "Height",
    keepRatio: "Keep aspect ratio",
    file: "Choose an image",
    original: "Original",
    result: "Result",
    convert: "Process image",
    download: "Download image",
    dataUrl: "Base64 data URL",
    base64Placeholder: "Paste a Base64 data URL to restore the image...",
    x: "X",
    y: "Y",
    cropWidth: "Crop width",
    cropHeight: "Crop height",
    color: "Click the image to pick a color",
    error: "This image could not be read.",
    fileSize: "Size",
    dimensions: "Dimensions",
  },
} as const;

function bytes(value: number) {
  return value < 1024 ? `${value} B` : value < 1048576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1048576).toFixed(1)} MB`;
}

export function ImageTool({ tool }: { tool: ToolDefinition }) {
  const { locale } = useApp();
  const ui = copyByLocale[locale];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [result, setResult] = useState("");
  const [format, setFormat] = useState("image/webp");
  const [quality, setQuality] = useState(82);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [keepRatio, setKeepRatio] = useState(true);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(0);
  const [cropHeight, setCropHeight] = useState(0);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (source.startsWith("blob:")) URL.revokeObjectURL(source); }, [source]);

  const loadSource = (nextSource: string, nextFile?: File) => {
    setError("");
    const image = new window.Image();
    image.onload = () => {
      imageRef.current = image;
      setWidth(image.naturalWidth);
      setHeight(image.naturalHeight);
      setCropWidth(image.naturalWidth);
      setCropHeight(image.naturalHeight);
      if (nextFile) setFile(nextFile);
      setSource(nextSource);
      if (tool.id === "base64-image-converter" && nextFile) {
        const reader = new FileReader();
        reader.onload = () => setResult(String(reader.result ?? ""));
        reader.readAsDataURL(nextFile);
      }
    };
    image.onerror = () => setError(ui.error);
    image.src = nextSource;
  };

  const handleFile = (nextFile: File | undefined) => {
    if (!nextFile) return;
    if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    loadSource(URL.createObjectURL(nextFile), nextFile);
  };

  const process = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const context = canvas.getContext("2d", { willReadFrequently: tool.id === "image-color-picker" });
    if (!context) return;
    const isCrop = tool.id === "image-cropper";
    const outputWidth = Math.max(1, Math.round(isCrop ? cropWidth : width));
    const outputHeight = Math.max(1, Math.round(isCrop ? cropHeight : height));
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.clearRect(0, 0, outputWidth, outputHeight);
    if (isCrop) context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
    else context.drawImage(image, 0, 0, outputWidth, outputHeight);
    const resultFormat = tool.id === "image-resizer" || tool.id === "image-cropper" ? file?.type || "image/png" : format;
    setResult(canvas.toDataURL(resultFormat, quality / 100));
  }, [cropHeight, cropWidth, cropX, cropY, file?.type, format, height, quality, tool.id, width]);

  useEffect(() => {
    if (source && tool.id !== "base64-image-converter" && tool.id !== "image-color-picker") process();
  }, [process, source, tool.id]);

  const updateWidth = (next: number) => {
    if (keepRatio && imageRef.current) setHeight(Math.round(next * imageRef.current.naturalHeight / imageRef.current.naturalWidth));
    setWidth(next);
  };
  const updateHeight = (next: number) => {
    if (keepRatio && imageRef.current) setWidth(Math.round(next * imageRef.current.naturalWidth / imageRef.current.naturalHeight));
    setHeight(next);
  };
  const download = () => {
    if (!result || tool.id === "base64-image-converter" && !result.startsWith("data:image")) return;
    const link = document.createElement("a");
    link.href = result;
    link.download = `toolsy-${tool.id}.${result.includes("image/jpeg") ? "jpg" : result.includes("image/webp") ? "webp" : "png"}`;
    link.click();
  };
  const pickColorAt = (clientX: number, clientY: number, target: HTMLImageElement) => {
    const image = imageRef.current;
    if (!image) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0);
    const rect = target.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * image.naturalWidth);
    const y = Math.floor((clientY - rect.top) / rect.height * image.naturalHeight);
    const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
    const hex = `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`.toLocaleUpperCase();
    setPicked(`${hex}\nrgb(${red}, ${green}, ${blue})\nrgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(2)})\nX ${x}, Y ${y}`);
  };

  const isBase64 = tool.id === "base64-image-converter";
  const isPicker = tool.id === "image-color-picker";
  return (
    <div className="image-tool">
      <div className="image-tool-controls">
        <label className="image-upload"><Upload size={18} /><span>{ui.file}</span><input type="file" accept="image/*" onChange={event => handleFile(event.target.files?.[0])} /></label>
        {!isBase64 && !isPicker && tool.id !== "image-resizer" && tool.id !== "image-cropper" && <label className="field"><span>{ui.format}</span><select value={format} onChange={event => setFormat(event.target.value)}><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label>}
        {(tool.id === "image-compressor" || tool.id === "image-converter") && <label className="field"><span>{ui.quality}: {quality}%</span><input type="range" min="10" max="100" value={quality} onChange={event => setQuality(Number(event.target.value))} /></label>}
        {(tool.id === "image-resizer" || tool.id === "image-compressor" || tool.id === "image-converter") && <><label className="field"><span>{ui.width}</span><input type="number" min="1" value={width || ""} onChange={event => updateWidth(Number(event.target.value))} /></label><label className="field"><span>{ui.height}</span><input type="number" min="1" value={height || ""} onChange={event => updateHeight(Number(event.target.value))} /></label><label className="toggle-field"><input type="checkbox" checked={keepRatio} onChange={event => setKeepRatio(event.target.checked)} />{ui.keepRatio}</label></>}
        {tool.id === "image-cropper" && <><label className="field"><span>{ui.x}</span><input type="number" min="0" value={cropX} onChange={event => setCropX(Number(event.target.value))} /></label><label className="field"><span>{ui.y}</span><input type="number" min="0" value={cropY} onChange={event => setCropY(Number(event.target.value))} /></label><label className="field"><span>{ui.cropWidth}</span><input type="number" min="1" value={cropWidth || ""} onChange={event => setCropWidth(Number(event.target.value))} /></label><label className="field"><span>{ui.cropHeight}</span><input type="number" min="1" value={cropHeight || ""} onChange={event => setCropHeight(Number(event.target.value))} /></label></>}
      </div>
      {isBase64 && <div className="image-base64"><label className="field"><span>{ui.dataUrl}</span><textarea value={result} placeholder={ui.base64Placeholder} onChange={event => { setResult(event.target.value); if (event.target.value.startsWith("data:image")) loadSource(event.target.value); }} /></label><div className="tool-actions"><CopyButton value={result} /></div></div>}
      {error && <p className="result-message">{error}</p>}
      {!source ? <div className="image-empty"><ImageIcon size={32} /><p>{ui.file}</p></div> : (
        <div className="image-preview-grid">
          <div><div className="image-preview-title"><strong>{ui.original}</strong>{file && <span>{file.name} · {bytes(file.size)}</span>}</div><div className="image-preview-canvas">{isPicker ? <button className="image-pick-button" onClick={event => { const image = event.currentTarget.querySelector("img"); if (image) pickColorAt(event.clientX, event.clientY, image); }}><img src={source} alt={ui.original} className="is-picker" /></button> : <img src={source} alt={ui.original} />}</div></div>
          {!isPicker && !isBase64 && <div><div className="image-preview-title"><strong>{ui.result}</strong><button className="button button-secondary" onClick={download} disabled={!result}><Download size={16} />{ui.download}</button></div><div className="image-preview-canvas">{result && <img src={result} alt={ui.result} />}</div></div>}
          {isPicker && <div><div className="image-preview-title"><strong>{ui.result}</strong></div><div className="image-color-result"><span className="color-swatch" style={{ background: picked.split("\n")[0] || "transparent" }} />{picked ? <pre>{picked}</pre> : <p>{ui.color}</p>}<CopyButton value={picked} /></div></div>}
        </div>
      )}
      <canvas ref={canvasRef} hidden />
    </div>
  );
}
