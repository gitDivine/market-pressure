"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import PairSelector from "@/components/PairSelector";
import TimeframeSelector from "@/components/TimeframeSelector";
import PressureGauge from "@/components/PressureGauge";
import ConfluencePanel from "@/components/ConfluencePanel";
import NewsPanel from "@/components/NewsPanel";
import AnalysisNotes from "@/components/AnalysisNotes";
import type { PairInfo, Timeframe, PressureData, ConfluenceResult, NewsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [pressure, setPressure] = useState<PressureData | null>(null);
  const [confluence, setConfluence] = useState<ConfluenceResult | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsSentiment, setNewsSentiment] = useState<{
    overall: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState({ pressure: false, confluence: false, news: false });
  const [errors, setErrors] = useState({ pressure: false, confluence: false, news: false });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPressure = useCallback(async (symbol: string, tf: Timeframe) => {
    setLoading((l) => ({ ...l, pressure: true }));
    setErrors((e) => ({ ...e, pressure: false }));
    try {
      const res = await fetch(`/api/pressure?symbol=${symbol}&timeframe=${tf}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.pressure) setPressure(data.pressure);
    } catch {
      setErrors((e) => ({ ...e, pressure: true }));
    }
    setLoading((l) => ({ ...l, pressure: false }));
  }, []);

  const fetchConfluence = useCallback(async (symbol: string) => {
    setLoading((l) => ({ ...l, confluence: true }));
    setErrors((e) => ({ ...e, confluence: false }));
    try {
      const res = await fetch(`/api/confluence?symbol=${symbol}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.confluence) setConfluence(data.confluence);
    } catch {
      setErrors((e) => ({ ...e, confluence: true }));
    }
    setLoading((l) => ({ ...l, confluence: false }));
  }, []);

  const fetchNews = useCallback(async (base: string) => {
    setLoading((l) => ({ ...l, news: true }));
    setErrors((e) => ({ ...e, news: false }));
    try {
      const res = await fetch(`/api/news?asset=${base}&query=${base} crypto`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setNews(data.news || []);
      setNewsSentiment(data.sentiment || null);
    } catch {
      setErrors((e) => ({ ...e, news: true }));
    }
    setLoading((l) => ({ ...l, news: false }));
  }, []);

  const fetchAll = useCallback(() => {
    if (!selectedPair) return;
    fetchPressure(selectedPair.symbol, timeframe);
    fetchConfluence(selectedPair.symbol);
    fetchNews(selectedPair.base);
    setLastUpdate(new Date());
  }, [selectedPair, timeframe, fetchPressure, fetchConfluence, fetchNews]);

  useEffect(() => {
    if (!selectedPair) return;
    fetchPressure(selectedPair.symbol, timeframe);
  }, [selectedPair, timeframe, fetchPressure]);

  useEffect(() => {
    if (!selectedPair) return;
    fetchConfluence(selectedPair.symbol);
    fetchNews(selectedPair.base);
    setLastUpdate(new Date());
  }, [selectedPair, fetchConfluence, fetchNews]);

  useEffect(() => {
    if (!selectedPair) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [selectedPair, fetchAll]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
        {/* Controls — stacks cleanly on mobile */}
        <div className="mb-4 space-y-2 sm:mb-6 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <PairSelector selected={selectedPair} onSelect={setSelectedPair} />
            <button
              onClick={fetchAll}
              disabled={!selectedPair}
              className={cn(
                "flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs transition-all hover:border-accent/50 hover:bg-card-hover active:scale-95 disabled:opacity-40 sm:ml-auto sm:min-h-[36px] sm:min-w-0 sm:px-3 sm:py-2",
                (loading.pressure || loading.confluence) && "animate-pulse"
              )}
            >
              <RefreshCw className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", (loading.pressure || loading.confluence) && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {lastUpdate && (
              <span className="hidden text-[10px] text-muted sm:inline">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />
        </div>

        {!selectedPair ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <RefreshCw className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Select a pair to begin</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Choose a crypto pair to see real-time buying vs selling pressure with multi-timeframe confluence analysis.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0"
          >
            {/* Left: Pressure + Confluence + Notes */}
            <div className="space-y-4 lg:col-span-2 lg:space-y-5">
              <PressureGauge data={pressure} loading={loading.pressure} error={errors.pressure} onRetry={() => fetchPressure(selectedPair.symbol, timeframe)} />
              <ConfluencePanel data={confluence} loading={loading.confluence} error={errors.confluence} onRetry={() => fetchConfluence(selectedPair.symbol)} />
              <AnalysisNotes
                pair={selectedPair.symbol}
                pressure={pressure}
                confluence={confluence}
                newsSentiment={newsSentiment?.overall || 0}
                loading={loading.pressure || loading.confluence}
              />
            </div>

            {/* Right: News — not sticky on mobile, sticky on desktop */}
            <div>
              <div className="lg:sticky lg:top-20">
                <NewsPanel news={news} sentiment={newsSentiment} loading={loading.news} error={errors.news} onRetry={() => selectedPair && fetchNews(selectedPair.base)} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 rounded-xl border border-yellow/20 bg-yellow/5 p-3 text-center sm:mt-10 sm:p-4">
          <p className="text-[11px] leading-relaxed text-yellow/80 sm:text-xs">
            This tool provides algorithmic analysis for educational purposes only. Not financial advice.
            Always do your own research before making trading decisions. Past performance does not guarantee future results.
          </p>
        </div>
      </main>
    </div>
  );
}
