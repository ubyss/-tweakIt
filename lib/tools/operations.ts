import { isPotentiallyUnsafeRegex } from "@/lib/text-formatter/text-utils";

export type ToolOptions = Record<string, string | number | boolean>;

export type ToolExecution = {
  output: string;
  status?: "success" | "error";
  message?: string;
  rows?: readonly (readonly string[])[];
};

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const size = 8192;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function decodeHtml(value: string) {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value;
}

function removeDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
}

function words(value: string) {
  return removeDiacritics(value)
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
    .match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

function toCase(value: string, mode: string) {
  const parts = words(value);
  if (mode === "upper") return value.toLocaleUpperCase();
  if (mode === "lower") return value.toLocaleLowerCase();
  if (mode === "title") return value.toLocaleLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => `${space}${letter.toLocaleUpperCase()}`);
  if (mode === "sentence") return value.toLocaleLowerCase().replace(/(^|[.!?]\s+|\n+)(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`);
  if (mode === "camel") return parts.map((part, index) => index ? `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1).toLocaleLowerCase()}` : part.toLocaleLowerCase()).join("");
  if (mode === "pascal") return parts.map(part => `${part[0]?.toLocaleUpperCase() ?? ""}${part.slice(1).toLocaleLowerCase()}`).join("");
  const separator = mode === "snake" || mode === "constant" ? "_" : mode === "dot" ? "." : "-";
  const result = parts.map(part => part.toLocaleLowerCase()).join(separator);
  return mode === "constant" ? result.toLocaleUpperCase() : result;
}

function romanize(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 3999) throw new Error("Use an integer from 1 to 3999");
  const pairs: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let remaining = value;
  let output = "";
  for (const [number, symbol] of pairs) while (remaining >= number) { output += symbol; remaining -= number; }
  return output;
}

function deromanize(value: string) {
  const symbols: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const normalized = value.trim().toLocaleUpperCase();
  if (!/^[IVXLCDM]+$/.test(normalized)) throw new Error("Invalid Roman numeral");
  let total = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = symbols[normalized[index]];
    const next = symbols[normalized[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  if (romanize(total) !== normalized) throw new Error("Invalid Roman numeral");
  return total;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > .5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
  }
  return [Math.round(hue * 360), Math.round(saturation * 100), Math.round(lightness * 100)] as const;
}

function parseColor(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return hex.split("").map(part => parseInt(`${part}${part}`, 16));
  if (/^[0-9a-f]{6}$/i.test(hex)) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return rgb.slice(1, 4).map(Number);
  throw new Error("Use HEX or RGB");
}

function jsonToXml(value: unknown, name = "root"): string {
  if (Array.isArray(value)) return value.map(item => jsonToXml(item, "item")).join("");
  if (value !== null && typeof value === "object") return `<${name}>${Object.entries(value).map(([key, child]) => jsonToXml(child, key.replace(/[^\w.-]/g, "_"))).join("")}</${name}>`;
  return `<${name}>${escapeHtml(String(value ?? ""))}</${name}>`;
}

function xmlNodeToValue(node: Element): unknown {
  const children = Array.from(node.children);
  if (!children.length) return node.textContent ?? "";
  const result: Record<string, unknown> = {};
  for (const child of children) {
    const value = xmlNodeToValue(child);
    const existing = result[child.tagName];
    result[child.tagName] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  if (node.attributes.length) result.$attributes = Object.fromEntries(Array.from(node.attributes).map(attribute => [attribute.name, attribute.value]));
  return result;
}

function parseCsv(input: string, delimiter = ",") {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toCsv(value: unknown) {
  if (!Array.isArray(value)) throw new Error("JSON must contain an array");
  const records = value.filter(item => item && typeof item === "object") as Record<string, unknown>[];
  const headers = Array.from(new Set(records.flatMap(record => Object.keys(record))));
  const quote = (item: unknown) => {
    const text = typeof item === "object" && item !== null ? JSON.stringify(item) : String(item ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(quote).join(","), ...records.map(record => headers.map(header => quote(record[header])).join(","))].join("\n");
}

function formatMarkup(value: string, type: "html" | "xml" | "svg") {
  const parser = new DOMParser();
  const mime = type === "html" ? "text/html" : "application/xml";
  const documentValue = parser.parseFromString(value, mime);
  if (type !== "html" && documentValue.querySelector("parsererror")) throw new Error("Invalid XML");
  const serialized = type === "html" ? documentValue.body.innerHTML : new XMLSerializer().serializeToString(documentValue);
  const tokens = serialized.replace(/>\s*</g, "><").split(/(?=<)|(?<=>)/g).filter(Boolean);
  let level = 0;
  return tokens.map(token => {
    const trimmed = token.trim();
    if (/^<\//.test(trimmed)) level = Math.max(0, level - 1);
    const line = `${"  ".repeat(level)}${trimmed}`;
    if (/^<[^!?/][^>]*[^/]>/u.test(trimmed) && !/<\/[^>]+>$/.test(trimmed) && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(trimmed)) level += 1;
    return line;
  }).join("\n");
}

function minifyMarkup(value: string) {
  return value.replace(/<!--([\s\S]*?)-->/g, "").replace(/>\s+</g, "><").trim();
}

function formatCss(value: string) {
  let level = 0;
  return value.replace(/\s+/g, " ").replace(/\s*([{};])\s*/g, "$1").split(/(?<=[{};])/).map(part => {
    const text = part.trim();
    if (!text) return "";
    if (text.startsWith("}")) level = Math.max(0, level - 1);
    const line = `${"  ".repeat(level)}${text}`;
    if (text.endsWith("{")) level += 1;
    return line;
  }).filter(Boolean).join("\n");
}

function minifyCode(value: string, type: string) {
  if (type === "css") return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>+~])\s*/g, "$1").trim();
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s+/g, " ").replace(/\s*([{}()[\];,:=+*<>])\s*/g, "$1").trim();
}

function formatJavascript(value: string) {
  let output = "";
  let level = 0;
  let quote = "";
  let escaped = false;
  let lineStart = true;
  const write = (text: string) => { if (lineStart && text !== "\n") { output += "  ".repeat(level); lineStart = false; } output += text; if (text.endsWith("\n")) lineStart = true; };
  for (const character of value.trim()) {
    if (quote) {
      write(character);
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") { quote = character; write(character); }
    else if (character === "{") { write(" {\n".replace(/^ /, output.endsWith(" ") ? "" : " ")); level += 1; }
    else if (character === "}") { level = Math.max(0, level - 1); if (!lineStart) write("\n"); write("}\n"); }
    else if (character === ";") write(";\n");
    else if (/\s/.test(character)) { if (!output.endsWith(" ") && !output.endsWith("\n")) write(" "); }
    else write(character);
  }
  return output.trim();
}

function formatSql(value: string) {
  const keywords = ["SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "UNION", "VALUES", "SET", "RETURNING"];
  let output = value.replace(/\s+/g, " ").trim();
  for (const keyword of keywords) output = output.replace(new RegExp(`\\s+${keyword.replace(" ", "\\s+")}\\s+`, "gi"), `\n${keyword} `);
  output = output.replace(/\b(select|from|where|as|and|or|on|insert|into|update|delete|create|table|values|set|null|is|not|in|like|limit|offset|distinct)\b/gi, match => match.toLocaleUpperCase());
  return output.trim();
}

const unitGroups: Record<string, Record<string, { factor: number; offset?: number }>> = {
  length: { mm: { factor: .001 }, cm: { factor: .01 }, m: { factor: 1 }, km: { factor: 1000 }, in: { factor: .0254 }, ft: { factor: .3048 }, yd: { factor: .9144 }, mi: { factor: 1609.344 } },
  weight: { mg: { factor: .000001 }, g: { factor: .001 }, kg: { factor: 1 }, oz: { factor: .028349523125 }, lb: { factor: .45359237 }, t: { factor: 1000 } },
  area: { "m²": { factor: 1 }, "km²": { factor: 1e6 }, "cm²": { factor: .0001 }, "ft²": { factor: .09290304 }, "in²": { factor: .00064516 }, acre: { factor: 4046.8564224 }, ha: { factor: 10000 } },
  volume: { ml: { factor: .001 }, l: { factor: 1 }, "m³": { factor: 1000 }, tsp: { factor: .00492892159375 }, tbsp: { factor: .01478676478125 }, cup: { factor: .2365882365 }, gal: { factor: 3.785411784 } },
  speed: { "m/s": { factor: 1 }, "km/h": { factor: 1 / 3.6 }, mph: { factor: .44704 }, knot: { factor: .514444 }, "ft/s": { factor: .3048 } },
  "data-size": { bit: { factor: .125 }, B: { factor: 1 }, KB: { factor: 1000 }, MB: { factor: 1e6 }, GB: { factor: 1e9 }, TB: { factor: 1e12 }, KiB: { factor: 1024 }, MiB: { factor: 1048576 }, GiB: { factor: 1073741824 } },
  duration: { ms: { factor: .001 }, s: { factor: 1 }, min: { factor: 60 }, h: { factor: 3600 }, day: { factor: 86400 }, week: { factor: 604800 } },
};

export function unitOptions(group: string) {
  if (group === "temperature") return ["°C", "°F", "K"];
  return Object.keys(unitGroups[group] ?? {});
}

function convertUnit(value: number, group: string, from: string, to: string) {
  if (group === "temperature") {
    const celsius = from === "°C" ? value : from === "°F" ? (value - 32) * 5 / 9 : value - 273.15;
    return to === "°C" ? celsius : to === "°F" ? celsius * 9 / 5 + 32 : celsius + 273.15;
  }
  const source = unitGroups[group]?.[from];
  const target = unitGroups[group]?.[to];
  if (!source || !target) throw new Error("Unsupported unit");
  return value * source.factor / target.factor;
}

function ipv4ToNumber(value: string) {
  const parts = value.trim().split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) throw new Error("Invalid IPv4 address");
  return parts.reduce((total, part) => total * 256 + part, 0) >>> 0;
}

function numberToIpv4(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) throw new Error("Invalid IPv4 integer");
  const number = Math.trunc(value) >>> 0;
  return [number >>> 24, number >>> 16 & 255, number >>> 8 & 255, number & 255].join(".");
}

function cidrInfo(value: string) {
  const [address, prefixText] = value.trim().split("/");
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("Invalid CIDR prefix");
  const ip = ipv4ToNumber(address);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const first = prefix >= 31 ? network : network + 1;
  const last = prefix >= 31 ? broadcast : broadcast - 1;
  return { network: numberToIpv4(network), broadcast: numberToIpv4(broadcast), mask: numberToIpv4(mask), first: numberToIpv4(first), last: numberToIpv4(last), total, usable: prefix >= 31 ? total : Math.max(0, total - 2) };
}

function expandIpv6(value: string) {
  if (!/^[0-9a-f:]+$/i.test(value) || (value.match(/::/g)?.length ?? 0) > 1) throw new Error("Invalid IPv6 address");
  const [left, right = ""] = value.toLocaleLowerCase().split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const missing = 8 - leftParts.length - rightParts.length;
  if (missing < 0 || (!value.includes("::") && missing !== 0)) throw new Error("Invalid IPv6 address");
  return [...leftParts, ...Array.from({ length: missing }, () => "0"), ...rightParts].map(part => part.padStart(4, "0")).join(":");
}

function compressIpv6(value: string) {
  const parts = expandIpv6(value).split(":").map(part => part.replace(/^0+(?=.)/, ""));
  let bestStart = -1;
  let bestLength = 1;
  for (let start = 0; start < parts.length;) {
    if (parts[start] !== "0") { start += 1; continue; }
    let end = start;
    while (parts[end] === "0") end += 1;
    if (end - start > bestLength) { bestStart = start; bestLength = end - start; }
    start = end;
  }
  if (bestStart >= 0) parts.splice(bestStart, bestLength, "");
  let result = parts.join(":");
  if (bestStart === 0) result = `:${result}`;
  if (bestStart + bestLength === 8) result = `${result}:`;
  return result || "::";
}

function tokenizeExpression(input: string) {
  const tokens = input.match(/\d*\.?\d+(?:e[+-]?\d+)?|[()+\-*/%^]/gi);
  if (!tokens || tokens.join("").length !== input.replace(/\s/g, "").length) throw new Error("Invalid expression");
  return tokens;
}

function evaluateMath(input: string) {
  const tokens = tokenizeExpression(input);
  const output: string[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
  let previous = "operator";
  for (const token of tokens) {
    if (/^\d/.test(token) || token.startsWith(".")) { output.push(token); previous = "number"; }
    else if (token === "(") { operators.push(token); previous = "operator"; }
    else if (token === ")") { while (operators.length && operators.at(-1) !== "(") output.push(operators.pop()!); if (operators.pop() !== "(") throw new Error("Mismatched parentheses"); previous = "number"; }
    else {
      if (token === "-" && previous === "operator") output.push("0");
      while (operators.length && operators.at(-1) !== "(" && (precedence[operators.at(-1)!] > precedence[token] || precedence[operators.at(-1)!] === precedence[token] && token !== "^")) output.push(operators.pop()!);
      operators.push(token);
      previous = "operator";
    }
  }
  while (operators.length) { const operator = operators.pop()!; if (operator === "(") throw new Error("Mismatched parentheses"); output.push(operator); }
  const values: number[] = [];
  for (const token of output) {
    if (!precedence[token]) values.push(Number(token));
    else {
      const b = values.pop(); const a = values.pop();
      if (a === undefined || b === undefined) throw new Error("Invalid expression");
      values.push(token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : token === "/" ? a / b : token === "%" ? a % b : a ** b);
    }
  }
  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error("Invalid result");
  return values[0];
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function nanoId(length: number, alphabet: string) {
  if (alphabet.length < 2) throw new Error("Alphabet must contain at least two characters");
  if (length < 1 || length > 256 || alphabet.length < 2) throw new Error("Invalid length or alphabet");
  const bytes = randomBytes(length);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

function ulid() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let time = Date.now();
  let first = "";
  for (let index = 0; index < 10; index += 1) { first = alphabet[time % 32] + first; time = Math.floor(time / 32); }
  return first + nanoId(16, alphabet);
}

function passwordStrength(value: string) {
  const pool = (/[a-z]/.test(value) ? 26 : 0) + (/[A-Z]/.test(value) ? 26 : 0) + (/\d/.test(value) ? 10 : 0) + (/[^\w]/.test(value) ? 32 : 0);
  const entropy = value.length * Math.log2(Math.max(pool, 1));
  const penalties = /(password|senha|1234|qwerty|admin)/i.test(value) ? 30 : 0;
  const score = Math.max(0, Math.min(100, Math.round(entropy - penalties)));
  return { score, entropy: Math.max(0, entropy - penalties), label: score < 30 ? "Weak" : score < 55 ? "Fair" : score < 75 ? "Good" : "Strong" };
}

function parseJwt(value: string) {
  const parts = value.trim().split(".");
  if (parts.length !== 3) throw new Error("A JWT must have three parts");
  const header = JSON.parse(utf8Decoder.decode(base64ToBytes(parts[0]))) as unknown;
  const payload = JSON.parse(utf8Decoder.decode(base64ToBytes(parts[1]))) as Record<string, unknown>;
  const now = Math.floor(Date.now() / 1000);
  return { header, payload, signature: parts[2], timing: { now, expiresAt: payload.exp ?? null, notBefore: payload.nbf ?? null, expired: typeof payload.exp === "number" ? payload.exp < now : null } };
}

function parseUserAgent(value: string) {
  const browser = /Edg\/([\d.]+)/.exec(value) ? ["Microsoft Edge", /Edg\/([\d.]+)/.exec(value)?.[1]] : /Chrome\/([\d.]+)/.exec(value) ? ["Chrome", /Chrome\/([\d.]+)/.exec(value)?.[1]] : /Firefox\/([\d.]+)/.exec(value) ? ["Firefox", /Firefox\/([\d.]+)/.exec(value)?.[1]] : /Version\/([\d.]+).*Safari/.exec(value) ? ["Safari", /Version\/([\d.]+)/.exec(value)?.[1]] : ["Unknown", ""];
  const system = /Windows NT 10/.test(value) ? "Windows" : /Android ([\d.]+)/.test(value) ? `Android ${/Android ([\d.]+)/.exec(value)?.[1]}` : /iPhone|iPad/.test(value) ? "iOS / iPadOS" : /Mac OS X ([\d_]+)/.test(value) ? `macOS ${/Mac OS X ([\d_]+)/.exec(value)?.[1]?.replaceAll("_", ".")}` : /Linux/.test(value) ? "Linux" : "Unknown";
  const device = /Mobile|iPhone|Android/.test(value) ? "Mobile" : /iPad|Tablet/.test(value) ? "Tablet" : "Desktop";
  return { browser: `${browser[0]} ${browser[1]}`.trim(), system, device, mobile: device !== "Desktop" };
}

const httpStatuses: Record<string, string> = {
  "100": "Continue", "101": "Switching Protocols", "200": "OK", "201": "Created", "202": "Accepted", "204": "No Content", "206": "Partial Content", "301": "Moved Permanently", "302": "Found", "304": "Not Modified", "307": "Temporary Redirect", "308": "Permanent Redirect", "400": "Bad Request", "401": "Unauthorized", "403": "Forbidden", "404": "Not Found", "405": "Method Not Allowed", "408": "Request Timeout", "409": "Conflict", "410": "Gone", "413": "Content Too Large", "415": "Unsupported Media Type", "418": "I'm a teapot", "422": "Unprocessable Content", "429": "Too Many Requests", "500": "Internal Server Error", "501": "Not Implemented", "502": "Bad Gateway", "503": "Service Unavailable", "504": "Gateway Timeout",
};

const mimeTypes: Record<string, string> = { html: "text/html", css: "text/css", js: "text/javascript", json: "application/json", xml: "application/xml", pdf: "application/pdf", txt: "text/plain", csv: "text/csv", md: "text/markdown", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon", mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm", zip: "application/zip", gz: "application/gzip", wasm: "application/wasm", woff2: "font/woff2" };

function result(output: string, status?: "success" | "error", message?: string): ToolExecution {
  return { output, status, message };
}

export async function executeTool(id: string, input: string, options: ToolOptions = {}, secondary = ""): Promise<ToolExecution> {
  const mode = String(options.mode ?? "");
  try {
    if (id === "base64") return result(mode === "decode" ? utf8Decoder.decode(base64ToBytes(input)) : bytesToBase64(utf8Encoder.encode(input)));
    if (id === "url-encoder") return result(mode === "decode" ? decodeURIComponent(input) : encodeURIComponent(input));
    if (id === "html-entities") return result(mode === "decode" ? decodeHtml(input) : escapeHtml(input));
    if (id === "text-binary-converter") return result(mode === "decode" ? utf8Decoder.decode(Uint8Array.from(input.trim().split(/\s+/).map(byte => parseInt(byte, 2)))) : Array.from(utf8Encoder.encode(input), byte => byte.toString(2).padStart(8, "0")).join(" "));
    if (id === "number-base-converter") return result(parseInt(input.trim(), Number(options.from ?? 10)).toString(Number(options.to ?? 16)).toLocaleUpperCase());
    if (id === "roman-numeral-converter") return result(/^\d+$/.test(input.trim()) ? romanize(Number(input)) : String(deromanize(input)));
    if (id === "unix-timestamp-converter") {
      if (/^-?\d+$/.test(input.trim())) { const raw = Number(input); const date = new Date(input.trim().length <= 10 ? raw * 1000 : raw); return result(`${date.toISOString()}\n${date.toLocaleString()}\n${Math.floor(date.getTime() / 1000)} s\n${date.getTime()} ms`); }
      const date = new Date(input); if (Number.isNaN(date.getTime())) throw new Error("Invalid date"); return result(`${date.toISOString()}\n${Math.floor(date.getTime() / 1000)} s\n${date.getTime()} ms`);
    }
    if (id === "date-time-converter") { const date = input.trim() ? new Date(input) : new Date(); if (Number.isNaN(date.getTime())) throw new Error("Invalid date"); return result(JSON.stringify({ iso: date.toISOString(), utc: date.toUTCString(), local: date.toLocaleString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, unixSeconds: Math.floor(date.getTime() / 1000) }, null, 2)); }
    if (id === "color-converter") { const [red, green, blue] = parseColor(input); const [hue, saturation, lightness] = rgbToHsl(red, green, blue); const hex = `#${[red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("")}`.toLocaleUpperCase(); return result(`${hex}\nrgb(${red}, ${green}, ${blue})\nhsl(${hue} ${saturation}% ${lightness}%)`); }
    if (id === "uuid-generator") return result(Array.from({ length: boundedInteger(options.count, 5, 1, 100) }, () => crypto.randomUUID()).join("\n"));
    if (id === "ulid-generator") return result(Array.from({ length: boundedInteger(options.count, 5, 1, 100) }, ulid).join("\n"));
    if (id === "nano-id-generator") return result(Array.from({ length: boundedInteger(options.count, 5, 1, 100) }, () => nanoId(boundedInteger(options.length, 21, 1, 256), String(options.alphabet ?? "_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"))).join("\n"));
    if (id === "random-token-generator") { const bytes = randomBytes(boundedInteger(options.length, 32, 1, 4096)); return result(mode === "base64url" ? bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "") : Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")); }
    if (id === "password-generator") {
      let alphabet = "";
      if (options.lower !== false) alphabet += "abcdefghijkmnopqrstuvwxyz";
      if (options.upper !== false) alphabet += "ABCDEFGHJKLMNPQRSTUVWXYZ";
      if (options.numbers !== false) alphabet += "23456789";
      if (options.symbols !== false) alphabet += "!@#$%^&*+-_=";
      return result(Array.from({ length: boundedInteger(options.count, 5, 1, 100) }, () => nanoId(boundedInteger(options.length, 20, 4, 256), alphabet)).join("\n"));
    }
    if (id === "hash-generator") { const algorithm = String(options.algorithm ?? "SHA-256"); const digest = await crypto.subtle.digest(algorithm, utf8Encoder.encode(input)); return result(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")); }
    if (id === "hmac-generator") { const algorithm = String(options.algorithm ?? "SHA-256"); const key = await crypto.subtle.importKey("raw", utf8Encoder.encode(secondary), { name: "HMAC", hash: algorithm }, false, ["sign"]); const signature = await crypto.subtle.sign("HMAC", key, utf8Encoder.encode(input)); return result(Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")); }
    if (id === "password-strength-analyzer") { const analysis = passwordStrength(input); return result(JSON.stringify({ score: `${analysis.score}/100`, strength: analysis.label, entropyBits: Number(analysis.entropy.toFixed(1)), length: Array.from(input).length, checks: { lowercase: /[a-z]/.test(input), uppercase: /[A-Z]/.test(input), numbers: /\d/.test(input), symbols: /[^\w]/.test(input) } }, null, 2)); }
    if (["json-formatter", "json-minifier", "json-validator"].includes(id)) { const value = JSON.parse(input); if (id === "json-validator") return result(JSON.stringify({ valid: true, type: Array.isArray(value) ? "array" : value === null ? "null" : typeof value }, null, 2), "success", "Valid JSON"); return result(JSON.stringify(value, null, id === "json-minifier" ? 0 : Number(options.indent ?? 2))); }
    if (id === "json-to-yaml") { const YAML = await import("yaml"); return result(YAML.stringify(JSON.parse(input), { indent: 2 })); }
    if (id === "yaml-to-json") { const YAML = await import("yaml"); return result(JSON.stringify(YAML.parse(input) as unknown, null, 2)); }
    if (id === "yaml-formatter") { const YAML = await import("yaml"); return result(YAML.stringify(YAML.parse(input) as unknown, { indent: Number(options.indent ?? 2) })); }
    if (id === "json-to-xml") return result(`<?xml version="1.0" encoding="UTF-8"?>\n${formatMarkup(jsonToXml(JSON.parse(input)), "xml")}`);
    if (id === "xml-to-json") { const documentValue = new DOMParser().parseFromString(input, "application/xml"); if (documentValue.querySelector("parsererror") || !documentValue.documentElement) throw new Error("Invalid XML"); return result(JSON.stringify({ [documentValue.documentElement.tagName]: xmlNodeToValue(documentValue.documentElement) }, null, 2)); }
    if (id === "json-to-csv") return result(toCsv(JSON.parse(input)));
    if (id === "csv-table-viewer") { const rows = parseCsv(input, String(options.delimiter ?? ",")); return { output: rows.map(row => row.join(" | ")).join("\n"), rows }; }
    if (id === "json-diff") { const left = JSON.parse(input) as Record<string, unknown>; const right = JSON.parse(secondary) as Record<string, unknown>; const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort(); const changes = keys.filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key])).map(key => ({ path: key, before: left[key], after: right[key], type: !(key in left) ? "added" : !(key in right) ? "removed" : "changed" })); return result(JSON.stringify(changes, null, 2), "success", `${changes.length} changes`); }
    if (["html-formatter", "xml-formatter", "svg-optimizer"].includes(id)) { const type = id === "html-formatter" ? "html" : id === "svg-optimizer" ? "svg" : "xml"; return result(mode === "minify" ? minifyMarkup(input) : formatMarkup(input, type)); }
    if (id === "css-formatter") return result(mode === "minify" ? minifyCode(input, "css") : formatCss(input));
    if (id === "javascript-formatter") return result(mode === "minify" ? minifyCode(input, "js") : formatJavascript(input));
    if (id === "sql-formatter") return result(formatSql(input));
    if (id === "chmod-calculator") {
      const text = input.trim();
      if (/^[0-7]{3,4}$/.test(text)) { const digits = text.slice(-3).split("").map(Number); return result(digits.map((digit, index) => `${index === 0 ? "u" : index === 1 ? "g" : "o"}=${digit & 4 ? "r" : "-"}${digit & 2 ? "w" : "-"}${digit & 1 ? "x" : "-"}`).join(", ")) ; }
      const match = text.match(/(?:[ugoa]*[+=-][rwx]+)(?:,(?:[ugoa]*[+=-][rwx]+))*/); if (!match) throw new Error("Use 755 or u=rwx,g=rx,o=rx"); const groups = { u: 0, g: 0, o: 0 }; for (const part of text.split(",")) { const [, targets = "a", perms = ""] = part.match(/^([ugoa]*).?([rwx]+)$/) ?? []; const number = (perms.includes("r") ? 4 : 0) + (perms.includes("w") ? 2 : 0) + (perms.includes("x") ? 1 : 0); for (const target of targets.includes("a") ? ["u", "g", "o"] : targets) groups[target as keyof typeof groups] = number; } return result(`${groups.u}${groups.g}${groups.o}`);
    }
    if (id === "docker-run-to-compose") {
      const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(token => token.replace(/^"|"$/g, "")) ?? [];
      const imageIndex = tokens.findIndex((token, index) => index > 1 && !token.startsWith("-") && !["-p", "--publish", "-v", "--volume", "-e", "--env", "--name"].includes(tokens[index - 1]));
      const image = tokens[imageIndex] ?? "image";
      const service = String(options.service ?? image.split(/[/:]/)[0] ?? "app").replace(/[^\w-]/g, "-");
      const collect = (flags: string[]) => tokens.flatMap((token, index) => flags.includes(token) && tokens[index + 1] ? [tokens[index + 1]] : []);
      const compose: Record<string, unknown> = { services: { [service]: { image } } };
      const serviceValue = (compose.services as Record<string, Record<string, unknown>>)[service];
      const ports = collect(["-p", "--publish"]); if (ports.length) serviceValue.ports = ports;
      const volumes = collect(["-v", "--volume"]); if (volumes.length) serviceValue.volumes = volumes;
      const environment = collect(["-e", "--env"]); if (environment.length) serviceValue.environment = environment;
      const nameIndex = tokens.findIndex(token => token === "--name"); if (nameIndex >= 0) serviceValue.container_name = tokens[nameIndex + 1];
      const YAML = await import("yaml"); return result(YAML.stringify(compose));
    }
    if (id === "regex-tester") {
      const pattern = String(options.pattern ?? input);
      if (pattern.length > 500 || input.length > 250000 || isPotentiallyUnsafeRegex(pattern)) throw new Error("Unsafe or oversized regular expression");
      const flags = String(options.flags ?? "gu").replace(/[^gimsu]/g, "");
      const expression = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
      const sample = String(options.pattern ? input : secondary);
      const matches: { match: string; index: number; groups: readonly string[] }[] = [];
      let match: RegExpExecArray | null;
      while ((match = expression.exec(sample)) && matches.length < 1000) {
        matches.push({ match: match[0], index: match.index, groups: match.slice(1) });
        if (!match[0]) expression.lastIndex += 1;
      }
      const replacement = String(options.replacement ?? "");
      return result(JSON.stringify({ count: matches.length, matches, replacement: replacement ? sample.replace(new RegExp(pattern, flags), replacement) : undefined }, null, 2), "success", `${matches.length} matches`);
    }
    if (id === "cron-expression-parser") {
      const parts = input.trim().split(/\s+/);
      if (parts.length !== 5) throw new Error("Cron must have five fields");
      const names = ["minute", "hour", "day of month", "month", "day of week"];
      const explain = (part: string, name: string) => part === "*" ? `every ${name}` : part.startsWith("*/") ? `every ${part.slice(2)} ${name}s` : part.includes(",") ? `${name}s ${part}` : part.includes("-") ? `${name}s ${part}` : `${name} ${part}`;
      return result(parts.map((part, index) => `${names[index]}: ${explain(part, names[index])}`).join("\n"));
    }
    if (id === "markdown-preview") {
      const html = escapeHtml(input)
        .replace(/^######\s+(.+)$/gm, "<h6>$1</h6>")
        .replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>")
        .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
        .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
        .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
        .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^&gt;\s+(.+)$/gm, "<blockquote>$1</blockquote>")
        .replace(/^[-*+]\s+(.+)$/gm, "<li>$1</li>")
        .replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>");
      return result(`<p>${html}</p>`);
    }
    if (id === "math-evaluator") return result(String(evaluateMath(input)));
    if (id === "percentage-calculator") { const value = Number(input); const percentage = Number(options.percentage ?? 10); const base = Number(secondary || 0); const calculation = mode === "change" ? (value - base) / base * 100 : mode === "of" ? value / percentage * 100 : value * percentage / 100; return result(String(Number(calculation.toFixed(10)))); }
    if (id === "random-number-generator") { const min = Number(options.min ?? 1); const max = Number(options.max ?? 100); const count = Math.min(1000, Number(options.count ?? 10)); if (max < min) throw new Error("Maximum must be larger than minimum"); const output = Array.from({ length: count }, () => options.integer === false ? min + crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff * (max - min) : min + crypto.getRandomValues(new Uint32Array(1))[0] % (Math.floor(max) - Math.ceil(min) + 1)); return result(output.join("\n")); }
    if (id === "average-calculator") { const numbers = input.split(/[\s,;]+/).filter(Boolean).map(Number); if (!numbers.length || numbers.some(Number.isNaN)) throw new Error("Enter valid numbers"); const sorted = [...numbers].sort((a, b) => a - b); const sum = numbers.reduce((a, b) => a + b, 0); const median = sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; return result(JSON.stringify({ count: numbers.length, sum, mean: sum / numbers.length, median, minimum: sorted[0], maximum: sorted.at(-1) }, null, 2)); }
    if (id === "ratio-calculator") { const a = Number(input); const b = Number(secondary); if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) throw new Error("Enter two valid values"); const gcd = (x: number, y: number): number => y ? gcd(y, x % y) : Math.abs(x); const divisor = gcd(a, b); return result(`${a / divisor}:${b / divisor}\n${(a / b).toFixed(6)}`); }
    if (id.endsWith("-converter") && ["length", "weight", "temperature", "area", "volume", "speed", "data-size"].some(group => id === `${group}-converter`)) { const group = id.replace("-converter", ""); const converted = convertUnit(Number(input), group, String(options.from), String(options.to)); return result(`${Number(converted.toPrecision(12))} ${String(options.to)}`); }
    if (id === "duration-calculator") { const seconds = convertUnit(Number(input), "duration", String(options.from ?? "s"), "s"); return result(JSON.stringify({ milliseconds: seconds * 1000, seconds, minutes: seconds / 60, hours: seconds / 3600, days: seconds / 86400, formatted: `${Math.floor(seconds / 3600)}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}` }, null, 2)); }
    if (id === "cidr-calculator") return result(JSON.stringify(cidrInfo(input), null, 2));
    if (id === "ipv4-converter") { const number = input.includes(".") ? ipv4ToNumber(input) : input.startsWith("0x") ? parseInt(input, 16) : input.replace(/\s/g, "").length === 32 && /^[01]+$/.test(input.replace(/\s/g, "")) ? parseInt(input.replace(/\s/g, ""), 2) : Number(input); return result(JSON.stringify({ dotted: numberToIpv4(number), integer: number >>> 0, hexadecimal: `0x${(number >>> 0).toString(16).padStart(8, "0").toLocaleUpperCase()}`, binary: (number >>> 0).toString(2).padStart(32, "0").match(/.{8}/g)?.join(".") }, null, 2)); }
    if (id === "ipv4-range-expander") { const limit = 4096; let start: number; let end: number; if (input.includes("/")) { const info = cidrInfo(input); start = ipv4ToNumber(info.network); end = ipv4ToNumber(info.broadcast); } else { const parts = input.split(/\s*[-–]\s*/); start = ipv4ToNumber(parts[0]); end = ipv4ToNumber(parts[1]); } if (end < start || end - start + 1 > limit) throw new Error(`Range must contain at most ${limit} addresses`); return result(Array.from({ length: end - start + 1 }, (_, index) => numberToIpv4(start + index)).join("\n")); }
    if (id === "ipv6-compressor") return result(mode === "expand" ? expandIpv6(input) : compressIpv6(input));
    if (id === "mac-address-generator") { const count = Math.min(100, Number(options.count ?? 5)); const separator = String(options.separator ?? ":"); return result(Array.from({ length: count }, () => { const bytes = randomBytes(6); bytes[0] = bytes[0] & 0xfe | 0x02; return Array.from(bytes, byte => byte.toString(16).padStart(2, "0").toLocaleUpperCase()).join(separator); }).join("\n")); }
    if (id === "random-port-generator") { const count = Math.min(100, Number(options.count ?? 5)); const values = new Set<number>(); while (values.size < count) values.add(49152 + crypto.getRandomValues(new Uint16Array(1))[0] % (65536 - 49152)); return result(Array.from(values).join("\n")); }
    if (id === "case-converter") return result(toCase(input, mode || "camel"));
    if (id === "slug-generator") return result(removeDiacritics(input).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, String(options.separator ?? "-")).replace(new RegExp(`^${String(options.separator ?? "-")}+|${String(options.separator ?? "-")}+$`, "g"), ""));
    if (id === "line-sorter") { const lines = input.split(/\r\n?|\n/); if (mode === "reverse") lines.reverse(); else if (mode === "numeric") lines.sort((a, b) => Number(a) - Number(b)); else lines.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: options.caseSensitive ? "variant" : "base" }) * (mode === "desc" ? -1 : 1)); return result(lines.join("\n")); }
    if (id === "duplicate-line-remover") { const seen = new Set<string>(); return result(input.split(/\r\n?|\n/).filter(line => { const key = (options.trim ? line.trim() : line)[options.caseSensitive ? "toString" : "toLocaleLowerCase"](); if (seen.has(key)) return false; seen.add(key); return true; }).join("\n")); }
    if (id === "text-statistics") { const wordValues = input.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) ?? []; const frequency = Object.entries(wordValues.reduce<Record<string, number>>((map, word) => ({ ...map, [word]: (map[word] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 15); return result(JSON.stringify({ characters: Array.from(input).length, charactersWithoutSpaces: Array.from(input.replace(/\s/g, "")).length, words: wordValues.length, uniqueWords: new Set(wordValues).size, lines: input ? input.split(/\r\n?|\n/).length : 0, sentences: (input.match(/[.!?]+(?=\s|$)/g) ?? []).length, readingMinutes: Number((wordValues.length / 200).toFixed(1)), frequency: Object.fromEntries(frequency) }, null, 2)); }
    if (id === "lorem-ipsum-generator") { const sentence = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."; const count = Math.min(100, Math.max(1, Math.trunc(Number(options.count ?? 3)) || 3)); return result(Array.from({ length: count }, (_, index) => index ? `${sentence} Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.` : sentence).join("\n\n")); }
    if (id === "find-and-replace") { const find = String(options.find ?? ""); if (!find) return result(input); const flags = `${options.caseSensitive ? "" : "i"}${options.replaceAll === false ? "" : "g"}u`; const pattern = options.regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const source = options.wholeWord ? `(?<![\\p{L}\\p{M}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{M}\\p{N}_])` : pattern; const regex = new RegExp(source, flags); let count = 0; const output = input.replace(regex, (...args: unknown[]) => { count += 1; return options.regex ? String(options.replacement ?? "").replace(/\$(\d+)/g, (_, number: string) => String(args[Number(number)] ?? "")) : String(options.replacement ?? ""); }); return result(output, "success", `${count} replacements`); }
    if (id === "unicode-inspector") { const rows = Array.from(input).map(character => { const code = character.codePointAt(0) ?? 0; return [character === " " ? "␠" : character, `U+${code.toString(16).toLocaleUpperCase().padStart(4, "0")}`, String(code), Array.from(utf8Encoder.encode(character), byte => byte.toString(16).padStart(2, "0").toLocaleUpperCase()).join(" ")]; }); return { output: rows.map(row => row.join("\t")).join("\n"), rows: [["Character", "Code point", "Decimal", "UTF-8"], ...rows] }; }
    if (id === "remove-markup") { if (mode === "markdown") return result(input.replace(/```[\s\S]*?```/g, match => match.slice(3, -3)).replace(/!\[([^\]]*)]\([^)]*\)/g, "$1").replace(/\[([^\]]+)]\([^)]*\)/g, "$1").replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "").replace(/[*_~`]/g, "")); const documentValue = new DOMParser().parseFromString(input, "text/html"); documentValue.querySelectorAll("script,style,template,noscript").forEach(node => node.remove()); documentValue.querySelectorAll("br,p,div,li,h1,h2,h3,h4,h5,h6").forEach(node => node.append("\n")); return result((documentValue.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()); }
    if (id === "url-parser") { const url = new URL(input.trim()); return result(JSON.stringify({ href: url.href, protocol: url.protocol, username: url.username, password: url.password ? "••••••" : "", hostname: url.hostname, port: url.port, origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash, parameters: Object.fromEntries(url.searchParams) }, null, 2)); }
    if (id === "url-query-editor") { const url = new URL(input.trim()); const lines = secondary.split(/\r\n?|\n/).filter(Boolean); url.search = ""; for (const line of lines) { const [key, ...rest] = line.split("="); if (key) url.searchParams.append(key.trim(), rest.join("=").trim()); } return result(url.toString()); }
    if (id === "jwt-decoder") return result(JSON.stringify(parseJwt(input), null, 2));
    if (id === "basic-auth-generator") return result(`Authorization: Basic ${bytesToBase64(utf8Encoder.encode(`${input}:${secondary}`))}`);
    if (id === "meta-tag-generator") { const title = input.trim(); const description = secondary.trim(); const url = String(options.url ?? "https://example.com"); const image = String(options.image ?? ""); return result([`<title>${escapeHtml(title)}</title>`, `<meta name="description" content="${escapeHtml(description)}">`, `<link rel="canonical" href="${escapeHtml(url)}">`, `<meta property="og:title" content="${escapeHtml(title)}">`, `<meta property="og:description" content="${escapeHtml(description)}">`, `<meta property="og:url" content="${escapeHtml(url)}">`, image ? `<meta property="og:image" content="${escapeHtml(image)}">` : "", `<meta name="twitter:card" content="summary_large_image">`].filter(Boolean).join("\n")); }
    if (id === "user-agent-parser") return result(JSON.stringify(parseUserAgent(input || navigator.userAgent), null, 2));
    if (id === "http-status-reference") { const query = input.trim().toLocaleLowerCase(); const matches = Object.entries(httpStatuses).filter(([code, name]) => !query || code.includes(query) || name.toLocaleLowerCase().includes(query)); return result(matches.map(([code, name]) => `${code} — ${name}`).join("\n")); }
    if (id === "mime-type-lookup") { const query = input.trim().replace(/^\./, "").toLocaleLowerCase(); const matches = Object.entries(mimeTypes).filter(([extension, mime]) => !query || extension.includes(query) || mime.includes(query)); return result(matches.map(([extension, mime]) => `.${extension}\t${mime}`).join("\n")); }
    return result(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing error";
    return result("", "error", message);
  }
}
