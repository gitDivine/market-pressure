import { NextRequest, NextResponse } from "next/server";
import { getCryptoNews, getGoogleNews } from "@/lib/api/news";

const SAFE_RE = /^[A-Za-z0-9 _-]{1,40}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawAsset = searchParams.get("asset") || "";
  const rawQuery = searchParams.get("query") || "";
  const asset = SAFE_RE.test(rawAsset) ? rawAsset : undefined;
  const query = SAFE_RE.test(rawQuery) ? rawQuery : asset || "crypto";

  try {
    const [cryptoNews, googleNews] = await Promise.all([
      getCryptoNews(asset),
      getGoogleNews(query + " price"),
    ]);

    // Merge and deduplicate by title similarity
    const allNews = [...cryptoNews, ...googleNews];
    const seen = new Set<string>();
    const unique = allNews.filter((n) => {
      const key = n.title.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Overall sentiment score
    let sentimentScore = 0;
    for (const n of unique) {
      if (n.sentiment === "positive") sentimentScore++;
      else if (n.sentiment === "negative") sentimentScore--;
    }

    const overall = unique.length > 0
      ? Math.round((sentimentScore / unique.length) * 100)
      : 0;

    return NextResponse.json({
      news: unique.slice(0, 20),
      sentiment: {
        overall,
        positive: unique.filter((n) => n.sentiment === "positive").length,
        negative: unique.filter((n) => n.sentiment === "negative").length,
        neutral: unique.filter((n) => n.sentiment === "neutral").length,
        total: unique.length,
      },
    });
  } catch (error) {
    console.error("News fetch failed:", error);
    return NextResponse.json({ news: [], sentiment: { overall: 0, total: 0 } }, { status: 500 });
  }
}
