import { notFound } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { ResolutionControls } from "@/components/market/resolution-controls";
import { StatusBadge } from "@/components/market/status-badge";
import { TradeForm } from "@/components/market/trade-form";
import { countdownTo, formatDateTime, formatNeutrons, formatPercent } from "@/lib/domain/format";
import { yesPrice } from "@/lib/domain/lmsr";
import { getMarketById, getMarketTimeline, getViewer } from "@/lib/actions/query";

interface MarketDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({ params }: MarketDetailPageProps) {
  const { id } = await params;
  const [market, viewer] = await Promise.all([getMarketById(id), getViewer()]);

  if (!market) {
    notFound();
  }

  const timeline = await getMarketTimeline(market.id);
  const activeProposal = timeline.proposals.find((proposal) => proposal.status === "ACTIVE");

  const yes = yesPrice(market.q_yes, market.q_no, market.b);
  const no = 1 - yes;
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

            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300 md:grid-cols-2">
              <div>Close time: {formatDateTime(market.close_time)}</div>
              <div>Resolution deadline: {formatDateTime(market.resolution_deadline)}</div>
              <div>Close in: {countdownTo(market.close_time)}</div>
              <div>Deadline in: {countdownTo(market.resolution_deadline)}</div>
              <div>Liquidity b: {formatNeutrons(market.b)}</div>
              <div>Resolve attempts: {market.resolution_attempts}</div>
            </div>

            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              <div className="font-medium text-slate-200">Resolution specification</div>
              <div>Source: {market.resolution_source}</div>
              <div>URL: {market.resolution_url ?? "n/a"}</div>
              <pre className="overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
                {JSON.stringify(market.resolution_rule, null, 2)}
              </pre>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-100">Resolution timeline</h2>

              {timeline.proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                  <div className="font-medium text-slate-100">
                    Proposal {proposal.proposed_outcome} ({proposal.status})
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Bond: {formatNeutrons(proposal.bond_neutrons)} neutrons</div>
                  <div className="text-xs text-slate-400">Challenge deadline: {formatDateTime(proposal.challenge_deadline)}</div>
                  <div className="mt-1 text-xs text-slate-400">Evidence URL: {proposal.evidence_url ?? "n/a"}</div>
                  <div className="mt-1 text-xs text-slate-300">{proposal.evidence_note ?? ""}</div>
                </div>
              ))}

              {timeline.challenges.map((challenge) => (
                <div key={challenge.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                  <div className="font-medium text-slate-100">Challenge {challenge.challenge_outcome}</div>
                  <div className="mt-1 text-xs text-slate-400">Bond: {formatNeutrons(challenge.bond_neutrons)} neutrons</div>
                  <div className="mt-1 text-xs text-slate-400">Evidence URL: {challenge.evidence_url ?? "n/a"}</div>
                  <div className="mt-1 text-xs text-slate-300">{challenge.evidence_note ?? ""}</div>
                </div>
              ))}

              {timeline.proposals.length === 0 && timeline.challenges.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                  No resolution events yet.
                </div>
              ) : null}
            </section>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <TradeForm market={market} disabled={tradingDisabled} isAuthenticated={Boolean(viewer)} />
            <ResolutionControls market={market} activeProposalId={activeProposal?.id} isAuthenticated={Boolean(viewer)} />
          </aside>
        </div>
      </section>
    </main>
  );
}
