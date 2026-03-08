import type { Market, MarketLifecycleStatus, MarketStateView, MarketStatus, MarketTradingPhase } from "@/lib/domain/types";

function getTradingPhase(closeTime: string, referenceTs = Date.now()): MarketTradingPhase {
  return new Date(closeTime).getTime() > referenceTs ? "TRADING_OPEN" : "TRADING_CLOSED";
}

function inferLifecycleStatus(
  status: MarketStatus,
  closeTime: string,
  referenceTs = Date.now(),
): MarketLifecycleStatus {
  if (status === "RESOLVED" || status === "INVALID_REFUND") return status;
  if (status === "RESOLVING" || status === "CLOSED") return "RESOLVING";
  if (new Date(closeTime).getTime() <= referenceTs) return "RESOLVING";
  return "OPEN";
}

function lifecycleLabel(status: MarketLifecycleStatus): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "RESOLVING":
      return "Resolving";
    case "RESOLVED":
      return "Resolved";
    case "INVALID_REFUND":
      return "Refunded";
  }
}

function tradingLabel(phase: MarketTradingPhase): string {
  return phase === "TRADING_OPEN" ? "Trading Open" : "Trading Closed";
}

export function getMarketStateView(
  market: Pick<Market, "status" | "close_time" | "resolution_deadline">,
  referenceTs = Date.now(),
): MarketStateView {
  const lifecycleStatus = inferLifecycleStatus(market.status, market.close_time, referenceTs);
  const tradingPhase =
    lifecycleStatus === "RESOLVED" || lifecycleStatus === "INVALID_REFUND"
      ? "TRADING_CLOSED"
      : getTradingPhase(market.close_time, referenceTs);
  const isFinalized = lifecycleStatus === "RESOLVED" || lifecycleStatus === "INVALID_REFUND";
  const isInResolution = lifecycleStatus === "RESOLVING";
  const isPostClose = tradingPhase === "TRADING_CLOSED";
  const deadlinePassed = new Date(market.resolution_deadline).getTime() <= referenceTs;
  const canTrade = lifecycleStatus === "OPEN" && tradingPhase === "TRADING_OPEN";
  const canSubmitProposal = !isFinalized && !deadlinePassed;
  const canChallenge = !isFinalized && !deadlinePassed;
  const showTradingPhaseBadge = lifecycleStatus === "RESOLVING";

  return {
    lifecycleStatus,
    tradingPhase,
    displayLifecycleLabel: lifecycleLabel(lifecycleStatus),
    displayTradingLabel: tradingLabel(tradingPhase),
    showTradingPhaseBadge,
    canTrade,
    isFinalized,
    isInResolution,
    isPostClose,
    canSubmitProposal,
    canChallenge,
  };
}

export function getEffectiveMarketStatus(
  status: MarketStatus,
  closeTime: string,
  referenceTs = Date.now(),
): MarketLifecycleStatus {
  return inferLifecycleStatus(status, closeTime, referenceTs);
}

export function isMarketTradingOpen(
  market: Pick<Market, "status" | "close_time" | "resolution_deadline">,
  referenceTs = Date.now(),
): boolean {
  return getMarketStateView(market, referenceTs).canTrade;
}
