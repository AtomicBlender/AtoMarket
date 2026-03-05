import { Badge } from "@/components/ui/badge";
import type { MarketStatus } from "@/lib/domain/types";

const classes: Record<MarketStatus, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-200 border-emerald-400/40",
  CLOSED: "bg-amber-500/15 text-amber-200 border-amber-400/40",
  RESOLVING: "bg-sky-500/15 text-sky-200 border-sky-400/40",
  RESOLVED: "bg-blue-500/15 text-blue-200 border-blue-400/40",
  INVALID_REFUND: "bg-rose-500/15 text-rose-200 border-rose-400/40",
};

export function StatusBadge({ status }: { status: MarketStatus }) {
  return <Badge className={classes[status]}>{status.replace("_", " ")}</Badge>;
}
