"use client";

import type { TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { FeaturedMarketCard } from "@/components/market/featured-market-card";
import type { Market, ProbabilityHistoryPoint } from "@/lib/domain/types";

const AUTOPLAY_MS = 7500;
const PROGRESS_TICK_MS = 100;
const MIN_SWIPE_PX = 50;

export function TopMarketsCarousel({
  markets,
  historyByMarket,
  fallbackProbabilityByMarket,
  renderedAtTs,
}: {
  markets: Market[];
  historyByMarket: Record<string, ProbabilityHistoryPoint[]>;
  fallbackProbabilityByMarket: Record<string, number>;
  renderedAtTs: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);
  const suppressClickRef = useRef(false);

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

  const resetDrag = () => {
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
    setDragOffsetPx(0);
    setIsDragging(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (markets.length <= 1) return;

    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchDeltaXRef.current = 0;
    setIsPaused(true);
    setIsDragging(true);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (!isDragging || touchStartXRef.current === null) return;

    const nextX = event.touches[0]?.clientX;
    if (typeof nextX !== "number") return;

    const deltaX = nextX - touchStartXRef.current;
    touchDeltaXRef.current = deltaX;
    setDragOffsetPx(deltaX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const swipeThreshold = Math.max(MIN_SWIPE_PX, containerWidth * 0.18);
    const deltaX = touchDeltaXRef.current;

    if (Math.abs(deltaX) > swipeThreshold) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);

      setActiveIndex((curr) => {
        if (deltaX < 0) return (curr + 1) % markets.length;
        return (curr - 1 + markets.length) % markets.length;
      });
    }

    setProgressMs(0);
    setIsPaused(false);
    resetDrag();
  };

  const handleTouchCancel = () => {
    setIsPaused(false);
    resetDrag();
  };

  return (
    <div className="min-w-0 space-y-3">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-2xl touch-pan-y"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className={`flex ${isDragging ? "" : "transition-transform duration-500 ease-out"}`}
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffsetPx}px))`,
          }}
        >
          {markets.map((market) => (
            <div key={market.id} className="w-full shrink-0 [&>a]:min-w-0 [&>a]:w-full">
              <FeaturedMarketCard
                market={market}
                renderedAtTs={renderedAtTs}
                historyPoints={
                  historyByMarket[market.id] ?? [
                    { ts: renderedAtTs, yes_probability: fallbackProbabilityByMarket[market.id] ?? 0.5 },
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
