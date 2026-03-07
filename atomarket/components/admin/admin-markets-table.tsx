import Link from "next/link";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import type { AdminMarketRow } from "@/lib/domain/types";

function creatorLabel(row: AdminMarketRow): string {
  return row.creator_display_name?.trim() || row.creator_username || `user_${row.id.slice(0, 8)}`;
}

function attentionLabel(row: AdminMarketRow): string {
  const now = Date.now();
  const deadlineMs = new Date(row.resolution_deadline).getTime();
  if (row.has_challenge) return "Challenged";
  if ((row.status === "OPEN" || row.status === "CLOSED" || row.status === "RESOLVING") && new Date(row.close_time).getTime() < now) {
    return "Past close";
  }
  if (row.has_active_proposal) return "Active proposal";
  if ((row.status === "OPEN" || row.status === "CLOSED" || row.status === "RESOLVING") && deadlineMs >= now && deadlineMs <= now + 24 * 60 * 60 * 1000) {
    return "Watching deadline";
  }
  return "Stable";
}

export function AdminMarketsTable({
  markets,
  totalCount,
}: {
  markets: AdminMarketRow[];
  totalCount: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/75">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Markets</h2>
          <p className="text-sm text-slate-400">Showing {markets.length} of {totalCount} matching markets.</p>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">No markets match the current filters.</div>
      ) : (
        <div className="divide-y divide-slate-800">
          {markets.map((market) => (
            <article key={market.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_0.7fr_0.8fr_0.9fr] lg:items-center">
              <div className="min-w-0">
                <Link href={`/markets/${market.id}`} className="truncate text-base font-medium text-emerald-300 hover:text-emerald-200">
                  {market.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {market.category ?? "General"} · {market.status.replaceAll("_", " ")} · by {creatorLabel(market)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {market.has_challenge ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-200">Challenge</span>
                  ) : null}
                  {market.has_active_proposal ? (
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-200">Proposal</span>
                  ) : null}
                  {market.challenge_kind ? (
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-slate-300">
                      {market.challenge_kind.replaceAll("_", " ")}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-sm text-slate-300">
                <p>Attention</p>
                <p className="mt-1 font-medium text-slate-100">{attentionLabel(market)}</p>
                <p className="mt-1 text-xs text-slate-500">Attempts {formatNeutrons(market.resolution_attempts ?? 0)}</p>
              </div>
              <div className="text-sm text-slate-300">
                <p>Timeline</p>
                <p className="mt-1 text-xs text-slate-400">Close {formatDateTime(market.close_time)}</p>
                <p className="text-xs text-slate-400">Deadline {formatDateTime(market.resolution_deadline)}</p>
              </div>
              <div className="text-sm text-slate-300 lg:text-right">
                <p className="font-medium text-slate-100">{formatNeutrons(market.volume_neutrons ?? 0)} neutrons</p>
                <p className="mt-1 text-xs text-slate-500">Created {formatDateTime(market.created_at)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
