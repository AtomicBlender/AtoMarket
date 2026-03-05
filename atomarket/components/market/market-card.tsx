import Link from "next/link";
import type { Market } from "@/lib/domain/types";
import { formatDateTime, formatPercent } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import { StatusBadge } from "@/components/market/status-badge";

export function MarketCard({ market }: { market: Market }) {
  const yes = yesPrice(market.q_yes, market.q_no, market.b);
  const no = 1 - yes;

  return (
    <Link
      href={`/markets/${market.id}`}
      className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-emerald-400/40 hover:bg-slate-900"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="line-clamp-1 text-base font-semibold text-slate-100">{market.title}</h3>
        <StatusBadge status={market.status} />
      </div>
      <p className="line-clamp-2 text-sm text-slate-400">{market.question}</p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-emerald-500/10 p-2">
          <div className="text-slate-400">YES</div>
          <div className="text-sm font-semibold text-emerald-200">{formatPercent(yes)}</div>
        </div>
        <div className="rounded-md bg-rose-500/10 p-2">
          <div className="text-slate-400">NO</div>
          <div className="text-sm font-semibold text-rose-200">{formatPercent(no)}</div>
        </div>
        <div className="rounded-md bg-slate-800 p-2">
          <div className="text-slate-400">Closes</div>
          <div className="text-sm font-semibold text-slate-200">{formatDateTime(market.close_time)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{market.category ?? "General"}</span>
        <span>{market.resolution_type}</span>
      </div>
    </Link>
  );
}
