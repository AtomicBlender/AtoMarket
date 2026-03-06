import Link from "next/link";
import type { Market, ProbabilityHistoryPoint } from "@/lib/domain/types";
import { countdownTo, formatDateTime, formatPercent } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import { StatusBadge } from "@/components/market/status-badge";
import { ProbabilityHistoryChart } from "@/components/market/probability-history-chart";

export function FeaturedMarketCard({
  market,
  historyPoints,
}: {
  market: Market;
  historyPoints: ProbabilityHistoryPoint[];
}) {
  const yes = yesPrice(market.q_yes, market.q_no, market.b);
  const no = 1 - yes;
  const latestHistoryYes = historyPoints[historyPoints.length - 1]?.yes_probability ?? yes;
  const compactVolume = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(market.volume_neutrons ?? 0);

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group block min-w-[310px] snap-start rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950/80 p-4 md:min-w-[360px]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{market.category ?? "General"}</p>
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-100">{market.title}</h3>
        </div>
        <StatusBadge status={market.status} />
      </div>

      <p className="line-clamp-2 text-sm text-slate-300">{market.question}</p>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-3xl font-semibold text-sky-300">{formatPercent(latestHistoryYes)} chance</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="flex h-11 items-center justify-center rounded-md bg-emerald-500 font-medium text-slate-950 transition-colors hover:bg-emerald-400">
            YES {formatPercent(yes)}
          </span>
          <span className="flex h-11 items-center justify-center rounded-md bg-rose-500 font-medium text-white transition-colors hover:bg-rose-400">
            NO {formatPercent(no)}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <ProbabilityHistoryChart points={historyPoints} latestYesProbability={latestHistoryYes} compact showHeader={false} />
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
        <span className="transition group-hover:text-emerald-300">View market</span>
        <span className="rounded border border-slate-700 px-2 py-0.5 normal-case tracking-normal text-slate-400">Vol {compactVolume}</span>
      </div>
    </Link>
  );
}
