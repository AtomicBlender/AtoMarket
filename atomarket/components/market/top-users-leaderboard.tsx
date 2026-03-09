"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatNeutrons } from "@/lib/domain/format";
import type { LeaderboardEntry } from "@/lib/domain/types";

type LeaderboardTab = "pnl" | "accuracy";

function formatSignedNeutrons(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNeutrons(value)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  const pct = value * 100;
  return `${pct.toFixed(1)}%`;
}

function pnlClass(value: number): string {
  return value >= 0 ? "text-emerald-300" : "text-rose-300";
}

export function TopUsersLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const [tab, setTab] = useState<LeaderboardTab>("pnl");

  const ranked = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const metricA = tab === "pnl" ? a.net_gain_neutrons : a.accuracy_score ?? Number.NEGATIVE_INFINITY;
      const metricB = tab === "pnl" ? b.net_gain_neutrons : b.accuracy_score ?? Number.NEGATIVE_INFINITY;
      if (metricA !== metricB) return metricB - metricA;
      if (a.resolved_markets_count !== b.resolved_markets_count) {
        return b.resolved_markets_count - a.resolved_markets_count;
      }
      if (a.total_cost_neutrons !== b.total_cost_neutrons) {
        return b.total_cost_neutrons - a.total_cost_neutrons;
      }
      return a.username.localeCompare(b.username);
    });

    return sorted.slice(0, 10);
  }, [entries, tab]);

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">Top users</h3>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950/60 p-1">
          <button
            type="button"
            onClick={() => setTab("pnl")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              tab === "pnl" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Top P&amp;L
          </button>
          <button
            type="button"
            onClick={() => setTab("accuracy")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              tab === "accuracy" ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Top Accuracy
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Last 30 days · Min 20 shares traded · P&L is realized on sells · Accuracy is equal-weight hit rate on resolved markets
      </p>

      <div className="mt-3 space-y-2">
        {ranked.length === 0 ? (
          <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-400">
            No eligible users yet.
          </div>
        ) : (
          ranked.map((entry, idx) => (
            <div
              key={entry.username}
              className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-950/35 px-3 py-2"
            >
              <span className="text-xs font-semibold text-slate-500">#{idx + 1}</span>
              <div className="min-w-0">
                <Link
                  href={`/u/${entry.username}`}
                  className="block break-words text-sm font-medium text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200"
                >
                  {entry.display_name?.trim() || entry.username}
                </Link>
                <p className="break-words text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                  @{entry.username} · {entry.resolved_markets_count} resolved
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${pnlClass(entry.net_gain_neutrons)}`}>
                  {tab === "pnl" ? formatSignedNeutrons(entry.net_gain_neutrons) : formatPercent(entry.accuracy_score)}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {tab === "pnl"
                    ? `Acc ${formatPercent(entry.accuracy_score)}`
                    : `P&L ${formatSignedNeutrons(entry.net_gain_neutrons)}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
