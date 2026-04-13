import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { calculatePressure } from "@/lib/analysis/pressure";
import type { Timeframe } from "@/lib/types";

const VALID_TFS = new Set(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);
const SYMBOL_RE = /^[a-z0-9-]{1,60}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = (searchParams.get("symbol") || "").toLowerCase();
  const tfParam = searchParams.get("timeframe") || "1h";
  const timeframe = (VALID_TFS.has(tfParam) ? tfParam : "1h") as Timeframe;

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    const candles = await getCoinGeckoCandles(symbol, timeframe);
    const imbalance = syntheticOrderBookImbalance(candles);
    const pressure = calculatePressure(candles, imbalance);

    return NextResponse.json({ pressure, symbol, timeframe });
  } catch (error) {
    console.error(`Pressure calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate pressure" }, { status: 500 });
  }
}
