import { createClient, createPublicClient } from "@/lib/supabase/server";
import type {
  ChallengeKind,
  LeaderboardEntry,
  Market,
  MarketPublicTrade,
  MarketTopHolder,
  MarketTopPosition,
  Position,
  ProbabilityHistoryPoint,
  Profile,
  PublicProfile,
  Trade,
} from "@/lib/domain/types";

const PROFILE_COLUMNS = "id, display_name, username, is_admin, is_active, deactivated_at, neutron_balance, created_at";
const MARKET_CARD_COLUMNS = "id, title, question, description, category, status, close_time, volume_neutrons, b, q_yes, q_no, created_at";
const MARKET_DETAIL_COLUMNS =
  "id, title, question, description, category, status, close_time, resolution_deadline, resolution_type, resolution_source, resolution_rule, challenge_window_hours, proposal_bond_neutrons, challenge_bond_neutrons, resolved_outcome, resolution_notes, resolved_at, invalid_reason, resolution_attempts, volume_neutrons, b, q_yes, q_no, created_by, created_at, profiles!markets_created_by_fkey(display_name, username)";

export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getProfile(userId?: string): Promise<Profile | null> {
  if (!userId) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single();

  return (data as Profile | null) ?? null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_username_available", {
    p_username: username,
  });
  if (error) return false;
  return Boolean(data);
}

export async function getMarkets(filters?: {
  status?: string;
  category?: string;
  search?: string;
}): Promise<Market[]> {
  const supabase = await createClient();
  let query = supabase.from("markets").select(MARKET_CARD_COLUMNS);

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
  const markets = (data as Market[] | null) ?? [];

  const statusFilter = filters?.status && filters.status !== "ALL" ? filters.status : "ALL";

  return markets.sort((a, b) => {
    if (statusFilter === "ALL") {
      const aOpenRank = a.status === "OPEN" ? 0 : 1;
      const bOpenRank = b.status === "OPEN" ? 0 : 1;
      if (aOpenRank !== bOpenRank) return aOpenRank - bOpenRank;
    }

    const aVolume = a.volume_neutrons ?? 0;
    const bVolume = b.volume_neutrons ?? 0;
    if (aVolume !== bVolume) return bVolume - aVolume;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function getHomePageMarkets(): Promise<{
  popularMarkets: Market[];
  totalMarkets: number;
  openCount: number;
}> {
  const supabase = createPublicClient();

  const [{ data: popularMarkets }, { count: totalMarkets }, { count: openCount }] = await Promise.all([
    supabase
      .from("markets")
      .select(MARKET_CARD_COLUMNS)
      .eq("status", "OPEN")
      .order("volume_neutrons", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(7),
    supabase.from("markets").select("id", { count: "exact", head: true }),
    supabase.from("markets").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
  ]);

  return {
    popularMarkets: (popularMarkets as Market[] | null) ?? [],
    totalMarkets: totalMarkets ?? 0,
    openCount: openCount ?? 0,
  };
}

export async function getMarketsFeed(
  filters: { status?: string; category?: string; search?: string },
  limit = 24,
  offset = 0,
): Promise<{ markets: Market[]; totalCount: number }> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_markets_feed", {
    p_status: filters.status ?? "ALL",
    p_category: filters.category ?? null,
    p_search: filters.search ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  const rows = (data as Array<Market & { total_count: number }> | null) ?? [];
  const totalCount = rows[0]?.total_count ?? 0;
  const markets = rows as unknown as Market[];
  return { markets, totalCount };
}

export async function getHomeLeaderboard(windowDays = 30, limit = 100): Promise<LeaderboardEntry[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_home_leaderboard", {
    p_window_days: windowDays,
    p_limit: limit,
  });
  return (data as LeaderboardEntry[] | null) ?? [];
}

export async function getMarketById(marketId: string): Promise<Market | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("markets").select(MARKET_DETAIL_COLUMNS).eq("id", marketId).single();
  if (!data) return null;

  const row = data as Market & {
    profiles?: {
      display_name?: string | null;
      username?: string | null;
    } | Array<{
      display_name?: string | null;
      username?: string | null;
    }> | null;
  };
  const creatorProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const market = { ...row };
  delete (market as { profiles?: unknown }).profiles;

  return {
    ...market,
    creator_display_name: creatorProfile?.display_name?.trim() || null,
    creator_username: creatorProfile?.username ?? null,
  };
}

function downsampleHistory(points: ProbabilityHistoryPoint[], maxPoints: number): ProbabilityHistoryPoint[] {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 2) return [points[0], points[points.length - 1]];

  const sampled: ProbabilityHistoryPoint[] = [points[0]];
  const interiorCount = maxPoints - 2;
  const step = (points.length - 2) / interiorCount;

  for (let i = 1; i <= interiorCount; i += 1) {
    const index = Math.min(points.length - 2, Math.max(1, Math.round(i * step)));
    sampled.push(points[index]);
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}

export async function getMarketProbabilityHistory(
  marketId: string,
  fallbackYesProbability: number,
): Promise<ProbabilityHistoryPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_market_probability_history_public", {
    p_market_id: marketId,
  });

  const trades = (data as Array<{ created_at: string; price_before: number; price_after: number }> | null) ?? [];

  if (trades.length === 0) {
    return [{ ts: new Date().toISOString(), yes_probability: fallbackYesProbability }];
  }

  const first = trades[0];
  const points: ProbabilityHistoryPoint[] = [
    {
      ts: first.created_at,
      yes_probability: Number(first.price_before ?? fallbackYesProbability),
    },
  ];

  for (const trade of trades) {
    points.push({
      ts: trade.created_at,
      yes_probability: Number(trade.price_after ?? fallbackYesProbability),
    });
  }

  return downsampleHistory(
    points.map((point) => ({
      ts: point.ts,
      yes_probability: Math.max(0, Math.min(1, point.yes_probability)),
    })),
    300,
  );
}

export async function getMarketProbabilityHistoryMap(
  marketIds: string[],
  fallbackYesProbabilityByMarketId: Record<string, number>,
): Promise<Record<string, ProbabilityHistoryPoint[]>> {
  if (marketIds.length === 0) return {};

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_market_probability_history_public_batch", {
    p_market_ids: marketIds,
  });

  const trades =
    (data as Array<{ market_id: string; created_at: string; price_before: number; price_after: number }> | null) ?? [];

  const grouped = new Map<string, Array<{ created_at: string; price_before: number; price_after: number }>>();
  for (const trade of trades) {
    const list = grouped.get(trade.market_id) ?? [];
    list.push({
      created_at: trade.created_at,
      price_before: trade.price_before,
      price_after: trade.price_after,
    });
    grouped.set(trade.market_id, list);
  }

  const nowIso = new Date().toISOString();
  const result: Record<string, ProbabilityHistoryPoint[]> = {};

  for (const marketId of marketIds) {
    const fallback = fallbackYesProbabilityByMarketId[marketId] ?? 0.5;
    const marketTrades = grouped.get(marketId) ?? [];

    if (marketTrades.length === 0) {
      result[marketId] = [{ ts: nowIso, yes_probability: fallback }];
      continue;
    }

    const first = marketTrades[0];
    const points: ProbabilityHistoryPoint[] = [
      {
        ts: first.created_at,
        yes_probability: Number(first.price_before ?? fallback),
      },
    ];

    for (const trade of marketTrades) {
      points.push({
        ts: trade.created_at,
        yes_probability: Number(trade.price_after ?? fallback),
      });
    }

    result[marketId] = downsampleHistory(
      points.map((point) => ({
        ts: point.ts,
        yes_probability: Math.max(0, Math.min(1, point.yes_probability)),
      })),
      140,
    );
  }

  return result;
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
      .select(
        "id, market_id, proposed_by, proposed_outcome, evidence_url, evidence_note, bond_neutrons, status, challenge_deadline, created_at, profiles!resolution_proposals_proposed_by_fkey(display_name, username)",
      )
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resolution_challenges")
      .select(
        "id, proposal_id, market_id, challenged_by, challenge_kind, challenge_outcome, evidence_url, evidence_note, bond_neutrons, created_at, profiles!resolution_challenges_challenged_by_fkey(display_name, username), resolution_proposals!resolution_challenges_proposal_id_fkey(status)",
      )
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resolution_admin_actions")
      .select(
        "id, market_id, admin_user_id, action_type, note, created_at, profiles!resolution_admin_actions_admin_user_id_fkey(display_name, username)",
      )
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
  ]);

  const normalizedProposals = (proposals ?? []).map((proposal) => {
    const proposerProfile = Array.isArray(proposal.profiles) ? proposal.profiles[0] : proposal.profiles;
    return {
      ...proposal,
      proposer_username: proposerProfile?.username ?? null,
      proposer_display_name:
        proposerProfile?.display_name ||
        (proposal.proposed_by ? `user_${String(proposal.proposed_by).slice(0, 8)}` : "Unknown user"),
    };
  });

  const normalizedChallenges = (challenges ?? []).map((challenge) => {
    const challengerProfile = Array.isArray(challenge.profiles) ? challenge.profiles[0] : challenge.profiles;
    const proposalRow = Array.isArray(challenge.resolution_proposals)
      ? challenge.resolution_proposals[0]
      : challenge.resolution_proposals;
    return {
      ...challenge,
      challenge_kind: (challenge.challenge_kind ?? "OPPOSITE_OUTCOME") as ChallengeKind,
      challenger_username: challengerProfile?.username ?? null,
      challenger_display_name:
        challengerProfile?.display_name ||
        (challenge.challenged_by ? `user_${String(challenge.challenged_by).slice(0, 8)}` : "Unknown user"),
      challenge_label:
        challenge.challenge_kind === "DISAGREE_NOT_RESOLVED"
          ? "DISAGREE / NOT YET RESOLVED"
          : challenge.challenge_outcome ?? "Opposite outcome",
      challenge_status:
        proposalRow?.status === "REJECTED"
          ? "REJECTED"
          : proposalRow?.status === "FINALIZED"
            ? "FINALIZED"
            : "ACTIVE",
    };
  });

  const normalizedAdminActions = (adminActions ?? []).map((action) => {
    const adminProfile = Array.isArray(action.profiles) ? action.profiles[0] : action.profiles;
    return {
      ...action,
      admin_username: adminProfile?.username ?? null,
      admin_display_name:
        adminProfile?.display_name ||
        (action.admin_user_id ? `user_${String(action.admin_user_id).slice(0, 8)}` : "Unknown admin"),
    };
  });

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
        "id, market_id, user_id, outcome, side, quantity, cost_neutrons, sell_proceeds_neutrons, price_before, price_after, created_at, markets(title, status, resolved_outcome)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
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

export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) return null;

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_public_profile_by_username", {
    p_username: normalizedUsername,
  });

  const rows = (data as PublicProfile[] | null) ?? [];
  return rows[0] ?? null;
}

export async function getPublicPortfolioByUsername(username: string): Promise<{
  positions: Position[];
  trades: Trade[];
}> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) {
    return {
      positions: [],
      trades: [],
    };
  }

  const supabase = createPublicClient();

  const [{ data: positions }, { data: trades }] = await Promise.all([
    supabase.rpc("get_public_portfolio_positions", {
      p_username: normalizedUsername,
    }),
    supabase.rpc("get_public_portfolio_trades", {
      p_username: normalizedUsername,
    }),
  ]);

  return {
    positions: (positions as Position[] | null) ?? [],
    trades: (trades as Trade[] | null) ?? [],
  };
}

export async function getAdminDisputes() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("resolution_proposals")
    .select(
      "id, market_id, proposed_outcome, challenge_deadline, status, created_at, resolution_challenges!resolution_challenges_proposal_id_fkey(challenge_kind, challenge_outcome, created_at)",
    )
    .eq("status", "CHALLENGED")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => {
    const challenge = Array.isArray(row.resolution_challenges) ? row.resolution_challenges[0] : row.resolution_challenges;
    return {
      ...row,
      challenge_kind: (challenge?.challenge_kind ?? "OPPOSITE_OUTCOME") as ChallengeKind,
      challenge_outcome: challenge?.challenge_outcome ?? null,
      challenge_label:
        challenge?.challenge_kind === "DISAGREE_NOT_RESOLVED"
          ? "Premature / unsupported proposal dispute"
          : `Outcome dispute: ${challenge?.challenge_outcome ?? "opposite"}`,
    };
  });
}

export async function getMarketBottomTabsData(
  marketId: string,
  limit = 25,
): Promise<{
  holdersYes: MarketTopHolder[];
  holdersNo: MarketTopHolder[];
  positionsYes: MarketTopPosition[];
  positionsNo: MarketTopPosition[];
  recentActivity: MarketPublicTrade[];
}> {
  const supabase = createPublicClient();

  const [
    { data: holdersYes },
    { data: holdersNo },
    { data: positionsYes },
    { data: positionsNo },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.rpc("get_market_top_holders_public", {
      p_market_id: marketId,
      p_outcome: "YES",
      p_limit: limit,
    }),
    supabase.rpc("get_market_top_holders_public", {
      p_market_id: marketId,
      p_outcome: "NO",
      p_limit: limit,
    }),
    supabase.rpc("get_market_top_positions_public", {
      p_market_id: marketId,
      p_outcome: "YES",
      p_limit: limit,
    }),
    supabase.rpc("get_market_top_positions_public", {
      p_market_id: marketId,
      p_outcome: "NO",
      p_limit: limit,
    }),
    supabase.rpc("get_market_trades_public", {
      p_market_id: marketId,
      p_limit: limit,
      p_offset: 0,
    }),
  ]);

  return {
    holdersYes: (holdersYes as MarketTopHolder[] | null) ?? [],
    holdersNo: (holdersNo as MarketTopHolder[] | null) ?? [],
    positionsYes: (positionsYes as MarketTopPosition[] | null) ?? [],
    positionsNo: (positionsNo as MarketTopPosition[] | null) ?? [],
    recentActivity: (recentActivity as MarketPublicTrade[] | null) ?? [],
  };
}
