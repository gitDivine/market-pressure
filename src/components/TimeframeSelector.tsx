"use client";

import { TIMEFRAMES, type Timeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  selected: Timeframe;
  onSelect: (tf: Timeframe) => void;
}

export default function TimeframeSelector({ selected, onSelect }: Props) {
  return (
    <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-auto">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onSelect(tf.value)}
          className={cn(
            "min-h-[36px] min-w-[40px] shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95 sm:min-h-[32px] sm:min-w-[36px]",
            selected === tf.value
              ? "bg-accent text-white shadow-md shadow-accent/25"
              : "text-muted hover:text-foreground hover:bg-card-hover"
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
