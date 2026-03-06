import { createClient } from "@/lib/supabase/server";
import type { Market, Position, Profile, Trade } from "@/lib/domain/types";

export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getProfile(userId?: string): Promise<Profile | null> {
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();

  return (data as Profile | null) ?? null;
}

export async function getMarkets(filters?: {
  status?: string;
  category?: string;
  search?: string;
}): Promise<Market[]> {
  const supabase = await createClient();
  let query = supabase.from("markets").select("*").order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.search) {
    const s = filters.search.trim();
    if (s) {
      query = query.or(`title.ilike.%${s}%,question.ilike.%${s}%,description.ilike.%${s}%`);
    }
  }

  const { data } = await query;
  return (data as Market[] | null) ?? [];
}

export async function getMarketById(marketId: string): Promise<Market | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select("*").eq("id", marketId).single();
  return (data as Market | null) ?? null;
}

export async function getPositionForMarket(userId: string, marketId: string): Promise<Position | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("positions")
    .select(
      "id, market_id, user_id, yes_shares, no_shares, net_spent_neutrons, realized_pnl_neutrons, updated_at, markets(title, status, resolved_outcome, q_yes, q_no, b)",
    )
    .eq("user_id", userId)
    .eq("market_id", marketId)
    .maybeSingle();

  if (!data) return null;

  const row = data as Position & {
    markets?: {
      title?: string;
      status?: Position["market_status"];
      resolved_outcome?: Position["market_resolved_outcome"];
      q_yes?: number;
      q_no?: number;
      b?: number;
    } | null;
  };

  const { markets, ...base } = row;
  return {
    ...base,
    market_title: markets?.title ?? undefined,
    market_status: markets?.status ?? undefined,
    market_resolved_outcome: markets?.resolved_outcome ?? null,
    market_q_yes: markets?.q_yes ?? undefined,
    market_q_no: markets?.q_no ?? undefined,
    market_b: markets?.b ?? undefined,
  };
}

export async function getMarketTimeline(marketId: string) {
  const supabase = await createClient();

  const [{ data: proposals }, { data: challenges }, { data: adminActions }] = await Promise.all([
    supabase
      .from("resolution_proposals")
      .select("*, profiles!resolution_proposals_proposed_by_fkey(display_name)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resolution_challenges")
      .select("*, profiles!resolution_challenges_challenged_by_fkey(display_name), resolution_proposals!resolution_challenges_proposal_id_fkey(status)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resolution_admin_actions")
      .select("*, profiles!resolution_admin_actions_admin_user_id_fkey(display_name)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
  ]);

  const normalizedProposals = (proposals ?? []).map((proposal) => ({
    ...proposal,
    proposer_display_name:
      proposal.profiles?.display_name ||
      (proposal.proposed_by ? `user_${String(proposal.proposed_by).slice(0, 8)}` : "Unknown user"),
  }));

  const normalizedChallenges = (challenges ?? []).map((challenge) => ({
    ...challenge,
    challenger_display_name:
      challenge.profiles?.display_name ||
      (challenge.challenged_by ? `user_${String(challenge.challenged_by).slice(0, 8)}` : "Unknown user"),
    challenge_status:
      challenge.resolution_proposals?.status === "REJECTED"
        ? "REJECTED"
        : challenge.resolution_proposals?.status === "FINALIZED"
          ? "FINALIZED"
          : "ACTIVE",
  }));

  const normalizedAdminActions = (adminActions ?? []).map((action) => ({
    ...action,
    admin_display_name:
      action.profiles?.display_name ||
      (action.admin_user_id ? `user_${String(action.admin_user_id).slice(0, 8)}` : "Unknown admin"),
  }));

  return {
    proposals: normalizedProposals,
    challenges: normalizedChallenges,
    adminActions: normalizedAdminActions,
  };
}

export async function getPortfolio(userId: string): Promise<{
  positions: Position[];
  trades: Trade[];
}> {
  const supabase = await createClient();

  const [{ data: positions }, { data: trades }] = await Promise.all([
    supabase
      .from("positions")
      .select(
        "id, market_id, user_id, yes_shares, no_shares, net_spent_neutrons, realized_pnl_neutrons, updated_at, markets(title, status, resolved_outcome, q_yes, q_no, b)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("trades")
      .select(
        "id, market_id, user_id, outcome, side, quantity, cost_neutrons, sell_proceeds_neutrons, sell_cost_basis_neutrons, realized_pnl_neutrons, price_before, price_after, created_at, markets(title, status, resolved_outcome)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const normalizedPositions: Position[] = ((positions ?? []) as Array<
    Position & {
      markets?: {
        title?: string;
        status?: Position["market_status"];
        resolved_outcome?: Position["market_resolved_outcome"];
        q_yes?: number;
        q_no?: number;
        b?: number;
      } | null;
    }
  >).map((position) => {
    const { markets, ...base } = position;
    return {
      ...base,
      market_title: markets?.title ?? undefined,
      market_status: markets?.status ?? undefined,
      market_resolved_outcome: markets?.resolved_outcome ?? null,
      market_q_yes: markets?.q_yes ?? undefined,
      market_q_no: markets?.q_no ?? undefined,
      market_b: markets?.b ?? undefined,
    };
  });

  const normalizedTrades: Trade[] = ((trades ?? []) as Array<
    Trade & { markets?: { title?: string; status?: Trade["market_status"]; resolved_outcome?: Trade["market_resolved_outcome"] } | null }
  >).map((trade) => {
    const { markets, ...base } = trade;
    return {
      ...base,
      market_title: markets?.title ?? undefined,
      market_status: markets?.status ?? undefined,
      market_resolved_outcome: markets?.resolved_outcome ?? null,
    };
  });

  return {
    positions: normalizedPositions,
    trades: normalizedTrades,
  };
}

export async function getAdminDisputes() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("resolution_proposals")
    .select("id, market_id, proposed_outcome, challenge_deadline, status, created_at")
    .eq("status", "CHALLENGED")
    .order("created_at", { ascending: true });

  return data ?? [];
}
