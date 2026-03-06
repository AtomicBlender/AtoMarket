import { createClient } from "@/lib/supabase/server";

type Rule = Record<string, unknown>;
type ResolveOptions = {
  fetchTimeoutMs?: number;
};

function readByJsonPath(payload: unknown, path: string): unknown {
  // Minimal JSON path support for dot notation and [index], e.g. $.data.items[0].status
  const normalized = path.replace(/^\$\./, "");
  const segments = normalized.split(".");
  let current: unknown = payload;

  for (const segment of segments) {
    if (current == null) return null;

    const indexMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (indexMatch) {
      const key = indexMatch[1];
      const index = Number(indexMatch[2]);
      const obj = current as Record<string, unknown>;
      const arr = obj[key] as unknown[] | undefined;
      current = Array.isArray(arr) ? arr[index] : null;
      continue;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function compare(rule: Rule, value: string): boolean {
  const operator = String(rule.operator ?? "contains");
  const compareValue = String(rule.compare_value ?? "");

  if (operator === "contains") return value.includes(compareValue);
  if (operator === "equals") return value === compareValue;
  if (operator === "regex") {
    const rx = new RegExp(compareValue, "i");
    return rx.test(value);
  }

  const numberValue = Number(value);
  const numberCompare = Number(compareValue);
  if (Number.isNaN(numberValue) || Number.isNaN(numberCompare)) return false;

  if (operator === "lte") return numberValue <= numberCompare;
  if (operator === "gte") return numberValue >= numberCompare;

  return false;
}

function extractBySelector(html: string, selector: string): string {
  if (selector === "body") {
    return html.replace(/<[^>]+>/g, " ");
  }

  // Lightweight extraction for #id and .class selectors.
  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    const rx = new RegExp(`<[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
    return (html.match(rx)?.[1] ?? "").replace(/<[^>]+>/g, " ");
  }

  if (selector.startsWith(".")) {
    const className = selector.slice(1);
    const rx = new RegExp(`<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
    return (html.match(rx)?.[1] ?? "").replace(/<[^>]+>/g, " ");
  }

  return "";
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function attemptAutoResolveMarket(marketId: string): Promise<{
  resolved: boolean;
  outcome?: "YES" | "NO";
  reason?: string;
}> {
  return attemptAutoResolveMarketWithOptions(marketId, {});
}

export async function attemptAutoResolveMarketWithOptions(
  marketId: string,
  options: ResolveOptions = {},
): Promise<{
  resolved: boolean;
  outcome?: "YES" | "NO";
  reason?: string;
}> {
  const supabase = await createClient();

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .select("*")
    .eq("id", marketId)
    .single();

  if (marketError || !market) return { resolved: false, reason: "market_not_found" };
  if (!["URL_SELECTOR", "JSON_PATH"].includes(market.resolution_type)) {
    return { resolved: false, reason: "not_auto_type" };
  }

  if (!market.resolution_url) {
    return { resolved: false, reason: "missing_resolution_url" };
  }

  const rule = (market.resolution_rule ?? {}) as Rule;
  const fetchTimeoutMs = Math.max(1000, options.fetchTimeoutMs ?? 5000);

  try {
    const res = await fetchWithTimeout(market.resolution_url, fetchTimeoutMs);
    if (!res.ok) throw new Error(`fetch_failed_${res.status}`);

    let compareTarget = "";

    if (market.resolution_type === "URL_SELECTOR") {
      const selector = String(rule.selector ?? "body");
      const html = await res.text();
      compareTarget = extractBySelector(html, selector).trim();
      if (rule.match_regex) {
        const rx = new RegExp(String(rule.match_regex), "i");
        const match = compareTarget.match(rx);
        compareTarget = match?.[0] ?? "";
      }
    }

    if (market.resolution_type === "JSON_PATH") {
      const payload = await res.json();
      const path = String(rule.json_path ?? "$");
      const val = readByJsonPath(payload, path);
      compareTarget = val == null ? "" : String(val);
    }

    if (!compareTarget) {
      throw new Error("empty_compare_target");
    }

    const yes = compare(rule, compareTarget);
    const outcome = yes ? "YES" : "NO";

    const { error: resolveError } = await supabase.rpc("finalize_market_yes_no", {
      p_market_id: marketId,
      p_outcome: outcome,
      p_notes: `Auto-resolved from ${market.resolution_type}`,
    });

    if (resolveError) {
      return { resolved: false, reason: resolveError.message };
    }

    return { resolved: true, outcome };
  } catch (error) {
    const attempts = (market.resolution_attempts ?? 0) + 1;
    await supabase
      .from("markets")
      .update({ resolution_attempts: attempts, status: "RESOLVING" })
      .eq("id", marketId);

    const deadlineReached = new Date(market.resolution_deadline).getTime() <= Date.now();
    if (deadlineReached || attempts >= 10) {
      await supabase.rpc("finalize_market_invalid_refund", {
        p_market_id: marketId,
        p_reason: "Auto-resolution failed before deadline.",
      });
      return { resolved: false, reason: "invalidated" };
    }

    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "fetch_timeout"
        : error instanceof Error
          ? error.message
          : "unknown_error";
    return { resolved: false, reason };
  }
}

export async function finalizeUnchallengedManualProposalsForMarket(marketId: string): Promise<number> {
  const supabase = await createClient();

  const { data: proposals, error } = await supabase
    .from("resolution_proposals")
    .select("id")
    .eq("market_id", marketId)
    .eq("status", "ACTIVE")
    .lte("challenge_deadline", new Date().toISOString())
    .limit(20);

  if (error || !proposals?.length) return 0;

  let finalizedCount = 0;

  for (const proposal of proposals) {
    const { data: result } = await supabase.rpc("finalize_active_proposal_if_unchallenged", {
      p_proposal_id: proposal.id,
    });

    if (result === "finalized") {
      finalizedCount += 1;
    }
  }

  return finalizedCount;
}

export async function finalizeUnchallengedManualProposals(limit = 50): Promise<number> {
  const supabase = await createClient();

  const { data: proposals, error } = await supabase
    .from("resolution_proposals")
    .select("id")
    .eq("status", "ACTIVE")
    .lte("challenge_deadline", new Date().toISOString())
    .order("challenge_deadline", { ascending: true })
    .limit(limit);

  if (error || !proposals?.length) return 0;

  let finalizedCount = 0;

  for (const proposal of proposals) {
    const { data: result } = await supabase.rpc("finalize_active_proposal_if_unchallenged", {
      p_proposal_id: proposal.id,
    });

    if (result === "finalized") {
      finalizedCount += 1;
    }
  }

  return finalizedCount;
}
