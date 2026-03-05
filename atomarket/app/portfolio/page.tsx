import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import { getPortfolio, getProfile, getViewer } from "@/lib/actions/query";
import { yesPrice } from "@/lib/domain/lmsr";

export const dynamic = "force-dynamic";

function formatEstimatedNeutrons(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function PortfolioPage() {
  const user = await getViewer();
  if (!user) {
    redirect("/auth/login");
  }

  const [profile, portfolio] = await Promise.all([getProfile(user.id), getPortfolio(user.id)]);

  const openPositions = portfolio.positions.filter((position) => position.yes_shares > 0 || position.no_shares > 0);
  const totalRealizedPnl = portfolio.positions.reduce((sum, position) => sum + position.realized_pnl_neutrons, 0);

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatNeutrons(profile?.neutron_balance ?? 0)}</p>
            <p className="text-xs text-slate-400">neutrons</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Open positions</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{openPositions.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recent trades</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{portfolio.trades.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 md:col-span-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Realized P&L</p>
            <p className={`mt-2 text-2xl font-semibold ${totalRealizedPnl >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
              {totalRealizedPnl >= 0 ? "+" : ""}
              {formatNeutrons(totalRealizedPnl)}
            </p>
            <p className="text-xs text-slate-400">neutrons from settled markets</p>
          </div>
        </div>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Positions</h2>
          <p className="text-xs text-slate-500">
            Open cost basis shows neutrons currently committed to open shares in each market.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Market</th>
                  <th className="py-2">YES</th>
                  <th className="py-2">NO</th>
                  <th className="py-2">Final Outcome</th>
                  <th className="py-2">Result</th>
                  <th className="py-2">Open Cost Basis</th>
                  <th className="py-2">Est. Position Value</th>
                  <th className="py-2">Unrealized P&L</th>
                  <th className="py-2">Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((position) => {
                  const isOpenLike =
                    position.market_status === "OPEN" ||
                    position.market_status === "CLOSED" ||
                    position.market_status === "RESOLVING";
                  const hasPricing =
                    typeof position.market_q_yes === "number" &&
                    typeof position.market_q_no === "number" &&
                    typeof position.market_b === "number";
                  const currentYes = hasPricing
                    ? yesPrice(position.market_q_yes as number, position.market_q_no as number, position.market_b as number)
                    : null;
                  const currentNo = currentYes == null ? null : 1 - currentYes;
                  const markToMarketValue =
                    currentYes == null || currentNo == null
                      ? null
                      : position.yes_shares * currentYes + position.no_shares * currentNo;
                  const unrealizedPnl = markToMarketValue == null ? null : markToMarketValue - position.net_spent_neutrons;
                  const finalOutcome =
                    position.market_status === "RESOLVED"
                      ? position.market_resolved_outcome
                      : position.market_status === "INVALID_REFUND"
                        ? "INVALID"
                        : "PENDING";
                  const resultLabel =
                    position.market_status === "RESOLVED"
                      ? position.realized_pnl_neutrons > 0
                        ? "WIN"
                        : position.realized_pnl_neutrons < 0
                          ? "LOSS"
                          : "PUSH"
                      : position.market_status === "INVALID_REFUND"
                        ? "REFUNDED"
                        : "OPEN";

                  return (
                    <tr key={position.id} className="border-t border-slate-800">
                      <td className="py-2">
                        <Link href={`/markets/${position.market_id}`} className="text-emerald-300 hover:text-emerald-200">
                          {position.market_title ?? position.market_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2">{position.yes_shares}</td>
                      <td className="py-2">{position.no_shares}</td>
                      <td className="py-2">{finalOutcome}</td>
                      <td className="py-2">{resultLabel}</td>
                      <td className="py-2">{isOpenLike ? formatNeutrons(position.net_spent_neutrons) : "—"}</td>
                      <td className="py-2">{isOpenLike && markToMarketValue != null ? formatEstimatedNeutrons(markToMarketValue) : "—"}</td>
                      <td className={`py-2 ${unrealizedPnl == null || unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {isOpenLike && unrealizedPnl != null
                          ? `${unrealizedPnl >= 0 ? "+" : ""}${formatEstimatedNeutrons(unrealizedPnl)}`
                          : "—"}
                      </td>
                      <td className={`py-2 ${position.realized_pnl_neutrons >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {!isOpenLike
                          ? `${position.realized_pnl_neutrons >= 0 ? "+" : ""}${formatNeutrons(position.realized_pnl_neutrons)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {portfolio.positions.length === 0 ? <p className="text-sm text-slate-400">No positions yet.</p> : null}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Trade History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Time</th>
                  <th className="py-2">Market</th>
                  <th className="py-2">Outcome</th>
                  <th className="py-2">Final</th>
                  <th className="py-2">Result</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.trades.map((trade) => {
                  const final =
                    trade.market_status === "RESOLVED"
                      ? trade.market_resolved_outcome
                      : trade.market_status === "INVALID_REFUND"
                        ? "INVALID"
                        : "PENDING";
                  const result =
                    trade.market_status === "RESOLVED"
                      ? trade.market_resolved_outcome === trade.outcome
                        ? "WIN"
                        : "LOSS"
                      : trade.market_status === "INVALID_REFUND"
                        ? "REFUNDED"
                        : "PENDING";

                  return (
                    <tr key={trade.id} className="border-t border-slate-800">
                      <td className="py-2">{formatDateTime(trade.created_at)}</td>
                      <td className="py-2">
                        <Link href={`/markets/${trade.market_id}`} className="text-emerald-300 hover:text-emerald-200">
                          {trade.market_title ?? trade.market_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-2">{trade.outcome}</td>
                      <td className="py-2">{final}</td>
                      <td className="py-2">{result}</td>
                      <td className="py-2">{trade.quantity}</td>
                      <td className="py-2">{formatNeutrons(trade.cost_neutrons)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {portfolio.trades.length === 0 ? <p className="text-sm text-slate-400">No trades yet.</p> : null}
        </section>
      </section>
    </main>
  );
}
