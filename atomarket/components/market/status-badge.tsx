import { Badge } from "@/components/ui/badge";
import type { MarketLifecycleStatus, MarketTradingPhase } from "@/lib/domain/types";

const lifecycleClasses: Record<MarketLifecycleStatus, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  RESOLVING: "bg-sky-500/15 text-sky-200 border-sky-400/40",
  RESOLVED: "bg-blue-500/15 text-blue-200 border-blue-400/40",
  INVALID_REFUND: "bg-rose-500/15 text-rose-200 border-rose-400/40",
};

const tradingClasses: Record<MarketTradingPhase, string> = {
  TRADING_OPEN: "bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
  TRADING_CLOSED: "bg-amber-500/10 text-amber-200 border-amber-500/30",
};

export function LifecycleBadge({ status, label }: { status: MarketLifecycleStatus; label?: string }) {
  return <Badge className={lifecycleClasses[status]}>{label ?? status.replaceAll("_", " ")}</Badge>;
}

export function TradingPhaseBadge({ phase, label }: { phase: MarketTradingPhase; label?: string }) {
  return <Badge className={tradingClasses[phase]}>{label ?? phase.replaceAll("_", " ")}</Badge>;
}
