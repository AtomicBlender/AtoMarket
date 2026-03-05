import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { formatDateTime, formatNeutrons } from "@/lib/domain/format";
import { getPortfolio, getProfile, getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getViewer();
  if (!user) {
    redirect("/auth/login");
  }

  const [profile, portfolio] = await Promise.all([getProfile(user.id), getPortfolio(user.id)]);

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h1 className="text-2xl font-semibold text-slate-100">Portfolio</h1>
          <p className="mt-2 text-sm text-slate-400">Current Balance: {formatNeutrons(profile?.neutron_balance ?? 0)} neutrons</p>
        </div>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Positions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Market</th>
                  <th className="py-2">YES Shares</th>
                  <th className="py-2">NO Shares</th>
                  <th className="py-2">Net Spent</th>
                  <th className="py-2">Realized P&L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((position) => (
                  <tr key={position.id} className="border-t border-slate-800">
                    <td className="py-2">
                      <Link href={`/markets/${position.market_id}`} className="text-emerald-300 hover:text-emerald-200">
                        {position.market_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2">{position.yes_shares.toFixed(2)}</td>
                    <td className="py-2">{position.no_shares.toFixed(2)}</td>
                    <td className="py-2">{formatNeutrons(position.net_spent_neutrons)}</td>
                    <td className="py-2">{formatNeutrons(position.realized_pnl_neutrons)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {portfolio.positions.length === 0 ? <p className="text-sm text-slate-400">No positions yet.</p> : null}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-lg font-semibold text-slate-100">Trade History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Time</th>
                  <th className="py-2">Market</th>
                  <th className="py-2">Outcome</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.trades.map((trade) => (
                  <tr key={trade.id} className="border-t border-slate-800">
                    <td className="py-2">{formatDateTime(trade.created_at)}</td>
                    <td className="py-2">
                      <Link href={`/markets/${trade.market_id}`} className="text-emerald-300 hover:text-emerald-200">
                        {trade.market_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2">{trade.outcome}</td>
                    <td className="py-2">{trade.quantity.toFixed(2)}</td>
                    <td className="py-2">{formatNeutrons(trade.cost_neutrons)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {portfolio.trades.length === 0 ? <p className="text-sm text-slate-400">No trades yet.</p> : null}
        </section>
      </section>
    </main>
  );
}
