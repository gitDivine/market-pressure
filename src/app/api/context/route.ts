import { NextRequest, NextResponse } from "next/server";
import { CENTRAL_BANK_RATES, STOCK_SECTORS, MAJOR_CURRENCIES, MAJOR_PAIRS } from "@/lib/data/rates";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

async function yFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 120 },
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

// Get price change for a Yahoo symbol over a given range
async function getChange(symbol: string, range: string, interval: string): Promise<number | null> {
  const res = await yFetch(`${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`);
  if (!res) return null;
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;
  const closes = result.indicators?.quote?.[0]?.close;
  if (!closes || closes.length < 2) return null;
  const first = closes.find((c: number | null) => c !== null);
  const last = closes.findLast((c: number | null) => c !== null);
  if (!first || !last) return null;
  return ((last - first) / first) * 100;
}

// Map our timeframe to Yahoo range/interval for strength calculation
function tfToYahoo(tf: string): { range: string; interval: string } {
  switch (tf) {
    case "1m": case "5m": case "15m": return { range: "1d", interval: "5m" };
    case "1h": return { range: "5d", interval: "1h" };
    case "4h": return { range: "15d", interval: "1h" };
    case "1d": return { range: "1mo", interval: "1d" };
    case "1w": return { range: "3mo", interval: "1wk" };
    default: return { range: "5d", interval: "1h" };
  }
}

// ─── Currency Strength ──────────────────────────────────
async function getCurrencyStrength(base: string, quote: string, tf: string) {
  const { range, interval } = tfToYahoo(tf);

  // Fetch changes for all 28 major pairs (batched)
  const pairChanges = new Map<string, number>();
  const batchSize = 5;

  for (let i = 0; i < MAJOR_PAIRS.length; i += batchSize) {
    const batch = MAJOR_PAIRS.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((pair) => getChange(`${pair}=X`, range, interval))
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value !== null) {
        pairChanges.set(batch[j], r.value);
      }
    });
    if (i + batchSize < MAJOR_PAIRS.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Calculate strength for each currency
  const strengths: Record<string, { score: number; changes: number[] }> = {};
  for (const cur of MAJOR_CURRENCIES) {
    strengths[cur] = { score: 0, changes: [] };
  }

  for (const [pair, change] of pairChanges) {
    const b = pair.slice(0, 3);
    const q = pair.slice(3);
    if (strengths[b]) strengths[b].changes.push(change);
    if (strengths[q]) strengths[q].changes.push(-change); // inverse for quote
  }

  // Average changes and normalize to 0-100
  const avgChanges: Record<string, number> = {};
  for (const [cur, data] of Object.entries(strengths)) {
    avgChanges[cur] = data.changes.length > 0
      ? data.changes.reduce((a, b) => a + b, 0) / data.changes.length
      : 0;
  }

  // Normalize: find min/max and scale to 0-100
  const values = Object.values(avgChanges);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range2 = max - min || 1;

  const normalized: Record<string, number> = {};
  for (const [cur, avg] of Object.entries(avgChanges)) {
    normalized[cur] = Math.round(((avg - min) / range2) * 100);
  }

  return {
    base: { currency: base, strength: normalized[base] ?? 50 },
    quote: { currency: quote, strength: normalized[quote] ?? 50 },
    all: normalized,
  };
}

// ─── Interest Rate Differential ─────────────────────────
function getInterestRates(base: string, quote: string) {
  const baseRate = CENTRAL_BANK_RATES[base];
  const quoteRate = CENTRAL_BANK_RATES[quote];
  if (!baseRate || !quoteRate) return null;

  const differential = baseRate.rate - quoteRate.rate;
  return {
    base: { currency: base, rate: baseRate.rate, bank: baseRate.bank },
    quote: { currency: quote, rate: quoteRate.rate, bank: quoteRate.bank },
    differential,
    favored: differential > 0.25 ? base : differential < -0.25 ? quote : "neutral",
  };
}

// ─── Bond Yields ────────────────────────────────────────
async function getBondYields(base: string, quote: string) {
  const yieldMap: Record<string, string> = {
    USD: "^TNX", JPY: "^IRJPY", GBP: "^TMBMKGB-10Y", EUR: "^TMBMKDE-10Y",
    AUD: "^TMBMKAU-10Y", NZD: "^TMBMKNZ-10Y", CAD: "^TMBMKCA-10Y", CHF: "^TMBMKCH-10Y",
  };

  const baseSymbol = yieldMap[base];
  const quoteSymbol = yieldMap[quote];

  const results: Record<string, { yield: number; change: string } | null> = {};

  for (const [cur, sym] of [[base, baseSymbol], [quote, quoteSymbol]] as [string, string | undefined][]) {
    if (!sym) { results[cur] = null; continue; }
    const res = await yFetch(`${YAHOO_BASE}/${encodeURIComponent(sym)}?interval=1d&range=5d`);
    if (!res) { results[cur] = null; continue; }
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length < 2) { results[cur] = null; continue; }
    const last = closes.findLast((c: number | null) => c !== null);
    const prev = closes.findLast((c: number | null, i: number) => c !== null && i < closes.length - 1);
    results[cur] = {
      yield: last || 0,
      change: last > prev ? "rising" : last < prev ? "falling" : "flat",
    };
  }

  return {
    base: results[base] ? { currency: base, ...results[base] } : null,
    quote: results[quote] ? { currency: quote, ...results[quote] } : null,
  };
}

// ─── Sector Strength (Stocks) ───────────────────────────
function getSectorStrength(symbol: string, allPairs: Array<{ symbol: string; change24h?: number }>) {
  const sector = STOCK_SECTORS[symbol];
  if (!sector) return null;

  // Get all stocks in the same sector
  const sectorStocks = Object.entries(STOCK_SECTORS)
    .filter(([, s]) => s === sector)
    .map(([sym]) => sym);

  // Find their changes from the pairs data
  const changes = sectorStocks
    .map((sym) => allPairs.find((p) => p.symbol === sym)?.change24h)
    .filter((c): c is number => c !== undefined && c !== null);

  if (changes.length === 0) return null;

  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;

  return {
    sector,
    avgChange: Math.round(avg * 100) / 100,
    stockCount: changes.length,
    direction: avg > 0.5 ? "strong" as const : avg < -0.5 ? "weak" as const : "neutral" as const,
  };
}

// ─── Fear & Greed ───────────────────────────────────────
async function getFearGreed(assetClass: string) {
  try {
    if (assetClass === "crypto") {
      const res = await fetch("https://api.alternative.me/fng/?limit=1", {
        next: { revalidate: 300 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const entry = data?.data?.[0];
      if (!entry) return null;
      return {
        value: parseInt(entry.value),
        label: entry.value_classification,
        source: "Alternative.me",
      };
    }
    // For stocks/indices, use CNN Fear & Greed (scraped value)
    // CNN doesn't have a public API, so we approximate from VIX
    const vixRes = await yFetch(`${YAHOO_BASE}/^VIX?interval=1d&range=2d`);
    if (!vixRes) return null;
    const vixData = await vixRes.json();
    const vixCloses = vixData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!vixCloses || vixCloses.length === 0) return null;
    const vix = vixCloses.findLast((c: number | null) => c !== null);
    if (!vix) return null;
    // VIX → Fear/Greed approximation: VIX < 15 = Extreme Greed, 15-20 = Greed, 20-25 = Neutral, 25-30 = Fear, >30 = Extreme Fear
    const value = Math.max(0, Math.min(100, Math.round(100 - (vix - 10) * 3.33)));
    const label = value >= 75 ? "Extreme Greed" : value >= 55 ? "Greed" : value >= 45 ? "Neutral" : value >= 25 ? "Fear" : "Extreme Fear";
    return { value, label, source: "VIX-derived" };
  } catch {
    return null;
  }
}

// ─── Relative Momentum (Crypto) ─────────────────────────
async function getRelativeMomentum(symbol: string, tf: string) {
  const { range, interval } = tfToYahoo(tf);

  // Get BTC change and the coin's change
  const [btcChange, coinChange] = await Promise.all([
    getChange("BTC-USD", range, interval),
    getChange(`${symbol.toUpperCase()}-USD`, range, interval),
  ]);

  if (coinChange === null) return null;

  const vsBtc = btcChange !== null ? coinChange - btcChange : null;

  return {
    vsUSD: { change: Math.round(coinChange * 100) / 100, direction: coinChange > 0 ? "strong" : "weak" },
    vsBTC: vsBtc !== null
      ? { change: Math.round(vsBtc * 100) / 100, direction: vsBtc > 0 ? "outperforming" : "underperforming" }
      : null,
  };
}

// ─── COT Report (simplified) ────────────────────────────
// CFTC data is complex to parse live. For beta, use hardcoded recent positioning.
// This can be upgraded to live CFTC API later.
function getCOTData(base: string, quote: string) {
  // Approximate net positioning based on known institutional trends
  // In production, this would fetch from CFTC API
  return null; // Skip for now — will add when CFTC API integration is ready
}

// ─── Main Route ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";
  const assetClass = searchParams.get("class") || "crypto";
  const tf = searchParams.get("timeframe") || "1h";
  const base = searchParams.get("base") || "";
  const quote = searchParams.get("quote") || "";

  const context: Record<string, unknown> = {};

  try {
    if (assetClass === "forex") {
      // Currency Strength + Interest Rates + Bond Yields
      const [strength, bonds] = await Promise.allSettled([
        getCurrencyStrength(base, quote, tf),
        getBondYields(base, quote),
      ]);

      if (strength.status === "fulfilled") context.currencyStrength = strength.value;
      context.interestRates = getInterestRates(base, quote);
      if (bonds.status === "fulfilled") context.bondYields = bonds.value;
      context.cot = getCOTData(base, quote);
    }

    if (assetClass === "stocks") {
      // Sector Strength + Fear & Greed
      // We need the stock pairs list for sector calc
      try {
        const pairsRes = await fetch(`${req.nextUrl.origin}/api/pairs?class=stocks`);
        if (pairsRes.ok) {
          const pairsData = await pairsRes.json();
          context.sectorStrength = getSectorStrength(symbol, pairsData.pairs || []);
        }
      } catch {}

      const fg = await getFearGreed("stocks");
      if (fg) context.fearGreed = fg;
    }

    if (assetClass === "crypto") {
      // Relative Momentum + Fear & Greed
      const [momentum, fg] = await Promise.allSettled([
        getRelativeMomentum(base, tf),
        getFearGreed("crypto"),
      ]);

      if (momentum.status === "fulfilled") context.relativeMomentum = momentum.value;
      if (fg.status === "fulfilled" && fg.value) context.fearGreed = fg.value;
    }

    if (assetClass === "indices") {
      const fg = await getFearGreed("stocks");
      if (fg) context.fearGreed = fg;
    }

    return NextResponse.json(context, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch context" }, { status: 500 });
  }
}
