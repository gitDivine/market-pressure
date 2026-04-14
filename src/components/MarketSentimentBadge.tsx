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

function fgEmoji(val: number) {
  if (val >= 75) return "🤑";
  if (val >= 55) return "😊";
  if (val >= 45) return "😐";
  if (val >= 25) return "😨";
  return "😱";
}

function assetLabel(cls: AssetClass) {
  switch (cls) {
    case "crypto": return "Crypto";
    case "stocks": return "Stock";
    case "indices": return "Index";
    case "funds": return "Fund";
    default: return "Market";
  }
}

function MarketSentimentBadge({ assetClass }: Props) {
  const [data, setData] = useState<FearGreedData | null>(null);

  useEffect(() => {
    // Only show for stocks, crypto, indices, funds (not forex/bonds)
    if (assetClass === "forex" || assetClass === "bonds") {
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchFG = async () => {
      try {
        const res = await fetch(
          `/api/context?class=${assetClass}&symbol=&timeframe=1d&base=&quote=`
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
      <span>{fgEmoji(data.value)}</span>
      <span className="hidden sm:inline">The {assetLabel(assetClass)} Market:</span>
      <span className="sm:hidden">{assetLabel(assetClass)}:</span>
      <span className="font-semibold tabular-nums">
        {data.label} ({data.value})
      </span>
    </div>
  );
}

export default memo(MarketSentimentBadge);
