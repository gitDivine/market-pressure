import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { getYahooCandles, syntheticImbalance } from "@/lib/api/yahoo";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";
import { calculatePressure } from "@/lib/analysis/pressure";
import { calculateConfluence } from "@/lib/analysis/confluence";
import type { Timeframe, AssetClass } from "@/lib/types";

const ALL_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol") || "";
  const assetClass = (searchParams.get("class") || "crypto") as AssetClass;
  const base = searchParams.get("base") || symbol;

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    // Fetch candles + news in parallel
    const [klinesResults, cryptoNews, googleNews] = await Promise.all([
      Promise.allSettled(
        ALL_TIMEFRAMES.map((tf) =>
          assetClass === "crypto"
            ? getCoinGeckoCandles(symbol.toLowerCase(), tf)
            : getYahooCandles(symbol, tf)
        )
      ),
      getCryptoNews(base).catch(() => []),
      getGoogleNews(base + " price").catch(() => []),
    ]);

    // Calculate news sentiment
    const allNews = [...cryptoNews, ...googleNews];
    let sentimentScore = 0;
    for (const n of allNews) {
      if (n.sentiment === "positive") sentimentScore++;
      else if (n.sentiment === "negative") sentimentScore--;
    }
    const newsSentiment = allNews.length > 0
      ? Math.round((sentimentScore / allNews.length) * 100)
      : 0;

    const timeframePressures = ALL_TIMEFRAMES
      .map((tf, i) => {
        const result = klinesResults[i];
        if (result.status === "rejected") return null;
        const candles = result.value;
        const imbalance = assetClass === "crypto"
          ? syntheticOrderBookImbalance(candles)
          : syntheticImbalance(candles);
        const pressure = calculatePressure(candles, imbalance);
        return { timeframe: tf, pressure };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Pass news sentiment into confluence
    const confluence = calculateConfluence(timeframePressures, newsSentiment);

    return NextResponse.json({ confluence, symbol, newsSentiment });
  } catch (error) {
    console.error(`Confluence calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate confluence" }, { status: 500 });
  }
}
