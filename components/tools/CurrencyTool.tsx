"use client";

import { ArrowLeftRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { CopyButton } from "@/components/tool/ToolActions";
import type { ToolDefinition } from "@/lib/catalog";

const RATES_API = "https://api.frankfurter.dev/v1/latest";
const CURRENCIES_API = "https://api.frankfurter.dev/v1/currencies";
const CACHE_TTL_MS = 30 * 60 * 1000;

const preferredOrder = ["BRL", "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "MXN"] as const;

const uiByLocale = {
  "pt-BR": {
    amount: "Valor",
    from: "De",
    to: "Para",
    convert: "Atualizar cotação",
    swap: "Inverter moedas",
    result: "Resultado",
    rate: "Taxa",
    updated: "Cotação de",
    source: "Fonte: Frankfurter (bancos centrais)",
    loading: "Buscando cotação…",
    loadError: "Não foi possível buscar a cotação agora. Tente novamente.",
    currenciesError: "Não foi possível carregar a lista de moedas.",
    invalidAmount: "Digite um valor numérico válido.",
    perUnit: "1 {from} = {rate} {to}",
    inverse: "1 {to} = {rate} {from}",
    popular: "Outras cotações ({base})",
    currency: "Moeda",
    value: "Valor",
  },
  en: {
    amount: "Amount",
    from: "From",
    to: "To",
    convert: "Refresh rate",
    swap: "Swap currencies",
    result: "Result",
    rate: "Rate",
    updated: "Rate date",
    source: "Source: Frankfurter (central banks)",
    loading: "Fetching exchange rate…",
    loadError: "Could not fetch the exchange rate right now. Try again.",
    currenciesError: "Could not load the currency list.",
    invalidAmount: "Enter a valid numeric amount.",
    perUnit: "1 {from} = {rate} {to}",
    inverse: "1 {to} = {rate} {from}",
    popular: "Other rates ({base})",
    currency: "Currency",
    value: "Amount",
  },
} as const;

type CurrencyMap = Readonly<Record<string, string>>;
type RatesPayload = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

type CacheEntry = {
  expiresAt: number;
  payload: RatesPayload;
};

const ratesCache = new Map<string, CacheEntry>();

function replaceTokens(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function sortCurrencyCodes(codes: readonly string[]) {
  return [...codes].sort((left, right) => {
    const leftRank = preferredOrder.indexOf(left as (typeof preferredOrder)[number]);
    const rightRank = preferredOrder.indexOf(right as (typeof preferredOrder)[number]);
    if (leftRank !== -1 || rightRank !== -1) {
      return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank);
    }
    return left.localeCompare(right);
  });
}

async function fetchRates(base: string, signal?: AbortSignal): Promise<RatesPayload> {
  const cacheKey = base.toUpperCase();
  const cached = ratesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const response = await fetch(`${RATES_API}?from=${encodeURIComponent(cacheKey)}`, { signal });
  if (!response.ok) throw new Error("rate-fetch-failed");
  const payload = await response.json() as RatesPayload;
  if (!payload?.rates || typeof payload.rates !== "object") throw new Error("rate-fetch-failed");
  ratesCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}

export function CurrencyTool(_props: { tool: ToolDefinition }) {
  const { locale } = useApp();
  const ui = uiByLocale[locale];
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState(locale === "pt-BR" ? "BRL" : "USD");
  const [to, setTo] = useState(locale === "pt-BR" ? "USD" : "BRL");
  const [currencies, setCurrencies] = useState<CurrencyMap>({});
  const [payload, setPayload] = useState<RatesPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  const currencyCodes = useMemo(() => sortCurrencyCodes(Object.keys(currencies)), [currencies]);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }), [locale]);
  const money = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }), [locale]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(CURRENCIES_API, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("currencies-failed");
        setCurrencies(await response.json() as CurrencyMap);
      })
      .catch((errorValue) => {
        if (controller.signal.aborted) return;
        setError(errorValue instanceof Error ? ui.currenciesError : ui.currenciesError);
      });
    return () => controller.abort();
  }, [ui.currenciesError]);

  useEffect(() => {
    if (!from) return;
    const controller = new AbortController();
    let active = true;
    setBusy(true);
    setError("");
    void fetchRates(from, controller.signal)
      .then((next) => {
        if (active) setPayload(next);
      })
      .catch((errorValue) => {
        if (!active || controller.signal.aborted) return;
        setPayload(null);
        setError(errorValue instanceof Error ? ui.loadError : ui.loadError);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [from, refreshToken, ui.loadError]);

  const parsedAmount = parseAmount(amount);
  const rate = from === to ? 1 : payload?.rates[to] ?? null;
  const converted = parsedAmount !== null && rate !== null ? parsedAmount * rate : null;
  const inverseRate = rate && rate !== 0 ? 1 / rate : null;

  const popularRows = useMemo(() => {
    if (!payload) return [];
    return preferredOrder
      .filter((code) => code !== from && payload.rates[code] !== undefined)
      .slice(0, 8)
      .map((code) => ({
        code,
        name: currencies[code] ?? code,
        rate: payload.rates[code],
        value: parsedAmount === null ? null : parsedAmount * payload.rates[code],
      }));
  }, [currencies, from, parsedAmount, payload]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const resultText = converted === null ? "" : `${money.format(converted)} ${to}`;

  return (
    <div className="currencyTool">
      <div className="currencyTool__controls tool-controls">
        <label className="field currencyTool__amountField">
          <span>{ui.amount}</span>
          <input
            className="control-input"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
            aria-invalid={amount.length > 0 && parsedAmount === null}
          />
        </label>
        <label className="field">
          <span>{ui.from}</span>
          <select className="control-input" value={from} onChange={(event) => setFrom(event.currentTarget.value)} disabled={!currencyCodes.length}>
            {currencyCodes.map((code) => (
              <option key={`from-${code}`} value={code}>{code} — {currencies[code] ?? code}</option>
            ))}
          </select>
        </label>
        <button className="button button-ghost currencyTool__swap" type="button" onClick={swap} title={ui.swap} aria-label={ui.swap}>
          <ArrowLeftRight size={16} />
        </button>
        <label className="field">
          <span>{ui.to}</span>
          <select className="control-input" value={to} onChange={(event) => setTo(event.currentTarget.value)} disabled={!currencyCodes.length}>
            {currencyCodes.map((code) => (
              <option key={`to-${code}`} value={code}>{code} — {currencies[code] ?? code}</option>
            ))}
          </select>
        </label>
        <button
          className="button button-primary currencyTool__refresh"
          type="button"
          onClick={() => {
            ratesCache.delete(from.toUpperCase());
            setRefreshToken((current) => current + 1);
          }}
          disabled={busy}
        >
          <RefreshCw size={16} className={busy ? "currencyTool__spinner" : undefined} />
          {busy ? ui.loading : ui.convert}
        </button>
      </div>

      {error && <p className="result-message" role="alert">{error}</p>}
      {parsedAmount === null && amount.trim().length > 0 && (
        <p className="result-message" role="alert">{ui.invalidAmount}</p>
      )}

      <div className="currencyTool__resultBoard">
        <section className="currencyTool__resultCard" aria-live="polite">
          <p className="currencyTool__resultLabel">{ui.result}</p>
          <p className="currencyTool__resultValue">{converted === null ? "—" : resultText}</p>
          <div className="currencyTool__resultMeta">
            {rate !== null && (
              <p>
                {replaceTokens(ui.perUnit, {
                  from,
                  to,
                  rate: number.format(rate),
                })}
              </p>
            )}
            {inverseRate !== null && (
              <p>
                {replaceTokens(ui.inverse, {
                  from,
                  to,
                  rate: number.format(inverseRate),
                })}
              </p>
            )}
            {payload?.date && <p>{ui.updated}: {payload.date}</p>}
            <p>{ui.source}</p>
          </div>
          <div className="currencyTool__resultActions">
            <CopyButton value={resultText} />
          </div>
        </section>

        {popularRows.length > 0 && (
          <section className="currencyTool__rates" aria-label={replaceTokens(ui.popular, { base: from })}>
            <h2>{replaceTokens(ui.popular, { base: from })}</h2>
            <div className="currencyTool__ratesTableWrap">
              <table className="currencyTool__ratesTable">
                <thead>
                  <tr>
                    <th>{ui.currency}</th>
                    <th>{ui.rate}</th>
                    <th>{ui.value}</th>
                  </tr>
                </thead>
                <tbody>
                  {popularRows.map((row) => (
                    <tr key={row.code}>
                      <td>
                        <strong>{row.code}</strong>
                        <span>{row.name}</span>
                      </td>
                      <td>{number.format(row.rate)}</td>
                      <td>{row.value === null ? "—" : money.format(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default CurrencyTool;
