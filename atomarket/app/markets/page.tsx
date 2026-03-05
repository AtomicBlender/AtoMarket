import { MarketHeader } from "@/components/market/header";
import { MarketCard } from "@/components/market/market-card";
import { getMarkets } from "@/lib/actions/query";

interface MarketsPageProps {
  searchParams?: Promise<{
    status?: string;
    category?: string;
    search?: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;

  const markets = await getMarkets({
    status: params?.status,
    category: params?.category,
    search: params?.search,
  });

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <form className="mb-5 grid gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 md:grid-cols-4">
          <input
            name="search"
            placeholder="Search markets"
            defaultValue={params?.search ?? ""}
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <select
            name="status"
            defaultValue={params?.status ?? "ALL"}
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          >
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="RESOLVING">Resolving</option>
            <option value="RESOLVED">Resolved</option>
            <option value="INVALID_REFUND">Invalid / Refund</option>
          </select>
          <input
            name="category"
            placeholder="Category"
            defaultValue={params?.category ?? ""}
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-emerald-500 px-3 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Apply filters
          </button>
        </form>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>

        {markets.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
            No markets found.
          </div>
        ) : null}
      </section>
    </main>
  );
}
