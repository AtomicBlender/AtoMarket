import Link from "next/link";
import type { Market } from "@/lib/domain/types";
import { countdownTo, formatDateTime, formatPercent } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import { StatusBadge } from "@/components/market/status-badge";

export function MarketCard({ market }: { market: Market }) {
  const yes = yesPrice(market.q_yes, market.q_no, market.b);
  const no = 1 - yes;

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group block rounded-2xl border border-slate-800 bg-slate-900/75 p-4 transition hover:-translate-y-0.5 hover:border-emerald-400/45"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{market.category ?? "General"}</p>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-slate-100">{market.title}</h3>
        </div>
        <StatusBadge status={market.status} />
      </div>

      <p className="line-clamp-2 text-sm text-slate-400">{market.question}</p>

      <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-emerald-200">YES {formatPercent(yes)}</span>
          <span className="text-rose-200">NO {formatPercent(no)}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(yes * 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-slate-300">
          <div className="text-slate-500">Closes</div>
          <div className="font-medium">{formatDateTime(market.close_time)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-slate-300">
          <div className="text-slate-500">Countdown</div>
          <div className="font-medium">{countdownTo(market.close_time)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
        <span>{market.resolution_type.replaceAll("_", " ")}</span>
        <span className="transition group-hover:text-emerald-300">View market</span>
      </div>
    </Link>
  );
}
