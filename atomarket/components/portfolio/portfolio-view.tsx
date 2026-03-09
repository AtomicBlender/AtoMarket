"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, MinusCircle, RotateCcw, XCircle } from "lucide-react";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import type { MarketStatus, OutcomeType, Position, Trade } from "@/lib/domain/types";

type PositionTab = "active" | "closed";
type MainTab = "positions" | "activity";

type PositionOutcomeRow = {
  kind: "active";
  id: string;
  marketId: string;
  marketTitle: string;
  marketStatus?: MarketStatus;
  outcome: OutcomeType;
  shares: number;
  avgCostPerShare: number | null;
  currentPrice: number | null;
  valueNeutrons: number | null;
  changeAbsNeutrons: number | null;
  changePct: number | null;
  totalCostNeutrons: number;
};

type ClosedResult = "WON" | "LOST" | "PUSH" | "REFUNDED";

type ClosedOutcomeRow = {
  kind: "closed";
  id: string;
  marketId: string;
  marketTitle: string;
  marketStatus?: MarketStatus;
  marketResolvedOutcome?: OutcomeType | null;
  outcome: OutcomeType;
  shares: number;
  avgCostPerShare: number | null;
  totalCostNeutrons: number;
  amountWonNeutrons: number;
  gainLossAbsNeutrons: number;
  gainLossPct: number | null;
  result: ClosedResult;
  latestTradeAt: string;
};

type MarketSnapshot = {
  title: string;
  status?: MarketStatus;
  resolvedOutcome?: OutcomeType | null;
  qYes?: number;
  qNo?: number;
  b?: number;
};

function formatEstimatedNeutrons(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedNeutrons(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${formatNeutrons(value)}`;
}

function formatSignedPercent(value: number | null): string {
  if (value == null) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(3);
}

function pnlClass(value: number | null | undefined): string {
  if (value == null || value >= 0) return "text-emerald-300";
  return "text-rose-300";
}

function getClosedResultPresentation(result: ClosedResult) {
  switch (result) {
    case "WON":
      return {
        label: "Won",
        className: "bg-emerald-500/12 text-emerald-300",
        icon: CheckCircle2,
      };
    case "LOST":
      return {
        label: "Lost",
        className: "bg-rose-500/12 text-rose-300",
        icon: XCircle,
      };
    case "REFUNDED":
      return {
        label: "Refunded",
        className: "bg-sky-500/12 text-sky-300",
        icon: RotateCcw,
      };
    case "PUSH":
    default:
      return {
        label: "Push",
        className: "bg-slate-700/60 text-slate-300",
        icon: MinusCircle,
      };
  }
}

function buildMarketSnapshotMap(positions: Position[], trades: Trade[]): Map<string, MarketSnapshot> {
  const markets = new Map<string, MarketSnapshot>();

  for (const position of positions) {
    const existing = markets.get(position.market_id);
    markets.set(position.market_id, {
      title: position.market_title ?? existing?.title ?? position.market_id.slice(0, 8),
      status: position.market_status ?? existing?.status,
      resolvedOutcome:
        position.market_resolved_outcome === undefined
          ? existing?.resolvedOutcome
          : position.market_resolved_outcome,
      qYes: position.market_q_yes ?? existing?.qYes,
      qNo: position.market_q_no ?? existing?.qNo,
      b: position.market_b ?? existing?.b,
    });
  }

  for (const trade of trades) {
    const existing = markets.get(trade.market_id);
    markets.set(trade.market_id, {
      title: trade.market_title ?? existing?.title ?? trade.market_id.slice(0, 8),
      status: trade.market_status ?? existing?.status,
      resolvedOutcome:
        trade.market_resolved_outcome === undefined
          ? existing?.resolvedOutcome
          : trade.market_resolved_outcome,
      qYes: existing?.qYes,
      qNo: existing?.qNo,
      b: existing?.b,
    });
  }

  return markets;
}

function deriveActiveOutcomeRows(positions: Position[]): PositionOutcomeRow[] {
  const rows: PositionOutcomeRow[] = [];

  for (const position of positions) {
    const status = position.market_status;
    const isActive = status === "OPEN" || status === "RESOLVING";
    if (!isActive) continue;

    const hasPricing =
      typeof position.market_q_yes === "number" &&
      typeof position.market_q_no === "number" &&
      typeof position.market_b === "number";

    const currentYes = hasPricing
      ? yesPrice(position.market_q_yes as number, position.market_q_no as number, position.market_b as number)
      : null;
    const currentNo = currentYes == null ? null : 1 - currentYes;
    const totalShares = position.yes_shares + position.no_shares;

    const pushOutcome = (outcome: OutcomeType, shares: number, currentPrice: number | null) => {
      if (shares <= 0) return;
      const basisShare = totalShares > 0 ? shares / totalShares : 0;
      const outcomeCost = position.net_spent_neutrons * basisShare;
      const value = currentPrice == null ? null : shares * currentPrice;
      const change = value == null ? null : value - outcomeCost;

      rows.push({
        kind: "active",
        id: `${position.id}-${outcome}`,
        marketId: position.market_id,
        marketTitle: position.market_title ?? position.market_id.slice(0, 8),
        marketStatus: status,
        outcome,
        shares,
        avgCostPerShare: shares > 0 ? outcomeCost / shares : null,
        currentPrice,
        valueNeutrons: value,
        changeAbsNeutrons: change,
        changePct: outcomeCost > 0 && change != null ? change / outcomeCost : null,
        totalCostNeutrons: outcomeCost,
      });
    };

    pushOutcome("YES", position.yes_shares, currentYes);
    pushOutcome("NO", position.no_shares, currentNo);
  }

  return rows;
}

function deriveClosedOutcomeRows(positions: Position[], trades: Trade[]): ClosedOutcomeRow[] {
  const marketMap = buildMarketSnapshotMap(positions, trades);
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const key = `${trade.market_id}:${trade.outcome}`;
    const list = grouped.get(key) ?? [];
    list.push(trade);
    grouped.set(key, list);
  }

  const rows: ClosedOutcomeRow[] = [];

  for (const [key, groupedTrades] of grouped.entries()) {
    const [marketId, outcome] = key.split(":") as [string, OutcomeType];
    const market = marketMap.get(marketId);
    const status = market?.status;
    const isClosed = status === "RESOLVED" || status === "INVALID_REFUND";
    if (!isClosed) continue;

    const chron = [...groupedTrades].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    let boughtShares = 0;
    let openShares = 0;
    let totalCost = 0;
    let openCost = 0;
    let sellProceeds = 0;

    for (const trade of chron) {
      const quantity = Math.max(0, Number(trade.quantity ?? 0));
      if (quantity <= 0) continue;

      if (trade.side === "BUY") {
        const buyCost = Math.max(0, Number(trade.cost_neutrons ?? 0));
        boughtShares += quantity;
        openShares += quantity;
        totalCost += buyCost;
        openCost += buyCost;
      } else {
        const proceeds = Math.max(0, Number(trade.sell_proceeds_neutrons ?? trade.cost_neutrons ?? 0));
        sellProceeds += proceeds;

        if (openShares > 0) {
          const soldShares = Math.min(quantity, openShares);
          const soldCost = openCost * (soldShares / openShares);
          openShares -= soldShares;
          openCost = Math.max(0, openCost - soldCost);
        }
      }
    }

    let settlementPayout = 0;
    if (status === "RESOLVED") {
      const resolved = market?.resolvedOutcome;
      settlementPayout = resolved === outcome ? Math.floor(openShares) : 0;
    } else {
      settlementPayout = openCost;
    }

    const amountWon = sellProceeds + settlementPayout;
    const gainLoss = amountWon - totalCost;

    let result: ClosedResult;
    if (status === "INVALID_REFUND") {
      result = "REFUNDED";
    } else if (gainLoss > 0) {
      result = "WON";
    } else if (gainLoss < 0) {
      result = "LOST";
    } else {
      result = "PUSH";
    }

    const latestTradeAt =
      chron[chron.length - 1]?.created_at ??
      new Date(0).toISOString();

    if (totalCost <= 0 && amountWon <= 0 && boughtShares <= 0) continue;

    rows.push({
      kind: "closed",
      id: `${marketId}-${outcome}-closed`,
      marketId,
      marketTitle: market?.title ?? marketId.slice(0, 8),
      marketStatus: status,
      marketResolvedOutcome: market?.resolvedOutcome,
      outcome,
      shares: boughtShares,
      avgCostPerShare: boughtShares > 0 ? totalCost / boughtShares : null,
      totalCostNeutrons: totalCost,
      amountWonNeutrons: amountWon,
      gainLossAbsNeutrons: gainLoss,
      gainLossPct: totalCost > 0 ? gainLoss / totalCost : null,
      result,
      latestTradeAt,
    });
  }

  rows.sort((a, b) => new Date(b.latestTradeAt).getTime() - new Date(a.latestTradeAt).getTime());

  return rows;
}

function getPositionMetrics(position: Position) {
  const isOpenLike =
    position.market_status != null &&
    ["OPEN", "RESOLVING"].includes(position.market_status);
  const hasPricing =
    typeof position.market_q_yes === "number" &&
    typeof position.market_q_no === "number" &&
    typeof position.market_b === "number";
  const currentYes = hasPricing
    ? yesPrice(position.market_q_yes as number, position.market_q_no as number, position.market_b as number)
    : null;
  const currentNo = currentYes == null ? null : 1 - currentYes;
  const markToMarketValue =
    currentYes == null || currentNo == null
      ? null
      : position.yes_shares * currentYes + position.no_shares * currentNo;

  return {
    isOpenLike,
    markToMarketValue,
  };
}

export function PortfolioView({
  title,
  subtitle,
  positions,
  trades,
  balance,
}: {
  title: string;
  subtitle?: ReactNode;
  positions: Position[];
  trades: Trade[];
  balance?: number;
}) {
  const [mainTab, setMainTab] = useState<MainTab>("positions");
  const [positionsTab, setPositionsTab] = useState<PositionTab>("active");

  const recentTrades = useMemo(() => trades.slice(0, 100), [trades]);

  const openPositions = positions.filter((position) => position.yes_shares > 0 || position.no_shares > 0);
  const totalRealizedPnl = positions.reduce((sum, position) => sum + position.realized_pnl_neutrons, 0);
  const totalUnrealizedPnl = positions.reduce((sum, position) => {
    const metrics = getPositionMetrics(position);
    if (!metrics.isOpenLike || metrics.markToMarketValue == null) return sum;
    return sum + (metrics.markToMarketValue - position.net_spent_neutrons);
  }, 0);
  const positionsValue = positions.reduce((sum, position) => {
    const metrics = getPositionMetrics(position);
    if (!metrics.isOpenLike || metrics.markToMarketValue == null) return sum;
    return sum + metrics.markToMarketValue;
  }, 0);
  const biggestWinValue = positions
    .filter((position) => position.market_status === "RESOLVED" || position.market_status === "INVALID_REFUND")
    .reduce<number | null>((maxValue, position) => {
      const value = position.realized_pnl_neutrons;
      if (maxValue == null || value > maxValue) return value;
      return maxValue;
    }, null);
  const totalNetPnl = totalRealizedPnl + totalUnrealizedPnl;

  const activeOutcomeRows = useMemo(() => deriveActiveOutcomeRows(positions), [positions]);
  const closedOutcomeRows = useMemo(() => deriveClosedOutcomeRows(positions, trades), [positions, trades]);

  return (
    <section className="mx-auto max-w-6xl space-y-7 px-4 py-8 md:space-y-8">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold text-slate-100 [overflow-wrap:anywhere]">{title}</h1>
        {subtitle ? <p className="break-words text-sm text-slate-400 [overflow-wrap:anywhere]">{subtitle}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {typeof balance === "number" ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatNeutrons(balance)}</p>
            <p className="text-xs text-slate-400">neutrons</p>
          </div>
        ) : null}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open positions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{openPositions.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recent trades</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{recentTrades.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Positions Value</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{formatNeutrons(positionsValue)}</p>
          <p className="text-xs text-slate-400">Mark-to-market value of open shares.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Biggest Win</p>
          <p className={`mt-2 text-2xl font-semibold ${Number(biggestWinValue ?? 0) >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
            {biggestWinValue == null ? "—" : `${biggestWinValue >= 0 ? "+" : ""}${formatNeutrons(biggestWinValue)}`}
          </p>
          <p className="text-xs text-slate-400">Best settled market result.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Realized P&amp;L</p>
          <p className={`mt-2 text-2xl font-semibold ${totalRealizedPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
            {totalRealizedPnl >= 0 ? "+" : ""}
            {formatNeutrons(totalRealizedPnl)}
          </p>
          <p className="text-xs text-slate-400">Booked from SELL trades and settlement.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Unrealized P&amp;L</p>
          <p className={`mt-2 text-2xl font-semibold ${totalUnrealizedPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
            {totalUnrealizedPnl >= 0 ? "+" : ""}
            {formatNeutrons(totalUnrealizedPnl)}
          </p>
          <p className="text-xs text-slate-400">Mark-to-market on open shares.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net P&amp;L</p>
          <p className={`mt-2 text-2xl font-semibold ${totalNetPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
            {totalNetPnl >= 0 ? "+" : ""}
            {formatNeutrons(totalNetPnl)}
          </p>
          <p className="text-xs text-slate-400">Realized + Unrealized.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-6 border-b border-slate-800/70 pb-2">
          <button
            type="button"
            onClick={() => setMainTab("positions")}
            className={`pb-2 text-2xl font-semibold transition ${
              mainTab === "positions" ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Positions
          </button>
          <button
            type="button"
            onClick={() => setMainTab("activity")}
            className={`pb-2 text-2xl font-semibold transition ${
              mainTab === "activity" ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Activity
          </button>
        </div>

        {mainTab === "positions" ? (
          <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 md:p-6">
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/50 p-1">
              <button
                type="button"
                onClick={() => setPositionsTab("active")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  positionsTab === "active"
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setPositionsTab("closed")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  positionsTab === "closed"
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Closed
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {positionsTab === "active"
                ? "Active positions are markets still trading or awaiting final resolution."
                : "Closed positions are finalized markets (resolved or invalidated)."}
            </p>

            {positionsTab === "active" ? (
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/35">
                <div className="hidden border-b border-slate-800/60 px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] text-slate-500 md:grid md:grid-cols-[minmax(0,1.5fr)_0.7fr_0.7fr_0.8fr_0.9fr]">
                  <span>Market</span>
                  <span className="text-right">Avg</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Change</span>
                </div>
                {activeOutcomeRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`px-4 py-4 text-sm text-slate-200 md:px-6 md:py-5 ${index > 0 ? "border-t border-slate-800/55" : ""}`}
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_0.7fr_0.7fr_0.8fr_0.9fr] md:items-center">
                      <div className="min-w-0">
                        <Link
                          href={`/markets/${row.marketId}`}
                          className="block break-words font-medium leading-tight text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200 md:truncate"
                          style={{ fontSize: "clamp(1rem, 1vw, 1.12rem)" }}
                        >
                          {row.marketTitle}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              row.outcome === "YES"
                                ? "bg-emerald-500/12 text-emerald-300"
                                : "bg-rose-500/12 text-rose-300"
                            }`}
                          >
                            {row.outcome}
                          </span>{" "}
                          · {formatNeutrons(row.shares)} shares
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400 md:hidden">
                          <p>Avg {formatPrice(row.avgCostPerShare)}</p>
                          <p>Current {formatPrice(row.currentPrice)}</p>
                          <p>Value {row.valueNeutrons == null ? "—" : formatNeutrons(row.valueNeutrons)}</p>
                          <p className={pnlClass(row.changeAbsNeutrons)}>
                            Change {formatSignedNeutrons(row.changeAbsNeutrons)} ({formatSignedPercent(row.changePct)})
                          </p>
                        </div>
                      </div>
                      <div className="hidden text-right text-sm text-slate-300 md:block tabular-nums">{formatPrice(row.avgCostPerShare)}</div>
                      <div className="hidden text-right text-sm text-slate-300 md:block tabular-nums">{formatPrice(row.currentPrice)}</div>
                      <div className="hidden text-right text-sm text-slate-300 md:block tabular-nums">
                        {row.valueNeutrons == null ? "—" : formatNeutrons(row.valueNeutrons)}
                      </div>
                      <div className={`hidden text-right text-sm md:block tabular-nums ${pnlClass(row.changeAbsNeutrons)}`}>
                        {formatSignedNeutrons(row.changeAbsNeutrons)} ({formatSignedPercent(row.changePct)})
                      </div>
                    </div>
                  </div>
                ))}
                {activeOutcomeRows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-400">No active positions.</p> : null}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/35">
                <div className="hidden border-b border-slate-800/60 px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] text-slate-500 md:grid md:grid-cols-[0.7fr_minmax(0,1.4fr)_0.8fr_0.8fr_0.9fr]">
                  <span>Result</span>
                  <span>Market</span>
                  <span className="text-right">Total Cost</span>
                  <span className="text-right">Amount Won</span>
                  <span className="text-right">Gain/Loss</span>
                </div>
                {closedOutcomeRows.map((row, index) => (
                  (() => {
                    const presentation = getClosedResultPresentation(row.result);
                    const ResultIcon = presentation.icon;

                    return (
                      <div
                        key={row.id}
                        className={`px-4 py-4 text-sm text-slate-200 md:px-6 md:py-5 ${index > 0 ? "border-t border-slate-800/55" : ""}`}
                      >
                        <div className="grid gap-3 md:grid-cols-[0.7fr_minmax(0,1.4fr)_0.8fr_0.8fr_0.9fr] md:items-center">
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${presentation.className}`}
                            >
                              <ResultIcon className="h-4 w-4" aria-hidden="true" />
                              {presentation.label}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/markets/${row.marketId}`}
                              className="block break-words font-medium leading-tight text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200 md:truncate"
                              style={{ fontSize: "clamp(1rem, 1vw, 1.12rem)" }}
                            >
                              {row.marketTitle}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-400">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  row.outcome === "YES"
                                    ? "bg-emerald-500/12 text-emerald-300"
                                    : "bg-rose-500/12 text-rose-300"
                                }`}
                              >
                                {row.outcome}
                              </span>{" "}
                              · {formatEstimatedNeutrons(row.shares)} shares @ {formatPrice(row.avgCostPerShare)} avg
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400 md:hidden">
                              <p>Total cost {formatNeutrons(row.totalCostNeutrons)}</p>
                              <p>Amount won {formatNeutrons(row.amountWonNeutrons)}</p>
                              <p className={pnlClass(row.gainLossAbsNeutrons)}>
                                Gain/Loss {formatSignedNeutrons(row.gainLossAbsNeutrons)} ({formatSignedPercent(row.gainLossPct)})
                              </p>
                            </div>
                          </div>
                          <div className="hidden text-right text-sm text-slate-300 md:block tabular-nums">
                            {formatNeutrons(row.totalCostNeutrons)}
                          </div>
                          <div className="hidden text-right text-sm text-slate-300 md:block tabular-nums">
                            {formatNeutrons(row.amountWonNeutrons)}
                          </div>
                          <div className={`hidden text-right text-sm md:block tabular-nums ${pnlClass(row.gainLossAbsNeutrons)}`}>
                            {formatSignedNeutrons(row.gainLossAbsNeutrons)} ({formatSignedPercent(row.gainLossPct)})
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ))}
                {closedOutcomeRows.length === 0 ? <p className="px-4 py-4 text-sm text-slate-400">No closed positions.</p> : null}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 md:p-6">
            <h2 className="text-lg font-semibold text-slate-100">Trade History</h2>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/35">
              <div className="hidden border-b border-slate-800/60 px-6 py-2.5 text-[11px] uppercase tracking-[0.08em] text-slate-500 md:grid md:grid-cols-[120px_minmax(0,1.2fr)_170px]">
                <span>Action</span>
                <span>Market</span>
                <span className="text-right">Amount</span>
              </div>
              {recentTrades.map((trade, index) => {
                const amountNeutrons =
                  trade.side === "BUY"
                    ? Number(trade.cost_neutrons)
                    : Number(trade.sell_proceeds_neutrons ?? trade.cost_neutrons);
                const executionPrice = trade.quantity > 0 ? amountNeutrons / trade.quantity : null;
                const actionLabel = trade.side === "BUY" ? "Buy" : "Sell";
                return (
                  <div
                    key={trade.id}
                    className={`px-4 py-4 text-sm text-slate-200 md:px-6 md:py-5 ${index > 0 ? "border-t border-slate-800/55" : ""}`}
                  >
                    <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-[120px_minmax(0,1.2fr)_170px] md:items-center">
                      <div className="text-sm font-medium text-slate-200">{actionLabel}</div>
                      <div className="min-w-0">
                        <Link
                          href={`/markets/${trade.market_id}`}
                          className="block break-words font-medium leading-tight text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200 md:truncate"
                          style={{ fontSize: "clamp(1rem, 1vw, 1.12rem)" }}
                        >
                          {trade.market_title ?? trade.market_id.slice(0, 8)}
                        </Link>
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
            </div>
            {recentTrades.length === 0 ? <p className="text-sm text-slate-400">No trades yet.</p> : null}
          </section>
        )}
      </div>
    </section>
  );
}
