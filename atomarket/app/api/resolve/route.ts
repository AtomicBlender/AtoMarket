import { NextResponse } from "next/server";
import {
  attemptAutoResolveMarketWithOptions,
  finalizeUnchallengedManualProposals,
} from "@/lib/domain/resolution";
import { createClient } from "@/lib/supabase/server";

type ResolveResult = Awaited<ReturnType<typeof attemptAutoResolveMarketWithOptions>>;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));
  return results;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing or malformed bearer token" }, { status: 401 });
  }
  if (token !== cronSecret) {
    return NextResponse.json({ ok: false, error: "Invalid bearer token" }, { status: 403 });
  }

  const maxMarkets = Math.min(parsePositiveInt(process.env.RESOLVE_MAX_MARKETS, 25), 100);
  const concurrency = Math.min(parsePositiveInt(process.env.RESOLVE_CONCURRENCY, 4), 10);
  const fetchTimeoutMs = Math.min(parsePositiveInt(process.env.RESOLVE_FETCH_TIMEOUT_MS, 5000), 30000);

  const supabase = await createClient();

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id")
    .in("resolution_type", ["URL_SELECTOR", "JSON_PATH"])
    .in("status", ["OPEN", "CLOSED", "RESOLVING"])
    .lte("close_time", new Date().toISOString())
    .limit(maxMarkets);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const marketRows = markets ?? [];
  const [autoResults, manualFinalized] = await Promise.all([
    mapWithConcurrency(marketRows, concurrency, (market) =>
      attemptAutoResolveMarketWithOptions(market.id, { fetchTimeoutMs }),
    ),
    finalizeUnchallengedManualProposals(maxMarkets),
  ]);

  const summary = autoResults.reduce(
    (acc, result: ResolveResult) => {
      acc.processed += 1;
      if (result.resolved) acc.resolved += 1;
      else acc.skipped += 1;
      if (result.reason === "fetch_timeout") acc.timeout_count += 1;
      return acc;
    },
    { processed: 0, resolved: 0, skipped: 0, timeout_count: 0 },
  );

  return NextResponse.json({
    ok: true,
    auto_processed: summary.processed,
    auto_resolved: summary.resolved,
    auto_skipped: summary.skipped,
    timeout_count: summary.timeout_count,
    auto_results: autoResults,
    manual_finalized: manualFinalized,
    limits: {
      max_markets: maxMarkets,
      concurrency,
      fetch_timeout_ms: fetchTimeoutMs,
    },
  });
}
