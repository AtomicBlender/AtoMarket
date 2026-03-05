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

const statuses = ["ALL", "OPEN", "CLOSED", "RESOLVING", "RESOLVED", "INVALID_REFUND"] as const;

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;

  const markets = await getMarkets({
    status: params?.status,
    category: params?.category,
    search: params?.search,
  });

  const openCount = markets.filter((m) => m.status === "OPEN").length;

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Market Feed</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">Discover and trade outcomes</h1>
            <p className="mt-1 text-sm text-slate-400">
              {markets.length} total markets, {openCount} currently open for trading.
            </p>
          </div>
        </div>

        <form className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3">
          <div className="grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.6fr]">
            <input
              name="search"
              placeholder="Search question, title, or keyword"
              defaultValue={params?.search ?? ""}
              className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <select
              name="status"
              defaultValue={params?.status ?? "ALL"}
              className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All statuses" : status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              name="category"
              placeholder="Category"
              defaultValue={params?.category ?? ""}
              className="h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <button
              type="submit"
              className="h-11 rounded-md bg-emerald-500 px-3 text-sm font-medium text-slate-950 hover:bg-emerald-400"
            >
              Apply
            </button>
          </div>
        </form>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>

        {markets.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
            No markets found. Try broadening filters or create a new market.
          </div>
        ) : null}
      </section>
    </main>
  );
}
