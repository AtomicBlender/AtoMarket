import { redirect } from "next/navigation";
import { MarketHeader } from "@/components/market/header";
import { CreateMarketForm } from "@/components/market/create-market-form";
import { getViewer } from "@/lib/actions/query";

export const dynamic = "force-dynamic";

export default async function NewMarketPage() {
  const user = await getViewer();

  if (!user) {
    redirect("/auth/login?next=/markets/new");
  }

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Market Creation</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Create a clear, resolvable market</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Use strict resolution templates. Keep wording explicit, source verifiable, and deadlines realistic.
          </p>
        </div>

        <CreateMarketForm />
      </section>
    </main>
  );
}
