"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
} from "lucide-react";
import type { VerdictResult, TimeframeAnalysis } from "@/lib/analysis/verdict";
import type { Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  data: VerdictResult | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  selectedTimeframe?: Timeframe;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  strong_bullish: { label: "Strong Bullish", color: "text-green", bg: "bg-green-glow", border: "border-green/20", icon: TrendingUp },
  bullish:        { label: "Bullish",        color: "text-green", bg: "bg-green-glow", border: "border-green/20", icon: TrendingUp },
  neutral:        { label: "Neutral",        color: "text-yellow", bg: "bg-yellow/5",  border: "border-yellow/20", icon: Minus },
  bearish:        { label: "Bearish",        color: "text-red",   bg: "bg-red-glow",   border: "border-red/20",   icon: TrendingDown },
  strong_bearish: { label: "Strong Bearish", color: "text-red",   bg: "bg-red-glow",   border: "border-red/20",   icon: TrendingDown },
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

const DIMENSION_LABELS = [
  { key: "structure" as const, label: "Structure" },
  { key: "trend" as const,     label: "Trend" },
  { key: "pressure" as const,  label: "Pressure" },
  { key: "sentiment" as const, label: "Sentiment" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function VerdictPanel({ data, loading, error, onRetry, selectedTimeframe }: Props) {
  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red/20 bg-red-glow p-8 text-center">
        <p className="text-sm font-medium text-red">Failed to load verdict data</p>
        <p className="text-xs text-muted">Analysis engine could not produce a verdict.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 min-h-[44px] rounded-lg bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-card-hover active:scale-95"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // ── Loading / skeleton state ────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        {/* Header skeleton */}
        <div className="skeleton mb-4 h-14 w-full rounded-xl" />
        {/* Dimension bars skeleton */}
        <div className="mb-4 space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-7 w-full rounded-lg" />
          ))}
        </div>
        {/* TF grid skeleton */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={cn("skeleton h-24 rounded-lg", i > 4 && "hidden lg:block")}
            />
          ))}
        </div>
      </div>
    );
  }

  const cfg = VERDICT_CONFIG[data.verdict];
  const VerdictIcon = cfg.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      {/* ── 1. Verdict Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "mb-4 rounded-xl border p-3 sm:mb-5 sm:p-4",
          cfg.border,
          cfg.bg,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <VerdictIcon className={cn("h-5 w-5 sm:h-6 sm:w-6", cfg.color)} />
            <div>
              <p className={cn("text-base font-bold sm:text-lg", cfg.color)}>
                {cfg.label}
              </p>
              <p className="text-[10px] text-muted sm:text-xs">
                {data.tradingContext === "scalp" ? "Scalp" : data.tradingContext === "intraday" ? "Intraday" : "Position"} Verdict
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold sm:text-2xl">{data.confidence}%</p>
            <p className="text-[10px] text-muted sm:text-xs">Confidence</p>
          </div>
        </div>
        {/* Dual verdict: scalp vs position */}
        {data.scalpVerdict !== data.positionVerdict && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2">
            <DualVerdictBadge label="Scalp" verdict={data.scalpVerdict} />
            <span className="text-[10px] font-medium text-muted">vs</span>
            <DualVerdictBadge label="Position" verdict={data.positionVerdict} />
          </div>
        )}
      </motion.div>

      {/* ── 2. Dimensions Bar ──────────────────────────────────────────── */}
      <div className="mb-4 space-y-2 sm:mb-5">
        {DIMENSION_LABELS.map((dim, i) => {
          const score = data.dimensions[dim.key]; // -100 to +100
          const isPositive = score > 5;
          const isNegative = score < -5;
          const barColor = isPositive
            ? "bg-green"
            : isNegative
              ? "bg-red"
              : "bg-yellow";
          const textColor = isPositive
            ? "text-green"
            : isNegative
              ? "text-red"
              : "text-yellow";

          return (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted">{dim.label}</span>
                <span className={cn("font-semibold", textColor)}>
                  {score > 0 ? "+" : ""}{score}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-border">
                {/* Center marker */}
                <div className="absolute inset-y-0 left-1/2 z-10 w-px bg-muted/50" />
                {/* Fill bar — grows from center */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.abs(score) / 2}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "absolute inset-y-0 h-full rounded-full",
                    barColor,
                    score >= 0 ? "left-1/2" : "right-1/2",
                  )}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── 3. Selected TF Breakdown ────────────────────────────────── */}
      {selectedTimeframe && (() => {
        const selectedTf = data.timeframes.find((t) => t.timeframe === selectedTimeframe);
        if (!selectedTf) return null;
        return (
          <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:mb-5 sm:p-4">
            <p className="mb-2 text-xs font-semibold text-accent">{TF_LABELS[selectedTimeframe]} Breakdown</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniDimCard label="Structure" value={selectedTf.structure.structure} color={selectedTf.structure.structure === "uptrend" ? "green" : selectedTf.structure.structure === "downtrend" ? "red" : "yellow"} detail={selectedTf.structure.description} />
              <MiniDimCard label="Trend" value={selectedTf.trend.trend} color={selectedTf.trend.trend === "bullish" ? "green" : selectedTf.trend.trend === "bearish" ? "red" : "yellow"} detail={selectedTf.trend.description} />
              <MiniDimCard label="Pressure" value={`${selectedTf.pressure.buyPressure}% buy`} color={selectedTf.pressure.buyPressure > 55 ? "green" : selectedTf.pressure.buyPressure < 45 ? "red" : "yellow"} detail={`RSI ${selectedTf.pressure.rsi} · MFI ${selectedTf.pressure.mfi}`} />
              <MiniDimCard label="Shift" value={selectedTf.shift.detected ? selectedTf.shift.severity : "aligned"} color={selectedTf.shift.severity === "alert" ? "red" : selectedTf.shift.severity === "warning" ? "yellow" : "green"} detail={selectedTf.shift.description} />
            </div>
          </div>
        );
      })()}

      {/* ── 4. Per-Timeframe Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {data.timeframes.map((tf, i) => (
          <TimeframeCard key={tf.timeframe} tf={tf} index={i} highlighted={tf.timeframe === selectedTimeframe} />
        ))}
      </div>

      {/* ── 4. Shift Alerts ────────────────────────────────────────────── */}
      {data.shifts.length > 0 && (
        <div className="mt-4 space-y-2 sm:mt-5">
          {data.shifts.map((s, i) => (
            <motion.div
              key={`${s.timeframe}-${i}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3",
                s.shift.severity === "alert"
                  ? "border-red/30 bg-red-glow"
                  : "border-yellow/30 bg-yellow/5",
              )}
            >
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  s.shift.severity === "alert" ? "text-red" : "text-yellow",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted">
                  {TF_LABELS[s.timeframe]}{" "}
                  <span
                    className={cn(
                      "uppercase",
                      s.shift.severity === "alert" ? "text-red" : "text-yellow",
                    )}
                  >
                    {s.shift.severity}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-xs leading-relaxed",
                    s.shift.severity === "alert" ? "text-red/90" : "text-yellow/90",
                  )}
                >
                  {s.shift.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── 5. Summary ─────────────────────────────────────────────────── */}
      <div className="mt-4 rounded-xl bg-background/50 p-3 sm:mt-5 sm:p-3.5">
        <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
          {data.summary}
        </p>
      </div>
    </div>
  );
}

// ─── Timeframe Card ─────────────────────────────────────────────────────────

function TimeframeCard({ tf, index, highlighted }: { tf: TimeframeAnalysis; index: number; highlighted?: boolean }) {
  const structureDir = tf.structure.structure;
  const trendDir = tf.trend.trend;
  const buyPct = tf.pressure.buyPressure;
  const hasShift = tf.shift.severity !== "none";

  // Determine card border color — highlight selected TF with accent ring
  const cardBorder = highlighted
    ? "border-accent ring-1 ring-accent/30 bg-accent/5"
    : structureDir === "uptrend"
      ? "border-green/20 bg-green-glow"
      : structureDir === "downtrend"
        ? "border-red/20 bg-red-glow"
        : "border-border bg-card-hover";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border p-2 text-center sm:gap-1.5 sm:p-2.5",
        cardBorder,
      )}
    >
      {/* TF label */}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {TF_LABELS[tf.timeframe]}
      </span>

      {/* Icons row: structure, trend, shift */}
      <div className="flex items-center gap-1.5">
        {/* Structure icon */}
        <StructureIcon structure={structureDir} />
        {/* Trend icon */}
        <TrendIcon trend={trendDir} />
        {/* Shift warning */}
        {hasShift ? (
          <AlertTriangle
            className={cn(
              "h-3 w-3",
              tf.shift.severity === "alert" ? "text-red" : "text-yellow",
            )}
          />
        ) : (
          <CheckCircle className="h-3 w-3 text-green/50" />
        )}
      </div>

      {/* Pressure mini bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-red/30">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${buyPct}%` }}
          transition={{ duration: 0.6, delay: index * 0.04 }}
          className="h-full rounded-full bg-green"
        />
      </div>

      {/* Pressure percentage */}
      <span
        className={cn(
          "text-xs font-bold",
          buyPct > 55 ? "text-green" : buyPct < 45 ? "text-red" : "text-yellow",
        )}
      >
        {buyPct}%
      </span>
    </motion.div>
  );
}

// ─── Structure direction icon ───────────────────────────────────────────────

function StructureIcon({ structure }: { structure: "uptrend" | "downtrend" | "ranging" }) {
  switch (structure) {
    case "uptrend":
      return <ArrowUpRight className="h-3 w-3 text-green" />;
    case "downtrend":
      return <ArrowDownRight className="h-3 w-3 text-red" />;
    case "ranging":
    default:
      return <ArrowRight className="h-3 w-3 text-yellow" />;
  }
}

// ─── Trend direction icon ───────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: "bullish" | "bearish" | "neutral" }) {
  switch (trend) {
    case "bullish":
      return <TrendingUp className="h-3 w-3 text-green" />;
    case "bearish":
      return <TrendingDown className="h-3 w-3 text-red" />;
    case "neutral":
    default:
      return <Minus className="h-3 w-3 text-yellow" />;
  }
}

// ─── Mini Dimension Card (for selected TF breakdown) ────────────────────────

function MiniDimCard({ label, value, color, detail }: { label: string; value: string; color: "green" | "red" | "yellow"; detail: string }) {
  const colors = {
    green: "border-green/20 bg-green-glow text-green",
    red: "border-red/20 bg-red-glow text-red",
    yellow: "border-yellow/20 bg-yellow/5 text-yellow",
  };
  return (
    <div className={cn("rounded-lg border p-2", colors[color])}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-xs font-bold capitalize">{value}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

// ─── Dual Verdict Badge ─────────────────────────────────────────────────────

type VerdictLabelType = "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";

function DualVerdictBadge({ label, verdict }: { label: string; verdict: VerdictLabelType }) {
  const cfg = VERDICT_CONFIG[verdict];
  const Icon = cfg.icon;
  return (
    <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border/50 px-2 py-1.5">
      <Icon className={cn("h-3 w-3 shrink-0", cfg.color)} />
      <div className="min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className={cn("text-xs font-bold", cfg.color)}>{cfg.label}</p>
      </div>
    </div>
  );
}
