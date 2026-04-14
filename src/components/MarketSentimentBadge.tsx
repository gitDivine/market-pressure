"use client";

import { useState, useEffect, memo } from "react";
import type { AssetClass } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  assetClass: AssetClass;
}

interface FearGreedData {
  value: number;
  label: string;
  source: string;
}

function fgDot(val: number) {
  if (val >= 55) return "🟢";
  if (val <= 45) return "🔴";
  return "🟡";
}

function assetLabel(cls: AssetClass) {
  switch (cls) {
    case "crypto": return "Crypto";
    case "stocks": return "Stock";
    case "indices": return "Index";
    case "funds": return "Fund";
    case "forex": return "Global";
    case "bonds": return "Global";
    default: return "Global";
  }
}

function MarketSentimentBadge({ assetClass }: Props) {
  const [data, setData] = useState<FearGreedData | null>(null);

  useEffect(() => {
    // For forex/bonds, fetch stock market sentiment (VIX-derived) as global context

    let cancelled = false;

    const fetchFG = async () => {
      try {
        // For forex/bonds, use stocks context to get VIX-derived global sentiment
        const cls = (assetClass === "forex" || assetClass === "bonds") ? "stocks" : assetClass;
        const res = await fetch(
          `/api/context?class=${cls}&symbol=&timeframe=1d&base=&quote=`
        );
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled && d.fearGreed) setData(d.fearGreed);
      } catch {}
    };

    fetchFG();
    return () => { cancelled = true; };
  }, [assetClass]);

  if (!data) return null;

  const isBullish = data.value >= 55;
  const isBearish = data.value <= 45;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium sm:text-sm",
        isBullish && "border-green/30 bg-green/5 text-green",
        isBearish && "border-red/30 bg-red/5 text-red",
        !isBullish && !isBearish && "border-yellow/30 bg-yellow/5 text-yellow"
      )}
    >
      <span>{fgDot(data.value)}</span>
      <span className="hidden sm:inline">The {assetLabel(assetClass)} Market:</span>
      <span className="sm:hidden">{assetLabel(assetClass)}:</span>
      <span className="font-semibold tabular-nums">
        {data.label} ({data.value})
      </span>
    </div>
  );
}

export default memo(MarketSentimentBadge);
