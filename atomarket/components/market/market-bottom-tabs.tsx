"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import type { MarketPublicTrade, MarketTopHolder, MarketTopPosition } from "@/lib/domain/types";

type BottomTab = "holders" | "positions" | "activity";

function formatEstimatedNeutrons(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function resolveDisplayName(row: {
  user_id: string;
  username: string | null;
  display_name: string | null;
}): string {
  return row.display_name?.trim() || row.username || `user_${row.user_id.slice(0, 8)}`;
}

function renderUserLink(row: {
  user_id: string;
  username: string | null;
  display_name: string | null;
}) {
  const label = resolveDisplayName(row);
  if (row.username) {
    return (
      <Link href={`/u/${row.username}`} className="truncate text-emerald-300 hover:text-emerald-200 hover:underline">
        {label}
      </Link>
    );
  }
  return <span className="truncate text-slate-200">{label}</span>;
}

function HoldersTable({
  title,
  rows,
  accentClass,
}: {
  title: "YES" | "NO";
  rows: MarketTopHolder[];
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40">
      <div className={`border-b border-slate-800/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide ${accentClass}`}>
        {title} holders
      </div>
      <div className="divide-y divide-slate-800/50">
        {rows.map((row, index) => (
          <div key={`${row.user_id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm">
            {renderUserLink(row)}
            <span className="tabular-nums text-slate-300">{formatNeutrons(row.shares)} shares</span>
          </div>
        ))}
        {rows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-400">No holders yet.</p> : null}
      </div>
    </div>
  );
}

function PositionsTable({
  title,
  rows,
  accentClass,
}: {
  title: "YES" | "NO";
  rows: MarketTopPosition[];
  accentClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40">
      <div className={`border-b border-slate-800/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide ${accentClass}`}>
        {title} positions
      </div>
      <div className="divide-y divide-slate-800/50">
        {rows.map((row, index) => (
          <div key={`${row.user_id}-${index}`} className="px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              {renderUserLink(row)}
              <span className="tabular-nums text-slate-300">{formatNeutrons(row.shares)} shares</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-slate-400">
              <p>
                Value{" "}
                <span className="tabular-nums text-slate-300">
                  {formatNeutrons(row.current_value_neutrons)}
                </span>
              </p>
              <p
                className={`text-right tabular-nums ${
                  row.unrealized_pnl_neutrons >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                P&L {row.unrealized_pnl_neutrons >= 0 ? "+" : ""}
                {formatNeutrons(row.unrealized_pnl_neutrons)}{" "}
                {row.unrealized_pnl_pct != null ? `(${(row.unrealized_pnl_pct * 100).toFixed(1)}%)` : ""}
              </p>
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-400">No positions yet.</p> : null}
      </div>
    </div>
  );
}

function ActivityTable({ rows }: { rows: MarketPublicTrade[] }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/35">
      <div className="hidden border-b border-slate-800/60 px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] text-slate-500 md:grid md:grid-cols-[120px_minmax(0,1fr)_170px]">
        <span>Action</span>
        <span>User / Trade</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.map((trade, index) => {
        const amountNeutrons =
          trade.side === "BUY"
            ? Number(trade.cost_neutrons)
            : Number(trade.sell_proceeds_neutrons ?? trade.cost_neutrons);
        const executionPrice = trade.quantity > 0 ? amountNeutrons / trade.quantity : null;
        return (
          <div
            key={trade.id}
            className={`px-4 py-4 text-sm text-slate-200 md:px-6 md:py-5 ${index > 0 ? "border-t border-slate-800/55" : ""}`}
          >
            <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-[120px_minmax(0,1fr)_170px] md:items-center">
              <div className="text-sm font-medium text-slate-200">{trade.side === "BUY" ? "Buy" : "Sell"}</div>
              <div className="min-w-0">
                {trade.username ? (
                  <Link
                    href={`/u/${trade.username}`}
                    className="truncate font-medium leading-tight text-emerald-300 hover:text-emerald-200"
                    style={{ fontSize: "clamp(1rem, 1vw, 1.12rem)" }}
                  >
                    {resolveDisplayName(trade)}
                  </Link>
                ) : (
                  <p className="truncate font-medium leading-tight text-slate-100" style={{ fontSize: "clamp(1rem, 1vw, 1.12rem)" }}>
                    {resolveDisplayName(trade)}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  <span
                    className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      trade.outcome === "YES"
                        ? "bg-emerald-500/12 text-emerald-300"
                        : "bg-rose-500/12 text-rose-300"
                    }`}
                  >
                    {trade.outcome}
                  </span>
                  {" "}· Qty {formatNeutrons(trade.quantity)} @{" "}
                  {executionPrice == null ? "—" : formatEstimatedNeutrons(executionPrice)}
                </p>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-sm text-slate-200 md:text-base">{formatNeutrons(amountNeutrons)}</div>
                <div className="mt-0.5 text-xs text-slate-400">{formatDateTime(trade.created_at)}</div>
              </div>
            </div>
          </div>
        );
      })}
      {rows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-400">No trades yet.</p> : null}
    </div>
  );
}

export function MarketBottomTabs({
  holdersYes,
  holdersNo,
  positionsYes,
  positionsNo,
  recentActivity,
}: {
  holdersYes: MarketTopHolder[];
  holdersNo: MarketTopHolder[];
  positionsYes: MarketTopPosition[];
  positionsNo: MarketTopPosition[];
  recentActivity: MarketPublicTrade[];
}) {
  const [tab, setTab] = useState<BottomTab>("holders");

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
      <div className="border-b border-slate-800/70">
        <nav className="flex gap-5 text-sm">
          <button
            type="button"
            onClick={() => setTab("holders")}
            className={`pb-3 font-medium ${tab === "holders" ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            Top Holders
          </button>
          <button
            type="button"
            onClick={() => setTab("positions")}
            className={`pb-3 font-medium ${tab === "positions" ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            Top Positions
          </button>
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={`pb-3 font-medium ${tab === "activity" ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
          >
            Recent Activity
          </button>
        </nav>
      </div>

      {tab === "holders" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <HoldersTable title="YES" rows={holdersYes} accentClass="text-emerald-300" />
          <HoldersTable title="NO" rows={holdersNo} accentClass="text-rose-300" />
        </div>
      ) : null}

      {tab === "positions" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PositionsTable title="YES" rows={positionsYes} accentClass="text-emerald-300" />
          <PositionsTable title="NO" rows={positionsNo} accentClass="text-rose-300" />
        </div>
      ) : null}

      {tab === "activity" ? <ActivityTable rows={recentActivity} /> : null}
    </section>
  );
}
