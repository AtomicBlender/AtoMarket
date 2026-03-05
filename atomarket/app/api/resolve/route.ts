import { NextResponse } from "next/server";
import {
  attemptAutoResolveMarket,
  finalizeUnchallengedManualProposals,
} from "@/lib/domain/resolution";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id")
    .in("resolution_type", ["URL_SELECTOR", "JSON_PATH"])
    .in("status", ["OPEN", "CLOSED", "RESOLVING"])
    .lte("close_time", new Date().toISOString())
    .limit(25);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const [autoResults, manualFinalized] = await Promise.all([
    Promise.all((markets ?? []).map((market) => attemptAutoResolveMarket(market.id))),
    finalizeUnchallengedManualProposals(),
  ]);

  return NextResponse.json({
    ok: true,
    auto_processed: autoResults.length,
    auto_results: autoResults,
    manual_finalized: manualFinalized,
  });
}
