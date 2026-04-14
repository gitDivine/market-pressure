"use client";

import { useState, useEffect, memo } from "react";
import { Loader2 } from "lucide-react";
import type { PairInfo, Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  pair: PairInfo;
  timeframe: Timeframe;
}

interface ContextData {
  currencyStrength?: {
    base: { currency: string; strength: number };
    quote: { currency: string; strength: number };
    all?: Record<string, number>;
  };
  interestRates?: {
    base: { currency: string; rate: number; bank: string };
    quote: { currency: string; rate: number; bank: string };
    differential: number;
    favored: string;
  };
  bondYields?: {
    base: { currency: string; yield: number; change: string } | null;
    quote: { currency: string; yield: number; change: string } | null;
  };
  sectorStrength?: {
    sector: string;
    avgChange: number;
    stockCount: number;
    direction: "strong" | "weak" | "neutral";
  };
  relativeMomentum?: {
    vsUSD: { change: number; direction: string };
    vsBTC: { change: number; direction: string } | null;
  };
  fearGreed?: {
    value: number;
    label: string;
    source: string;
  };
}

function strengthColor(val: number) {
  if (val >= 65) return "text-green";
  if (val <= 35) return "text-red";
  return "text-yellow";
}

function strengthDot(val: number) {
  if (val >= 65) return "🟢";
  if (val <= 35) return "🔴";
  return "🟡";
}

function strengthLabel(val: number) {
  if (val >= 75) return "Very Strong";
  if (val >= 60) return "Strong";
  if (val >= 40) return "Neutral";
  if (val >= 25) return "Weak";
  return "Very Weak";
}

function fgEmoji(val: number) {
  if (val >= 75) return "🤑";
  if (val >= 55) return "😊";
  if (val >= 45) return "😐";
  if (val >= 25) return "😨";
  return "😱";
}

function StrengthContext({ pair, timeframe }: Props) {
  const [data, setData] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchContext = async () => {
      try {
        const params = new URLSearchParams({
          symbol: pair.symbol,
          class: pair.class,
          timeframe,
          base: pair.base,
          quote: pair.quote,
        });
        const res = await fetch(`/api/context?${params}`);
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContext();
    return () => { cancelled = true; };
  }, [pair, timeframe]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading market context...
        </div>
      </div>
    );
  }

  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Strength & Context
      </h3>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Currency Strength — Forex */}
        {data.currencyStrength && (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
              <span className="text-xs text-muted">{data.currencyStrength.base.currency} Strength</span>
              <span className={cn("text-sm font-semibold tabular-nums", strengthColor(data.currencyStrength.base.strength))}>
                {strengthDot(data.currencyStrength.base.strength)} {strengthLabel(data.currencyStrength.base.strength)} ({data.currencyStrength.base.strength})
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
              <span className="text-xs text-muted">{data.currencyStrength.quote.currency} Strength</span>
              <span className={cn("text-sm font-semibold tabular-nums", strengthColor(data.currencyStrength.quote.strength))}>
                {strengthDot(data.currencyStrength.quote.strength)} {strengthLabel(data.currencyStrength.quote.strength)} ({data.currencyStrength.quote.strength})
              </span>
            </div>
          </>
        )}

        {/* Interest Rate Differential — Forex */}
        {data.interestRates && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5 sm:col-span-2">
            <span className="text-xs text-muted">Rate Differential</span>
            <span className="text-sm font-medium">
              {data.interestRates.base.currency} {data.interestRates.base.rate}% vs {data.interestRates.quote.currency} {data.interestRates.quote.rate}%
              <span className={cn(
                "ml-2 text-xs font-semibold",
                data.interestRates.favored === data.interestRates.base.currency ? "text-green" :
                data.interestRates.favored === data.interestRates.quote.currency ? "text-red" : "text-yellow"
              )}>
                → {data.interestRates.favored === "neutral" ? "Balanced" : `${data.interestRates.favored} favored`}
              </span>
            </span>
          </div>
        )}

        {/* Bond Yields — Forex */}
        {data.bondYields && (data.bondYields.base || data.bondYields.quote) && (
          <>
            {data.bondYields.base && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
                <span className="text-xs text-muted">{data.bondYields.base.currency} 10Y Yield</span>
                <span className={cn("text-sm font-semibold", data.bondYields.base.change === "rising" ? "text-green" : data.bondYields.base.change === "falling" ? "text-red" : "text-yellow")}>
                  {data.bondYields.base.change === "rising" ? "🟢" : data.bondYields.base.change === "falling" ? "🔴" : "🟡"} {data.bondYields.base.change.charAt(0).toUpperCase() + data.bondYields.base.change.slice(1)} ({data.bondYields.base.yield.toFixed(2)}%)
                </span>
              </div>
            )}
            {data.bondYields.quote && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
                <span className="text-xs text-muted">{data.bondYields.quote.currency} 10Y Yield</span>
                <span className={cn("text-sm font-semibold", data.bondYields.quote.change === "rising" ? "text-green" : data.bondYields.quote.change === "falling" ? "text-red" : "text-yellow")}>
                  {data.bondYields.quote.change === "rising" ? "🟢" : data.bondYields.quote.change === "falling" ? "🔴" : "🟡"} {data.bondYields.quote.change.charAt(0).toUpperCase() + data.bondYields.quote.change.slice(1)} ({data.bondYields.quote.yield.toFixed(2)}%)
                </span>
              </div>
            )}
          </>
        )}

        {/* Sector Strength — Stocks */}
        {data.sectorStrength && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5 sm:col-span-2">
            <span className="text-xs text-muted">{data.sectorStrength.sector} Sector</span>
            <span className={cn("text-sm font-semibold", data.sectorStrength.direction === "strong" ? "text-green" : data.sectorStrength.direction === "weak" ? "text-red" : "text-yellow")}>
              {data.sectorStrength.direction === "strong" ? "🟢" : data.sectorStrength.direction === "weak" ? "🔴" : "🟡"} {data.sectorStrength.direction.charAt(0).toUpperCase() + data.sectorStrength.direction.slice(1)} ({data.sectorStrength.avgChange > 0 ? "+" : ""}{data.sectorStrength.avgChange}%)
            </span>
          </div>
        )}

        {/* Relative Momentum — Crypto */}
        {data.relativeMomentum && (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
              <span className="text-xs text-muted">{pair.base} vs USD</span>
              <span className={cn("text-sm font-semibold", data.relativeMomentum.vsUSD.direction === "strong" ? "text-green" : "text-red")}>
                {data.relativeMomentum.vsUSD.direction === "strong" ? "🟢" : "🔴"} {data.relativeMomentum.vsUSD.direction === "strong" ? "Strong" : "Weak"} ({data.relativeMomentum.vsUSD.change > 0 ? "+" : ""}{data.relativeMomentum.vsUSD.change}%)
              </span>
            </div>
            {data.relativeMomentum.vsBTC && pair.base.toUpperCase() !== "BTC" && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card-hover/30 px-3 py-2.5">
                <span className="text-xs text-muted">{pair.base} vs BTC</span>
                <span className={cn("text-sm font-semibold", data.relativeMomentum.vsBTC.direction === "outperforming" ? "text-green" : "text-red")}>
                  {data.relativeMomentum.vsBTC.direction === "outperforming" ? "🟢" : "🔴"} {data.relativeMomentum.vsBTC.direction === "outperforming" ? "Outperforming" : "Underperforming"} ({data.relativeMomentum.vsBTC.change > 0 ? "+" : ""}{data.relativeMomentum.vsBTC.change}%)
                </span>
              </div>
            )}
          </>
        )}

        {/* Fear & Greed moved to top bar — MarketSentimentBadge */}
      </div>
    </div>
  );
}

export default memo(StrengthContext);
