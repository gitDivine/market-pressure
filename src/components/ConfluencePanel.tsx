"use client";

import { motion } from "framer-motion";
import { Layers, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { ConfluenceResult, Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  data: ConfluenceResult | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const TREND_CONFIG = {
  strong_bullish: { label: "Strong Bullish", color: "text-green", bg: "bg-green", icon: TrendingUp },
  bullish: { label: "Bullish", color: "text-green", bg: "bg-green/70", icon: TrendingUp },
  neutral: { label: "Neutral", color: "text-yellow", bg: "bg-yellow/70", icon: Minus },
  bearish: { label: "Bearish", color: "text-red", bg: "bg-red/70", icon: TrendingDown },
  strong_bearish: { label: "Strong Bearish", color: "text-red", bg: "bg-red", icon: TrendingDown },
};

const TF_LABELS: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "1w": "1W",
};

export default function ConfluencePanel({ data, loading, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red/20 bg-red-glow p-8 text-center">
        <p className="text-sm font-medium text-red">Failed to load confluence data</p>
        <p className="text-xs text-muted">Could not fetch multi-timeframe data.</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-1 min-h-[44px] rounded-lg bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-card-hover active:scale-95">
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="skeleton mb-4 h-5 w-48 rounded" />
        <div className="skeleton mb-4 h-20 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={cn("skeleton h-20 rounded-lg", i > 4 && "hidden sm:block")} />
          ))}
        </div>
      </div>
    );
  }

  const trendCfg = TREND_CONFIG[data.overallTrend];
  const TrendIcon = trendCfg.icon;
  const hasDivergence = data.summary.includes("Divergence") || data.summary.includes("surging") || data.summary.includes("shifting");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 sm:mb-5">
        <Layers className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-muted">Multi-Timeframe Confluence</h3>
      </div>

      {/* Overall Trend Card */}
      <div className={cn(
        "mb-4 rounded-xl border p-3 sm:mb-5 sm:p-4",
        data.overallTrend.includes("bullish") ? "border-green/20 bg-green-glow" :
        data.overallTrend.includes("bearish") ? "border-red/20 bg-red-glow" :
        "border-yellow/20 bg-yellow/5"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <TrendIcon className={cn("h-5 w-5", trendCfg.color)} />
            <div>
              <p className={cn("text-base font-bold sm:text-lg", trendCfg.color)}>{trendCfg.label}</p>
              <p className="text-[10px] text-muted sm:text-xs">Overall Confluence</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold sm:text-2xl">{data.confidence}%</p>
            <p className="text-[10px] text-muted sm:text-xs">Confidence</p>
          </div>
        </div>
      </div>

      {/* Divergence Alert */}
      {hasDivergence && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-yellow/30 bg-yellow/5 p-3 sm:mb-5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow" />
          <p className="text-xs leading-relaxed text-yellow/90">
            {data.summary.split("\n\n").find((s) => s.includes("Divergence") || s.includes("surging") || s.includes("shifting")) || ""}
          </p>
        </motion.div>
      )}

      {/* Timeframe Grid — 4 cols on mobile, 7 on sm+ */}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {data.timeframes.map((tf, i) => {
          const bp = tf.pressure.buyPressure;
          return (
            <motion.div
              key={tf.timeframe}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-center sm:gap-1.5 sm:p-2.5",
                tf.trend === "bullish" ? "border-green/20 bg-green-glow" :
                tf.trend === "bearish" ? "border-red/20 bg-red-glow" :
                "border-border bg-card-hover"
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {TF_LABELS[tf.timeframe]}
              </span>
              {/* Mini bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-red/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bp}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="h-full rounded-full bg-green"
                />
              </div>
              <span className={cn(
                "text-xs font-bold",
                tf.trend === "bullish" ? "text-green" : tf.trend === "bearish" ? "text-red" : "text-yellow"
              )}>
                {bp}%
              </span>
              <span className="hidden text-[9px] text-muted sm:block">w: {tf.weight}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 rounded-xl bg-background/50 p-3 sm:mt-5 sm:p-3.5">
        <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
          {data.summary}
        </p>
      </div>
    </div>
  );
}
