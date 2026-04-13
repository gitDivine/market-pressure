import type { PairInfo } from "../types";
import type { Candle } from "../analysis/indicators";
import type { Timeframe } from "../types";

const BASE = "https://api.coingecko.com/api/v3";

// CoinGecko timeframe → days + interval mapping
const TF_CONFIG: Record<Timeframe, { days: string; interval?: string }> = {
  "1m": { days: "1" },       // 5-min candles (CG auto)
  "5m": { days: "1" },       // 5-min candles
  "15m": { days: "1" },      // 5-min candles, we'll resample
  "1h": { days: "2" },       // hourly candles
  "4h": { days: "7" },       // hourly candles, resample to 4h
  "1d": { days: "30" },      // daily candles
  "1w": { days: "90" },      // daily candles, resample to weekly
};

// Rate-limit aware fetch with retry
async function cgFetch(url: string, revalidate = 60): Promise<Response> {
  const res = await fetch(url, {
    next: { revalidate },
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((r) => setTimeout(r, 2000));
    return fetch(url, {
      next: { revalidate },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
  }
  return res;
}

export async function getCoinGeckoPairs(): Promise<PairInfo[]> {
  // Fetch top 200 coins by market cap
  const res = await cgFetch(
    `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=24h`,
    120
  );
  if (!res.ok) throw new Error(`CoinGecko markets failed: ${res.status}`);

  const data: Array<{
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    total_volume: number;
  }> = await res.json();

  // Filter out stablecoins and low-volume coins
  const stablecoins = new Set(["usdt", "usdc", "dai", "busd", "tusd", "usdp", "frax", "usdd", "gusd", "pyusd", "fdusd"]);

  return data
    .filter((c) => !stablecoins.has(c.symbol.toLowerCase()) && c.total_volume > 50000)
    .map((c) => ({
      symbol: c.id, // CoinGecko uses id for API calls
      name: `${c.symbol.toUpperCase()}/USD`,
      base: c.symbol.toUpperCase(),
      quote: "USD",
      class: "crypto" as const,
      price: c.current_price,
      change24h: c.price_change_percentage_24h ?? 0,
    }));
}

export async function getCoinGeckoCandles(
  coinId: string,
  timeframe: Timeframe
): Promise<Candle[]> {
  const config = TF_CONFIG[timeframe];

  // CoinGecko OHLC endpoint
  const res = await cgFetch(
    `${BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${config.days}`,
    30
  );
  if (!res.ok) throw new Error(`CoinGecko OHLC failed for ${coinId}: ${res.status}`);

  const data: number[][] = await res.json();

  // CoinGecko OHLC format: [timestamp, open, high, low, close]
  // No volume in OHLC — we'll get it from market_chart
  const volumeData = await getVolumeData(coinId, config.days);

  const candles: Candle[] = data.map((k, i) => {
    const close = k[4];
    const open = k[1];
    // Estimate volume distribution from price movement
    const vol = volumeData[i] || 0;
    // Approximate taker buy volume: if close > open, more buy pressure
    const buyRatio = close >= open ? 0.55 + (close - open) / open * 2 : 0.45 - (open - close) / open * 2;
    const clampedRatio = Math.max(0.2, Math.min(0.8, buyRatio));

    return {
      timestamp: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: vol,
      takerBuyVolume: vol * clampedRatio,
    };
  });

  // Resample if needed for larger timeframes
  if (timeframe === "4h") return resampleCandles(candles, 4);
  if (timeframe === "1w") return resampleCandles(candles, 7);

  return candles;
}

async function getVolumeData(coinId: string, days: string): Promise<number[]> {
  try {
    const res = await cgFetch(
      `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      60
    );
    if (!res.ok) return [];

    const data: { total_volumes: number[][] } = await res.json();
    return data.total_volumes.map((v) => v[1]);
  } catch {
    return [];
  }
}

function resampleCandles(candles: Candle[], groupSize: number): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const group = candles.slice(i, i + groupSize);
    if (group.length === 0) continue;
    result.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((s, c) => s + c.volume, 0),
      takerBuyVolume: group.reduce((s, c) => s + c.takerBuyVolume, 0),
    });
  }
  return result;
}

// Synthetic order book from price momentum (since CoinGecko has no order book)
export function syntheticOrderBookImbalance(candles: Candle[]): number {
  if (candles.length < 5) return 0;

  const recent = candles.slice(-10);
  let bullishCandles = 0;
  let totalRange = 0;

  for (const c of recent) {
    if (c.close > c.open) bullishCandles++;
    totalRange += c.high - c.low;
  }

  // Ratio of bullish candles as proxy for order book imbalance
  const ratio = (bullishCandles / recent.length - 0.5) * 2; // -1 to 1
  return Math.max(-0.8, Math.min(0.8, ratio));
}
