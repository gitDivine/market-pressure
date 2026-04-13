import type { Timeframe, PressureData } from "../types";
import type { StructureResult } from "./structure";
import type { TrendResult, ShiftResult } from "./trend";

// ─── Verdict types ───────────────────────────────────────────────────────────

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  structure: StructureResult;
  trend: TrendResult;
  pressure: PressureData;
  shift: ShiftResult;
}

export interface VerdictResult {
  verdict:
    | "strong_bullish"
    | "bullish"
    | "neutral"
    | "bearish"
    | "strong_bearish";
  confidence: number; // 0-100
  timeframes: TimeframeAnalysis[];
  dimensions: {
    structure: number; // -100 to +100
    trend: number;
    pressure: number;
    sentiment: number;
  };
  // Dual verdict: shows both scalp and position perspective
  scalpVerdict: VerdictLabel;
  positionVerdict: VerdictLabel;
  tradingContext: TradingContext;
  shifts: { timeframe: Timeframe; shift: ShiftResult }[];
  summary: string;
}

type VerdictLabel = "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";

// ─── Constants ───────────────────────────────────────────────────────────────

// Adaptive weights based on trading context (selected timeframe)
type TradingContext = "scalp" | "intraday" | "position";

const CONTEXT_WEIGHTS: Record<TradingContext, Record<Timeframe, number>> = {
  // Scalping (1m-15m selected): LTF dominates
  scalp: { "1m": 0.15, "5m": 0.18, "15m": 0.17, "1h": 0.10, "4h": 0.15, "1d": 0.15, "1w": 0.10 },
  // Intraday/Swing (1h-4h selected): balanced with HTF anchor
  intraday: { "1m": 0.03, "5m": 0.05, "15m": 0.07, "1h": 0.15, "4h": 0.25, "1d": 0.25, "1w": 0.20 },
  // Position (1d-1w selected): HTF dominates
  position: { "1m": 0.02, "5m": 0.03, "15m": 0.05, "1h": 0.10, "4h": 0.20, "1d": 0.32, "1w": 0.28 },
};

// Fixed weights for the "other side" verdict (always position for scalp context, always scalp for position context)
const SCALP_WEIGHTS = CONTEXT_WEIGHTS.scalp;
const POSITION_WEIGHTS = CONTEXT_WEIGHTS.position;

function getContext(tf: Timeframe): TradingContext {
  if (tf === "1m" || tf === "5m" || tf === "15m") return "scalp";
  if (tf === "1h" || tf === "4h") return "intraday";
  return "position";
}

const DIMENSION_WEIGHTS = {
  structure: 0.35,
  trend: 0.25,
  pressure: 0.25,
  sentiment: 0.15,
};

const HIGHER_TFS: Timeframe[] = ["1d", "1w"];

// ─── Scoring helpers ─────────────────────────────────────────────────────────

/** Convert structure result to -100..+100 score */
function scoreStructure(s: StructureResult): number {
  switch (s.structure) {
    case "uptrend":
      return s.strength;
    case "downtrend":
      return -s.strength;
    case "ranging":
    default:
      return 0;
  }
}

/** Convert trend result to -100..+100 score */
function scoreTrend(t: TrendResult): number {
  switch (t.trend) {
    case "bullish":
      return t.strength;
    case "bearish":
      return -t.strength;
    case "neutral":
    default:
      return 0;
  }
}

/** Convert pressure data to -100..+100 score */
function scorePressure(p: PressureData): number {
  // 70% buy → +40, 30% buy → -40, 50% buy → 0
  return (p.buyPressure - 50) * 2;
}

/** Weighted average of per-timeframe scores for a single dimension */
function weightedDimensionScore(
  analyses: TimeframeAnalysis[],
  scoreFn: (a: TimeframeAnalysis) => number,
  weights: Record<Timeframe, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const a of analyses) {
    const w = weights[a.timeframe] ?? 0.05;
    weightedSum += scoreFn(a) * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function calculateVerdict(
  timeframeAnalyses: TimeframeAnalysis[],
  sentimentScore = 0,
  selectedTimeframe: Timeframe = "1h"
): VerdictResult {
  const context = getContext(selectedTimeframe);

  if (timeframeAnalyses.length === 0) {
    return {
      verdict: "neutral",
      confidence: 0,
      timeframes: [],
      dimensions: { structure: 0, trend: 0, pressure: 0, sentiment: 0 },
      scalpVerdict: "neutral",
      positionVerdict: "neutral",
      tradingContext: context,
      shifts: [],
      summary: "No data available for analysis.",
    };
  }

  // ── 1. Compute scores with context-adaptive weights ───────────────────
  const activeWeights = CONTEXT_WEIGHTS[context];

  const structureScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scoreStructure(a.structure), activeWeights),
    -100, 100
  );
  const trendScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scoreTrend(a.trend), activeWeights),
    -100, 100
  );
  const pressureScore = clamp(
    weightedDimensionScore(timeframeAnalyses, (a) => scorePressure(a.pressure), activeWeights),
    -100, 100
  );
  const sentiment = clamp(sentimentScore, -100, 100);

  // ── 2. HTF structure override (scaled by context) ─────────────────────
  // Override is strongest in position context, weakest in scalp context
  const overrideScale = context === "position" ? 0.4 : context === "intraday" ? 0.25 : 0.1;

  const htfStructures = timeframeAnalyses.filter((a) => HIGHER_TFS.includes(a.timeframe));
  let htfOverride = 0;
  if (htfStructures.length > 0) {
    const downtrends = htfStructures.filter((a) => a.structure.structure === "downtrend");
    const uptrends = htfStructures.filter((a) => a.structure.structure === "uptrend");

    if (downtrends.length === htfStructures.length) {
      const avg = downtrends.reduce((s, a) => s + a.structure.strength, 0) / downtrends.length;
      htfOverride = -(avg * overrideScale);
    } else if (uptrends.length === htfStructures.length) {
      const avg = uptrends.reduce((s, a) => s + a.structure.strength, 0) / uptrends.length;
      htfOverride = avg * overrideScale;
    } else if (downtrends.length > 0 && uptrends.length === 0) {
      const avg = downtrends.reduce((s, a) => s + a.structure.strength, 0) / downtrends.length;
      htfOverride = -(avg * overrideScale * 0.6);
    } else if (uptrends.length > 0 && downtrends.length === 0) {
      const avg = uptrends.reduce((s, a) => s + a.structure.strength, 0) / uptrends.length;
      htfOverride = avg * overrideScale * 0.6;
    }
  }

  // ── 3. Final score for primary verdict ────────────────────────────────
  const rawScore =
    structureScore * DIMENSION_WEIGHTS.structure +
    trendScore * DIMENSION_WEIGHTS.trend +
    pressureScore * DIMENSION_WEIGHTS.pressure +
    sentiment * DIMENSION_WEIGHTS.sentiment +
    htfOverride;

  const finalScore = clamp(rawScore, -100, 100);
  const verdict = scoreToVerdict(finalScore);

  // ── 4. Compute dual verdicts (scalp + position, always) ───────────────
  const scalpScore = computeContextScore(timeframeAnalyses, SCALP_WEIGHTS, sentiment, 0.1, htfStructures);
  const positionScore = computeContextScore(timeframeAnalyses, POSITION_WEIGHTS, sentiment, 0.4, htfStructures);
  const scalpVerdict = scoreToVerdict(scalpScore);
  const positionVerdict = scoreToVerdict(positionScore);

  // ── 5. Confidence ─────────────────────────────────────────────────────
  const dimensionScores = [structureScore, trendScore, pressureScore, sentiment];
  const signs = dimensionScores.map((d) => (d > 5 ? 1 : d < -5 ? -1 : 0));
  const nonZeroSigns = signs.filter((s) => s !== 0);
  const agreeing = nonZeroSigns.length > 0
    ? nonZeroSigns.filter((s) => s === Math.sign(finalScore || 1)).length
    : 0;
  const alignmentRatio = nonZeroSigns.length > 0 ? agreeing / nonZeroSigns.length : 0;
  const magnitudeFactor = Math.abs(finalScore) / 100;
  const rawConfidence = (alignmentRatio * 0.6 + magnitudeFactor * 0.4) * 100;
  const confidence = Math.min(95, Math.max(5, Math.round(rawConfidence)));

  // ── 6. Shifts ─────────────────────────────────────────────────────────
  const shifts = timeframeAnalyses
    .filter((a) => a.shift.severity !== "none")
    .map((a) => ({ timeframe: a.timeframe, shift: a.shift }));

  // ── 7. Summary ────────────────────────────────────────────────────────
  const summary = buildSummary(
    verdict, confidence, finalScore, structureScore, trendScore,
    pressureScore, sentiment, shifts, timeframeAnalyses,
    scalpVerdict, positionVerdict, context
  );

  return {
    verdict,
    confidence,
    timeframes: timeframeAnalyses,
    dimensions: {
      structure: Math.round(structureScore),
      trend: Math.round(trendScore),
      pressure: Math.round(pressureScore),
      sentiment: Math.round(sentiment),
    },
    scalpVerdict,
    positionVerdict,
    tradingContext: context,
    shifts,
    summary,
  };
}

function scoreToVerdict(score: number): VerdictLabel {
  if (score > 35) return "strong_bullish";
  if (score > 12) return "bullish";
  if (score < -35) return "strong_bearish";
  if (score < -12) return "bearish";
  return "neutral";
}

/** Compute a final score using specific TF weights (for dual verdict) */
function computeContextScore(
  analyses: TimeframeAnalysis[],
  weights: Record<Timeframe, number>,
  sentiment: number,
  overrideScale: number,
  htfStructures: TimeframeAnalysis[]
): number {
  const s = clamp(weightedDimensionScore(analyses, (a) => scoreStructure(a.structure), weights), -100, 100);
  const t = clamp(weightedDimensionScore(analyses, (a) => scoreTrend(a.trend), weights), -100, 100);
  const p = clamp(weightedDimensionScore(analyses, (a) => scorePressure(a.pressure), weights), -100, 100);

  let htfO = 0;
  if (htfStructures.length > 0) {
    const down = htfStructures.filter((a) => a.structure.structure === "downtrend");
    const up = htfStructures.filter((a) => a.structure.structure === "uptrend");
    if (down.length === htfStructures.length) {
      htfO = -(down.reduce((sum, a) => sum + a.structure.strength, 0) / down.length * overrideScale);
    } else if (up.length === htfStructures.length) {
      htfO = up.reduce((sum, a) => sum + a.structure.strength, 0) / up.length * overrideScale;
    }
  }

  return clamp(
    s * DIMENSION_WEIGHTS.structure + t * DIMENSION_WEIGHTS.trend +
    p * DIMENSION_WEIGHTS.pressure + sentiment * DIMENSION_WEIGHTS.sentiment + htfO,
    -100, 100
  );
}

// ─── Summary generator ───────────────────────────────────────────────────────

const VERDICT_LABELS: Record<VerdictResult["verdict"], string> = {
  strong_bullish: "Strong Bullish",
  bullish: "Bullish",
  neutral: "Neutral",
  bearish: "Bearish",
  strong_bearish: "Strong Bearish",
};

const CONTEXT_LABELS: Record<TradingContext, string> = {
  scalp: "scalp",
  intraday: "intraday",
  position: "position",
};

function buildSummary(
  verdict: VerdictResult["verdict"],
  confidence: number,
  _finalScore: number,
  structureScore: number,
  _trendScore: number,
  pressureScore: number,
  sentimentScore: number,
  shifts: { timeframe: Timeframe; shift: ShiftResult }[],
  analyses: TimeframeAnalysis[],
  scalpVerdict: VerdictLabel,
  positionVerdict: VerdictLabel,
  context: TradingContext
): string {
  const parts: string[] = [];

  // Opening line with context
  parts.push(
    `${VERDICT_LABELS[verdict]} verdict for ${CONTEXT_LABELS[context]} trading (${confidence}% confidence).`
  );

  // Dual verdict comparison
  if (scalpVerdict !== positionVerdict) {
    parts.push(
      `${VERDICT_LABELS[scalpVerdict]} (scalp) vs ${VERDICT_LABELS[positionVerdict]} (position) — different timeframe contexts disagree.`
    );
  } else {
    parts.push(
      `${VERDICT_LABELS[scalpVerdict]} across both scalp and position contexts — aligned.`
    );
  }

  // Structure commentary
  if (structureScore > 25) {
    parts.push("Market structure showing higher highs and higher lows on higher timeframes.");
  } else if (structureScore < -25) {
    parts.push("Market structure showing lower highs and lower lows on higher timeframes.");
  } else {
    parts.push("Market structure is ranging with no clear directional bias.");
  }

  // Pressure commentary
  const dominantPressure = pressureScore > 0 ? "Buying" : "Selling";
  const pressurePct = Math.round(50 + pressureScore / 2);
  if (Math.abs(pressureScore) > 10) {
    parts.push(`${dominantPressure} pressure dominant at ${pressurePct}%.`);
  }

  // LTF divergence from verdict
  const lowerTfs: Timeframe[] = ["1m", "5m", "15m"];
  const divergentLtf = analyses.find((a) => {
    if (!lowerTfs.includes(a.timeframe)) return false;
    const isBullishLtf = a.pressure.buyPressure > 55;
    const isBearishLtf = a.pressure.buyPressure < 45;
    if (verdict.includes("bearish") && isBullishLtf) return true;
    if (verdict.includes("bullish") && isBearishLtf) return true;
    return false;
  });

  if (divergentLtf) {
    const ltfDir = divergentLtf.pressure.buyPressure > 55 ? "bullish" : "bearish";
    parts.push(`Short-term ${ltfDir} pressure on ${divergentLtf.timeframe} may indicate a pullback opportunity.`);
  }

  // Sentiment
  if (sentimentScore > 20) {
    parts.push(`News/social sentiment is bullish (+${Math.round(sentimentScore)}).`);
  } else if (sentimentScore < -20) {
    parts.push(`News/social sentiment is bearish (${Math.round(sentimentScore)}).`);
  }

  // Shifts
  if (shifts.length > 0) {
    const shiftDescs = shifts.map((s) => `${s.timeframe}: ${s.shift.description}`).join("; ");
    parts.push(`Shifts detected — ${shiftDescs}.`);
  }

  parts.push("⚠️ Not financial advice.");
  return parts.join(" ");
}
