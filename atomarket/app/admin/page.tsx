import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { AdminControls } from "@/components/market/admin-controls";
import { formatDateTime } from "@/lib/domain/format";
import { getAdminDisputes, getMarketById, getProfile, getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getViewer();
  if (!user) {
    redirect("/auth/login?next=/admin");
  }

  const profile = await getProfile(user.id);
  if (!profile?.is_admin) {
    return (
      <main>
        <MarketHeader />
        <section className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-slate-300">
            Admin access required.
          </div>
        </section>
      </main>
    );
  }

  const disputes = await getAdminDisputes();
  const rows = await Promise.all(
    disputes.map(async (dispute) => {
      const market = await getMarketById(dispute.market_id);
      return { dispute, market };
    }),
  );

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Admin Console</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Dispute queue</h1>
          <p className="text-sm text-slate-400">Review challenged proposals and settle markets with clear notes.</p>
        </div>

        {rows.map(({ dispute, market }) => (
          <article key={dispute.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
            <h2 className="text-lg font-semibold text-slate-100">{market?.title ?? dispute.market_id}</h2>
            <p className="text-sm text-slate-300">
              Proposal outcome: {dispute.proposed_outcome} | Challenge deadline: {formatDateTime(dispute.challenge_deadline)}
            </p>
            <p className="text-sm text-slate-400">{dispute.challenge_label}</p>
            <Link href={`/markets/${dispute.market_id}`} className="text-sm text-emerald-300 hover:text-emerald-200">
              Open market detail
            </Link>
            <AdminControls marketId={dispute.market_id} />
          </article>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5 text-slate-400">No challenged disputes.</div>
        ) : null}
      </section>
    </main>
  );
}
