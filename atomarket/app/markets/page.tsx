import { MarketHeader } from "@/components/market/header";
import { MarketCard } from "@/components/market/market-card";
import { getMarketsFeed } from "@/lib/actions/query";
import Link from "next/link";

interface MarketsPageProps {
  searchParams?: Promise<{
    status?: string;
    category?: string;
    search?: string;
    count?: string;
  }>;
}

export const revalidate = 90;

const statuses = ["ALL", "OPEN", "CLOSED", "RESOLVING", "RESOLVED", "INVALID_REFUND"] as const;
const MARKETS_CHUNK = 24;
const MARKETS_MAX = 240;

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;
  const requestedCount = Number(params?.count ?? MARKETS_CHUNK);
  const count = Number.isFinite(requestedCount)
    ? Math.min(MARKETS_MAX, Math.max(MARKETS_CHUNK, Math.floor(requestedCount)))
    : MARKETS_CHUNK;

  const { markets, totalCount } = await getMarketsFeed({
    status: params?.status,
    category: params?.category,
    search: params?.search,
  }, count, 0);

  const openCount = markets.filter((m) => m.status === "OPEN").length;
  const hasMore = markets.length < totalCount;
  const nextCount = Math.min(MARKETS_MAX, count + MARKETS_CHUNK);
  const loadMoreParams = new URLSearchParams();
  if (params?.search) loadMoreParams.set("search", params.search);
  if (params?.status) loadMoreParams.set("status", params.status);
  if (params?.category) loadMoreParams.set("category", params.category);
  loadMoreParams.set("count", String(nextCount));

  return (
    <main>
      <MarketHeader includeViewer={false} />
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Market Feed</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-100">Discover and trade outcomes</h1>
            <p className="mt-1 text-sm text-slate-400">
              Showing {markets.length} of {totalCount} markets, {openCount} currently open in this view.
            </p>
          </div>
        </div>

        <form className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/75 p-3">
          <input type="hidden" name="count" value={String(MARKETS_CHUNK)} />
          <div className="grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.6fr]">
            <input
              name="search"
              placeholder="Search title, question, description, or keyword"
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
        {hasMore ? (
          <div className="mt-5">
            <Link
              href={`/markets?${loadMoreParams.toString()}`}
              className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-900/70 px-4 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70"
            >
              Load more
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
