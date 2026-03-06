import { MarketHeader } from "@/components/market/header";
import Link from "next/link";
import { MarketCard } from "@/components/market/market-card";
import { TopMarketsCarousel } from "@/components/market/top-markets-carousel";
import { TopUsersLeaderboard } from "@/components/market/top-users-leaderboard";
import { getHomeLeaderboard, getHomePageMarkets, getMarketProbabilityHistoryMap, getMarketsFeed } from "@/lib/actions/query";
import { yesPrice } from "@/lib/domain/lmsr";

export const dynamic = "force-dynamic";

const HOME_MARKETS_CHUNK = 24;
const HOME_MARKETS_MAX = 240;

interface HomePageProps {
  searchParams?: Promise<{
    all_count?: string;
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const requestedCount = Number(params?.all_count ?? HOME_MARKETS_CHUNK);
  const allCount = Number.isFinite(requestedCount)
    ? Math.min(HOME_MARKETS_MAX, Math.max(HOME_MARKETS_CHUNK, Math.floor(requestedCount)))
    : HOME_MARKETS_CHUNK;

  const [{ popularMarkets, totalMarkets, openCount }, leaderboard, allMarketsFeed] = await Promise.all([
    getHomePageMarkets(),
    getHomeLeaderboard(30, 100),
    getMarketsFeed({ status: "ALL" }, allCount, 0),
  ]);
  const allMarkets = allMarketsFeed.markets;
  const allMarketsTotal = allMarketsFeed.totalCount;
  const fallbackProbabilityByMarket = Object.fromEntries(
    popularMarkets.map((market) => [market.id, yesPrice(market.q_yes, market.q_no, market.b)]),
  );
  const popularHistoryByMarket = await getMarketProbabilityHistoryMap(
    popularMarkets.map((market) => market.id),
    fallbackProbabilityByMarket,
  );

  return (
    <main>
      <MarketHeader />
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">AtoMarket Home</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">Popular markets</h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalMarkets} total markets, {openCount} currently open for trading.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Top markets</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:items-start">
            {popularMarkets.length > 0 ? (
              <TopMarketsCarousel
                markets={popularMarkets}
                historyByMarket={popularHistoryByMarket}
                fallbackProbabilityByMarket={fallbackProbabilityByMarket}
              />
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
                No open markets yet. Check back soon or create one.
              </div>
            )}
            <TopUsersLeaderboard entries={leaderboard} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">All markets</h2>
            <Link href="/markets" className="text-sm text-emerald-300 hover:text-emerald-200">
              Advanced filters
            </Link>
          </div>

          {allMarkets.length > 0 ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {allMarkets.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </div>
              {allMarkets.length < allMarketsTotal ? (
                <div className="pt-1">
                  <Link
                    href={`/?all_count=${Math.min(HOME_MARKETS_MAX, allCount + HOME_MARKETS_CHUNK)}`}
                    className="inline-flex h-10 items-center rounded-md border border-slate-700 bg-slate-900/70 px-4 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/70"
                  >
                    Load more
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
              No markets found. Create the first market to get started.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
