import { NextRequest, NextResponse } from "next/server";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";
import type { Timeframe } from "@/lib/types";

const SAFE_RE = /^[A-Za-z0-9 _-]{1,40}$/;

// How far back to look for news based on timeframe
const TF_HOURS: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 2,
  "15m": 4,
  "1h": 12,
  "4h": 24,
  "1d": 72,
  "1w": 168,
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAsset = searchParams.get("asset") || "";
  const rawQuery = searchParams.get("query") || "";
  const timeframe = (searchParams.get("timeframe") || "1d") as Timeframe;
  const asset = SAFE_RE.test(rawAsset) ? rawAsset : undefined;
  const query = SAFE_RE.test(rawQuery) ? rawQuery : asset || "crypto";

  try {
    const [cryptoNews, googleNews] = await Promise.all([
      getCryptoNews(asset),
      getGoogleNews(query + " price"),
    ]);

    // Merge and deduplicate
    const allNews = [...cryptoNews, ...googleNews];
    const seen = new Set<string>();
    const unique = allNews.filter((n) => {
      const key = n.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by timeframe recency
    const maxAge = (TF_HOURS[timeframe] || 72) * 60 * 60 * 1000;
    const now = Date.now();
    const filtered = unique.filter((n) => {
      const published = new Date(n.publishedAt).getTime();
      return now - published <= maxAge;
    });

    // Sentiment from filtered news
    let sentimentScore = 0;
    for (const n of filtered) {
      if (n.sentiment === "positive") sentimentScore++;
      else if (n.sentiment === "negative") sentimentScore--;
    }

    const overall = filtered.length > 0
      ? Math.round((sentimentScore / filtered.length) * 100)
      : 0;

    return NextResponse.json({
      news: filtered.slice(0, 20),
      sentiment: {
        overall,
        positive: filtered.filter((n) => n.sentiment === "positive").length,
        negative: filtered.filter((n) => n.sentiment === "negative").length,
        neutral: filtered.filter((n) => n.sentiment === "neutral").length,
        total: filtered.length,
      },
      timeframe,
    });
  } catch (error) {
    console.error("News fetch failed:", error);
    return NextResponse.json({ news: [], sentiment: { overall: 0, positive: 0, negative: 0, neutral: 0, total: 0 }, timeframe }, { status: 500 });
  }
}
