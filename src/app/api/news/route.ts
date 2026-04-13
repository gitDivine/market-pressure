import { NextRequest, NextResponse } from "next/server";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";
import { getSocialSentiment } from "@/lib/api/social";
import type { Timeframe } from "@/lib/types";

const SAFE_RE = /^[A-Za-z0-9 _-]{1,40}$/;

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
  const assetClass = searchParams.get("class") || "crypto";
  const asset = SAFE_RE.test(rawAsset) ? rawAsset : undefined;
  const query = SAFE_RE.test(rawQuery) ? rawQuery : asset || "crypto";

  try {
    // Fetch news + social in parallel
    const [cryptoNews, googleNews, social] = await Promise.all([
      getCryptoNews(asset),
      getGoogleNews(query + " price"),
      getSocialSentiment(asset || query, assetClass).catch(() => ({ overall: 0, posts: [], sources: [] })),
    ]);

    // Merge news and deduplicate
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

    // Also filter social posts by timeframe
    const filteredSocialPosts = social.posts.filter((p) => {
      const published = new Date(p.publishedAt).getTime();
      return now - published <= maxAge;
    });

    // Merge news + social posts for the feed
    const combinedFeed = [
      ...filtered.map((n) => ({ ...n, source: n.source || "News" })),
      ...filteredSocialPosts.map((p) => ({
        title: p.title,
        source: p.source === "reddit" ? "Reddit" : "StockTwits",
        url: p.url,
        sentiment: p.sentiment,
        publishedAt: p.publishedAt,
      })),
    ].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Combined sentiment
    let newsScore = 0;
    for (const n of filtered) {
      if (n.sentiment === "positive") newsScore++;
      else if (n.sentiment === "negative") newsScore--;
    }
    const newsSentiment = filtered.length > 0 ? Math.round((newsScore / filtered.length) * 100) : 0;

    // Blend news + social sentiment
    let overall = newsSentiment;
    if (social.overall !== 0 && newsSentiment !== 0) {
      overall = Math.round(newsSentiment * 0.5 + social.overall * 0.5);
    } else if (social.overall !== 0) {
      overall = social.overall;
    }

    return NextResponse.json({
      news: combinedFeed.slice(0, 25),
      sentiment: {
        overall,
        positive: combinedFeed.filter((n) => n.sentiment === "positive").length,
        negative: combinedFeed.filter((n) => n.sentiment === "negative").length,
        neutral: combinedFeed.filter((n) => n.sentiment === "neutral").length,
        total: combinedFeed.length,
      },
      social: {
        sentiment: social.overall,
        sources: social.sources,
      },
      timeframe,
    });
  } catch (error) {
    console.error("News fetch failed:", error);
    return NextResponse.json({
      news: [],
      sentiment: { overall: 0, positive: 0, negative: 0, neutral: 0, total: 0 },
      social: { sentiment: 0, sources: [] },
      timeframe,
    }, { status: 500 });
  }
}
