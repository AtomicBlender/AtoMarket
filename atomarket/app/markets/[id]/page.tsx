import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { ProbabilityHistoryChart } from "@/components/market/probability-history-chart";
import { ResolutionControls } from "@/components/market/resolution-controls";
import { StatusBadge } from "@/components/market/status-badge";
import { TradeForm } from "@/components/market/trade-form";
import { countdownTo, formatDateTime, formatNeutrons, formatPercent } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import { finalizeUnchallengedManualProposalsForMarket } from "@/lib/domain/resolution";
import { getMarketById, getMarketProbabilityHistory, getMarketTimeline, getPositionForMarket, getProfile, getViewer } from "@/lib/actions/query";

interface MarketDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

function formatEstimatedNeutrons(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  const { id } = await params;
  await finalizeUnchallengedManualProposalsForMarket(id);
  const [market, viewer] = await Promise.all([getMarketById(id), getViewer()]);
  const [viewerProfile, viewerPosition] = viewer
    ? await Promise.all([getProfile(viewer.id), getPositionForMarket(viewer.id, id)])
    : [null, null];

  if (!market) {
    notFound();
  }

  const timeline = await getMarketTimeline(market.id);
  const evidenceRequirements =
    typeof market.resolution_rule?.["evidence_requirements"] === "string"
      ? (market.resolution_rule["evidence_requirements"] as string)
      : "";
  const activeProposal = timeline.proposals.find((proposal) => proposal.status === "ACTIVE");
  const blockingProposal = timeline.proposals.find(
    (proposal) => proposal.status === "ACTIVE" || proposal.status === "CHALLENGED",
  );
  const timelineEvents = [
    ...timeline.proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      createdAt: proposal.created_at,
      type: "proposal" as const,
      payload: proposal,
    })),
    ...timeline.challenges.map((challenge) => ({
      id: `challenge-${challenge.id}`,
      createdAt: challenge.created_at,
      type: "challenge" as const,
      payload: challenge,
    })),
    ...timeline.adminActions.map((action) => ({
      id: `admin-${action.id}`,
      createdAt: action.created_at,
      type: "admin" as const,
      payload: action,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const latestResolveAction = [...timeline.adminActions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find((action) => action.action_type === "RESOLVE" || action.action_type === "INVALIDATE");
  const finalizedProposal = [...timeline.proposals]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find((proposal) => proposal.status === "FINALIZED");
  const resolutionMethod =
    market.status === "RESOLVED"
      ? latestResolveAction?.action_type === "RESOLVE"
        ? "Admin resolved"
        : finalizedProposal
          ? "Auto-resolved from unchallenged proposal"
          : "Resolved"
      : market.status === "INVALID_REFUND"
        ? latestResolveAction?.action_type === "INVALIDATE"
          ? "Admin invalidation"
          : "Invalid refund"
        : null;

  const yes = yesPrice(market.q_yes, market.q_no, market.b);
  const no = 1 - yes;
  const probabilityHistory = await getMarketProbabilityHistory(market.id, yes);
  const latestHistoryYes = probabilityHistory[probabilityHistory.length - 1]?.yes_probability ?? yes;
  const viewerMarkValue =
    viewerPosition != null ? viewerPosition.yes_shares * yes + viewerPosition.no_shares * no : null;
  const viewerUnrealized =
    viewerPosition != null && viewerMarkValue != null ? viewerMarkValue - viewerPosition.net_spent_neutrons : null;
  const tradingDisabled = market.status !== "OPEN" || new Date(market.close_time).getTime() <= Date.now();

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={market.status} />
              <span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
                {market.resolution_type.replaceAll("_", " ")}
              </span>
              <span className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">{market.category ?? "General"}</span>
            </div>

            <h1 className="text-2xl font-semibold text-slate-100">{market.title}</h1>
            <p className="text-slate-300">{market.question}</p>
            {market.description ? <p className="text-sm text-slate-400">{market.description}</p> : null}
            {market.status === "RESOLVED" ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <div className="font-semibold">Final resolution: {market.resolved_outcome}</div>
                <div className="mt-1 text-emerald-200/90">
                  {resolutionMethod}. {market.resolved_at ? `Settled at ${formatDateTime(market.resolved_at)}.` : ""}
                </div>
                {market.resolution_notes ? <div className="mt-2 text-emerald-200/90">{market.resolution_notes}</div> : null}
              </div>
            ) : null}
            {market.status === "INVALID_REFUND" ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="font-semibold">Final resolution: INVALID (refund)</div>
                <div className="mt-1 text-amber-100/90">
                  {resolutionMethod}. {market.resolved_at ? `Settled at ${formatDateTime(market.resolved_at)}.` : ""}
                </div>
                {market.invalid_reason ? <div className="mt-2 text-amber-100/90">{market.invalid_reason}</div> : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Live probability</span>
                <span>LMSR</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-emerald-200">YES {formatPercent(yes)}</span>
                <span className="font-semibold text-rose-200">NO {formatPercent(no)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.round(yes * 100)}%` }} />
              </div>
            </div>
            <ProbabilityHistoryChart points={probabilityHistory} latestYesProbability={latestHistoryYes} />

            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 md:grid-cols-2">
              <div>Close time: {formatDateTime(market.close_time)}</div>
              <div>Resolution deadline: {formatDateTime(market.resolution_deadline)}</div>
              <div>Close in: {countdownTo(market.close_time)}</div>
              <div>Deadline in: {countdownTo(market.resolution_deadline)}</div>
              <div>Volume: {formatNeutrons(market.volume_neutrons ?? 0)} neutrons</div>
              <div>Resolve attempts: {market.resolution_attempts}</div>
            </div>

            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              <div className="font-medium text-slate-200">Resolution specification</div>
              <div>Source: {market.resolution_source}</div>
              <div className="rounded-md border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                {evidenceRequirements || "No evidence requirements specified."}
              </div>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Resolution timeline</h2>

              {timelineEvents.map((event) => {
                if (event.type === "proposal") {
                  const proposal = event.payload;
                  return (
                    <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="font-medium text-slate-100">
                        Proposal {proposal.proposed_outcome} ({proposal.status})
                      </div>
                      <div className="mt-1 text-xs text-slate-400">At: {formatDateTime(proposal.created_at)}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Proposed by:{" "}
                        {proposal.proposer_username ? (
                          <Link href={`/u/${proposal.proposer_username}`} className="text-emerald-300 hover:text-emerald-200">
                            {proposal.proposer_display_name}
                          </Link>
                        ) : (
                          proposal.proposer_display_name
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">Bond: {formatNeutrons(proposal.bond_neutrons)} neutrons</div>
                      <div className="text-xs text-slate-400">Challenge deadline: {formatDateTime(proposal.challenge_deadline)}</div>
                      <div className="mt-1 text-xs text-slate-400">Evidence URL: {proposal.evidence_url ?? "n/a"}</div>
                      <div className="mt-1 text-xs text-slate-300">{proposal.evidence_note ?? ""}</div>
                    </div>
                  );
                }

                if (event.type === "challenge") {
                  const challenge = event.payload;
                  return (
                    <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                      <div className="font-medium text-slate-100">
                        Challenge {challenge.challenge_outcome} ({challenge.challenge_status})
                      </div>
                      <div className="mt-1 text-xs text-slate-400">At: {formatDateTime(challenge.created_at)}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Challenged by:{" "}
                        {challenge.challenger_username ? (
                          <Link href={`/u/${challenge.challenger_username}`} className="text-emerald-300 hover:text-emerald-200">
                            {challenge.challenger_display_name}
                          </Link>
                        ) : (
                          challenge.challenger_display_name
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">Bond: {formatNeutrons(challenge.bond_neutrons)} neutrons</div>
                      <div className="mt-1 text-xs text-slate-400">Evidence URL: {challenge.evidence_url ?? "n/a"}</div>
                      <div className="mt-1 text-xs text-slate-300">{challenge.evidence_note ?? ""}</div>
                    </div>
                  );
                }

                const action = event.payload;
                return (
                  <div key={event.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-slate-300">
                    <div className="font-medium text-amber-200">Admin action: {action.action_type}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      By:{" "}
                      {action.admin_username ? (
                        <Link href={`/u/${action.admin_username}`} className="text-emerald-300 hover:text-emerald-200">
                          {action.admin_display_name}
                        </Link>
                      ) : (
                        action.admin_display_name
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">At: {formatDateTime(action.created_at)}</div>
                    <div className="mt-1 text-xs text-slate-300">{action.note ?? ""}</div>
                  </div>
                );
              })}

              {timelineEvents.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                  No resolution events yet.
                </div>
              ) : null}
              {market.status === "RESOLVED" ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-slate-300">
                  <div className="font-medium text-emerald-200">Market resolved: {market.resolved_outcome}</div>
                  <div className="mt-1 text-xs text-slate-400">Method: {resolutionMethod}</div>
                  {market.resolved_at ? (
                    <div className="mt-1 text-xs text-slate-400">At: {formatDateTime(market.resolved_at)}</div>
                  ) : null}
                </div>
              ) : null}
              {market.status === "INVALID_REFUND" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-slate-300">
                  <div className="font-medium text-amber-200">Market invalidated with refund</div>
                  <div className="mt-1 text-xs text-slate-400">Method: {resolutionMethod}</div>
                  {market.resolved_at ? (
                    <div className="mt-1 text-xs text-slate-400">At: {formatDateTime(market.resolved_at)}</div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {viewer ? (
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Your Position</h3>
                {viewerPosition ? (
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">YES shares</span>
                      <span>{viewerPosition.yes_shares}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">NO shares</span>
                      <span>{viewerPosition.no_shares}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Open cost basis</span>
                      <span>{formatNeutrons(viewerPosition.net_spent_neutrons)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Est. position value</span>
                      <span>{viewerMarkValue != null ? formatEstimatedNeutrons(viewerMarkValue) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Unrealized P&L</span>
                      <span className={viewerUnrealized != null && viewerUnrealized < 0 ? "text-rose-300" : "text-emerald-300"}>
                        {viewerUnrealized != null
                          ? `${viewerUnrealized >= 0 ? "+" : ""}${formatEstimatedNeutrons(viewerUnrealized)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No open position in this market yet.</p>
                )}
              </section>
            ) : null}
            <TradeForm
              market={market}
              disabled={tradingDisabled}
              isAuthenticated={Boolean(viewer)}
              userYesShares={viewerPosition?.yes_shares ?? 0}
              userNoShares={viewerPosition?.no_shares ?? 0}
            />
            <ResolutionControls
              market={market}
              activeProposalId={activeProposal?.id}
              activeProposalOutcome={activeProposal?.proposed_outcome}
              hasBlockingProposal={Boolean(blockingProposal)}
              isAuthenticated={Boolean(viewer)}
              neutronBalance={viewerProfile?.neutron_balance ?? null}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}
