// Social media sentiment: StockTwits + Reddit (both free, no auth)

interface SocialPost {
  source: "stocktwits" | "reddit";
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  url: string;
  publishedAt: string;
}

interface SocialSentiment {
  overall: number; // -100 to 100
  posts: SocialPost[];
  sources: {
    name: string;
    sentiment: number; // -100 to 100
    count: number;
  }[];
}

// --- STOCKTWITS ---
// Free, no auth: https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json
export async function getStockTwitsSentiment(symbol: string): Promise<{ posts: SocialPost[]; sentiment: number }> {
  try {
    // StockTwits uses ticker symbols (BTC.X for crypto, AAPL for stocks)
    const stwSymbol = symbol.length <= 5 ? symbol : `${symbol}.X`;
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(stwSymbol)}.json`,
      {
        next: { revalidate: 120 },
        headers: { "User-Agent": "MarketAssist/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { posts: [], sentiment: 0 };

    const data = await res.json();
    const messages: Array<{
      body: string;
      entities?: { sentiment?: { basic: string } };
      created_at: string;
    }> = data.messages || [];

    let bullish = 0;
    let bearish = 0;
    const posts: SocialPost[] = [];

    for (const msg of messages.slice(0, 20)) {
      const sentimentLabel = msg.entities?.sentiment?.basic;
      let sentiment: "positive" | "negative" | "neutral" = "neutral";
      if (sentimentLabel === "Bullish") { sentiment = "positive"; bullish++; }
      else if (sentimentLabel === "Bearish") { sentiment = "negative"; bearish++; }

      posts.push({
        source: "stocktwits",
        title: msg.body.slice(0, 150),
        sentiment,
        url: `https://stocktwits.com/symbol/${stwSymbol}`,
        publishedAt: msg.created_at || new Date().toISOString(),
      });
    }

    const total = bullish + bearish;
    const sentiment = total > 0 ? Math.round(((bullish - bearish) / total) * 100) : 0;

    return { posts, sentiment };
  } catch {
    return { posts: [], sentiment: 0 };
  }
}

// --- REDDIT ---
// Public JSON API — no OAuth needed for read-only search
const SUBREDDITS: Record<string, string[]> = {
  crypto: ["cryptocurrency", "CryptoMarkets", "Bitcoin", "ethtrader"],
  forex: ["Forex", "ForexTrading"],
  stocks: ["wallstreetbets", "stocks", "investing", "StockMarket"],
  indices: ["wallstreetbets", "stocks", "investing"],
};

const POSITIVE_WORDS = new Set([
  "bull", "bullish", "moon", "pump", "buy", "long", "breakout", "rally",
  "surge", "gain", "profit", "green", "ath", "uptrend", "calls", "rocket",
]);
const NEGATIVE_WORDS = new Set([
  "bear", "bearish", "dump", "sell", "short", "crash", "drop", "red",
  "loss", "decline", "puts", "fear", "rug", "scam", "bubble", "overvalued",
]);

function scoreRedditSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w)) score++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export async function getRedditSentiment(
  symbol: string,
  assetClass: string
): Promise<{ posts: SocialPost[]; sentiment: number }> {
  try {
    const subs = SUBREDDITS[assetClass] || SUBREDDITS.crypto;
    const subreddit = subs.join("+");
    const query = encodeURIComponent(symbol);

    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/search.json?q=${query}&sort=new&limit=15&t=week&restrict_sr=on`,
      {
        next: { revalidate: 300 },
        headers: { "User-Agent": "MarketAssist/1.0 (educational project)" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { posts: [], sentiment: 0 };

    const data = await res.json();
    const children: Array<{
      data: {
        title: string;
        selftext: string;
        permalink: string;
        created_utc: number;
        score: number;
      };
    }> = data.data?.children || [];

    let positive = 0;
    let negative = 0;
    const posts: SocialPost[] = [];

    for (const child of children) {
      const post = child.data;
      const text = post.title + " " + (post.selftext || "").slice(0, 200);
      const sentiment = scoreRedditSentiment(text);

      if (sentiment === "positive") positive++;
      else if (sentiment === "negative") negative++;

      posts.push({
        source: "reddit",
        title: post.title.slice(0, 150),
        sentiment,
        url: `https://reddit.com${post.permalink}`,
        publishedAt: new Date(post.created_utc * 1000).toISOString(),
      });
    }

    const total = positive + negative;
    const sentiment = total > 0 ? Math.round(((positive - negative) / total) * 100) : 0;

    return { posts, sentiment };
  } catch {
    return { posts: [], sentiment: 0 };
  }
}

// --- COMBINED ---
export async function getSocialSentiment(
  symbol: string,
  assetClass: string
): Promise<SocialSentiment> {
  const [stocktwits, reddit] = await Promise.allSettled([
    getStockTwitsSentiment(symbol),
    getRedditSentiment(symbol, assetClass),
  ]);

  const stwResult = stocktwits.status === "fulfilled" ? stocktwits.value : { posts: [], sentiment: 0 };
  const redditResult = reddit.status === "fulfilled" ? reddit.value : { posts: [], sentiment: 0 };

  const allPosts = [...stwResult.posts, ...redditResult.posts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Weighted average: StockTwits sentiment is more structured, Reddit is noisier
  const sources = [];
  let weightedSum = 0;
  let totalWeight = 0;

  if (stwResult.posts.length > 0) {
    sources.push({ name: "StockTwits", sentiment: stwResult.sentiment, count: stwResult.posts.length });
    weightedSum += stwResult.sentiment * 0.6;
    totalWeight += 0.6;
  }
  if (redditResult.posts.length > 0) {
    sources.push({ name: "Reddit", sentiment: redditResult.sentiment, count: redditResult.posts.length });
    weightedSum += redditResult.sentiment * 0.4;
    totalWeight += 0.4;
  }

  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { overall, posts: allPosts, sources };
}
