"use client";

import { useEffect, useState } from "react";
import { FeaturedMarketCard } from "@/components/market/featured-market-card";
import type { Market, ProbabilityHistoryPoint } from "@/lib/domain/types";

const AUTOPLAY_MS = 7500;
const PROGRESS_TICK_MS = 100;

export function TopMarketsCarousel({
  markets,
  historyByMarket,
  fallbackProbabilityByMarket,
}: {
  markets: Market[];
  historyByMarket: Record<string, ProbabilityHistoryPoint[]>;
  fallbackProbabilityByMarket: Record<string, number>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressMs, setProgressMs] = useState(0);

  useEffect(() => {
    setActiveIndex((prev) => (markets.length === 0 ? 0 : Math.min(prev, markets.length - 1)));
  }, [markets.length]);

  useEffect(() => {
    if (markets.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      if (isPaused) return;

      setProgressMs((prev) => {
        const next = prev + PROGRESS_TICK_MS;
        return Math.min(next, AUTOPLAY_MS);
      });
    }, PROGRESS_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [isPaused, markets.length]);

  useEffect(() => {
    if (markets.length <= 1) return;
    if (progressMs < AUTOPLAY_MS) return;

    setActiveIndex((curr) => (curr + 1) % markets.length);
    setProgressMs(0);
  }, [progressMs, markets.length]);

  const progressPct = Math.max(0, Math.min(100, (progressMs / AUTOPLAY_MS) * 100));

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-2xl"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {markets.map((market) => (
            <div key={market.id} className="w-full shrink-0 [&>a]:min-w-0 [&>a]:w-full">
              <FeaturedMarketCard
                market={market}
                historyPoints={
                  historyByMarket[market.id] ?? [
                    { ts: new Date().toISOString(), yes_probability: fallbackProbabilityByMarket[market.id] ?? 0.5 },
                  ]
                }
              />
            </div>
          ))}
        </div>
      </div>

      {markets.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {markets.map((market, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={market.id}
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  setProgressMs(0);
                }}
                className={`relative h-2.5 overflow-hidden rounded-full transition ${
                  isActive ? "w-8 bg-slate-700" : "w-2.5 bg-slate-600 hover:bg-slate-500"
                }`}
                aria-label={`Go to top market ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
              >
                {isActive ? (
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-300 transition-[width] duration-75 linear"
                    style={{ width: `${progressPct}%` }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
