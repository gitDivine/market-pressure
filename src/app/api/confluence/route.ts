import { NextRequest, NextResponse } from "next/server";
import { getCoinGeckoCandles, syntheticOrderBookImbalance } from "@/lib/api/coingecko";
import { getYahooCandles, syntheticImbalance } from "@/lib/api/yahoo";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";
import { getSocialSentiment } from "@/lib/api/social";
import { calculatePressure } from "@/lib/analysis/pressure";
import { calculateConfluence } from "@/lib/analysis/confluence";
import type { Timeframe, AssetClass, PressureData } from "@/lib/types";

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
    // Fetch news + social in background while we get candles
    const newsPromise = Promise.all([
      getCryptoNews(base).catch(() => []),
      getGoogleNews(base + " price").catch(() => []),
    ]);
    const socialPromise = getSocialSentiment(base, assetClass).catch(() => ({ overall: 0, posts: [], sources: [] }));

    // For crypto (CoinGecko): fetch sequentially to avoid rate limits
    // For Yahoo: can parallelize since batching already handles rate limits
    const timeframePressures: { timeframe: Timeframe; pressure: PressureData }[] = [];

    if (assetClass === "crypto") {
      // Sequential with small gaps to respect CoinGecko rate limit
      for (const tf of ALL_TIMEFRAMES) {
        try {
          const candles = await getCoinGeckoCandles(symbol.toLowerCase(), tf);
          const imbalance = syntheticOrderBookImbalance(candles);
          const pressure = calculatePressure(candles, imbalance);
          timeframePressures.push({ timeframe: tf, pressure });
        } catch {
          // Skip failed timeframes
        }
      }
    } else {
      // Yahoo can handle parallel
      const klinesResults = await Promise.allSettled(
        ALL_TIMEFRAMES.map((tf) => getYahooCandles(symbol, tf))
      );
      for (let i = 0; i < ALL_TIMEFRAMES.length; i++) {
        const result = klinesResults[i];
        if (result.status === "rejected") continue;
        const candles = result.value;
        const imbalance = syntheticImbalance(candles);
        const pressure = calculatePressure(candles, imbalance);
        timeframePressures.push({ timeframe: ALL_TIMEFRAMES[i], pressure });
      }
    }

    // Get news + social sentiment
    const [[cryptoNews, googleNews], social] = await Promise.all([newsPromise, socialPromise]);
    const allNews = [...cryptoNews, ...googleNews];
    let newsScore = 0;
    for (const n of allNews) {
      if (n.sentiment === "positive") newsScore++;
      else if (n.sentiment === "negative") newsScore--;
    }
    const rawNewsSentiment = allNews.length > 0
      ? Math.round((newsScore / allNews.length) * 100)
      : 0;

    // Combined sentiment: 50% news, 50% social (when available)
    let combinedSentiment = rawNewsSentiment;
    if (social.overall !== 0 && rawNewsSentiment !== 0) {
      combinedSentiment = Math.round(rawNewsSentiment * 0.5 + social.overall * 0.5);
    } else if (social.overall !== 0) {
      combinedSentiment = social.overall;
    }

    const confluence = calculateConfluence(timeframePressures, combinedSentiment);

    return NextResponse.json({ confluence, symbol, newsSentiment: combinedSentiment, socialSentiment: social });
  } catch (error) {
    console.error(`Confluence calc failed for ${symbol}:`, error);
    return NextResponse.json({ error: "Failed to calculate confluence" }, { status: 500 });
  }
}
