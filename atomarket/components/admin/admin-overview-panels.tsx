import Link from "next/link";
import { formatDateTime } from "@/lib/domain/format";
import { getMarketStateView } from "@/lib/domain/market-status";
import type { AdminActionLog, AdminDispute, AdminMarketRow } from "@/lib/domain/types";
import { LifecycleBadge, TradingPhaseBadge } from "@/components/market/status-badge";

function marketLabel(market: AdminMarketRow): string {
  return market.title || market.id;
}

function actionActorLabel(action: AdminActionLog): string {
  return action.admin_display_name?.trim() || action.admin_username || "Unknown admin";
}

export function AdminOverviewPanels({
  attentionMarkets,
  disputes,
  recentActions,
}: {
  attentionMarkets: AdminMarketRow[];
  disputes: AdminDispute[];
  recentActions: AdminActionLog[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Needs attention</h2>
            <p className="text-sm text-slate-400">Challenged, overdue, or deadline-sensitive markets.</p>
          </div>
          <Link href="/admin?tab=markets&attention=CHALLENGED" className="text-sm text-emerald-300 hover:text-emerald-200">
            Open markets
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {attentionMarkets.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
              Nothing urgent right now.
            </div>
          ) : (
            attentionMarkets.map((market) => (
              <article key={market.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                {(() => {
                  const state = getMarketStateView(market);
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/markets/${market.id}`}
                      className="block break-words text-sm font-medium text-emerald-300 [overflow-wrap:anywhere] hover:text-emerald-200"
                    >
                      {marketLabel(market)}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      close {formatDateTime(market.close_time)} · deadline {formatDateTime(market.resolution_deadline)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <LifecycleBadge status={state.lifecycleStatus} label={state.displayLifecycleLabel} />
                      {state.showTradingPhaseBadge && state.displayTradingLabel ? (
                        <TradingPhaseBadge phase={state.tradingPhase} label={state.displayTradingLabel} />
                      ) : null}
                    </div>
                  </div>
                  {market.has_challenge ? (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">Challenge</span>
                  ) : null}
                </div>
                    </>
                  );
                })()}
              </article>
            ))
          )}
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Open disputes</h2>
              <p className="text-sm text-slate-400">The current challenged proposal queue.</p>
            </div>
            <Link href="/admin?tab=disputes" className="text-sm text-emerald-300 hover:text-emerald-200">
              Open disputes
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {disputes.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                No challenged disputes.
              </div>
            ) : (
              disputes.slice(0, 4).map((dispute) => (
                <article key={dispute.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <Link href={`/markets/${dispute.market_id}`} className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
                    {dispute.challenge_label}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">Deadline {formatDateTime(dispute.challenge_deadline)}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Recent admin actions</h2>
          <div className="mt-4 space-y-3">
            {recentActions.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                No admin actions yet.
              </div>
            ) : (
              recentActions.map((action) => (
                <article key={action.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-100 [overflow-wrap:anywhere]">
                        {action.action_type} · {action.market_title ?? action.market_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {actionActorLabel(action)} · {formatDateTime(action.created_at)}
                      </p>
                    </div>
                    <Link href={`/markets/${action.market_id}`} className="text-xs text-emerald-300 hover:text-emerald-200">
                      Open
                    </Link>
                  </div>
                  {action.note ? (
                    <p className="mt-2 break-words text-sm text-slate-400 [overflow-wrap:anywhere]">{action.note}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
