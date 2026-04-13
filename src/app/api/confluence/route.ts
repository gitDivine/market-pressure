import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { calculatePressure } from "@/lib/analysis/pressure";
import { calculateConfluence } from "@/lib/analysis/confluence";
import type { Timeframe } from "@/lib/types";

const ALL_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
const SYMBOL_RE = /^[a-z0-9-]{1,60}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get("symbol") || "").toLowerCase();

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    // Fetch all timeframes in parallel
    const klinesResults = await Promise.allSettled(
      ALL_TIMEFRAMES.map((tf) => getCoinGeckoCandles(symbol, tf))
    );

    const timeframePressures = ALL_TIMEFRAMES
      .map((tf, i) => {
        const result = klinesResults[i];
        if (result.status === "rejected") return null;
        const candles = result.value;
        const imbalance = syntheticOrderBookImbalance(candles);
        const pressure = calculatePressure(candles, imbalance);
        return { timeframe: tf, pressure };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const confluence = calculateConfluence(timeframePressures);

    return NextResponse.json({ confluence, symbol });
  } catch (error) {
    console.error(`Confluence calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate confluence" }, { status: 500 });
  }
}
