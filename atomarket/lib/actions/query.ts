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
      query = query.or(`title.ilike.%${s}%,question.ilike.%${s}%`);
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

export async function getMarketTimeline(marketId: string) {
  const supabase = await createClient();

  const [{ data: proposals }, { data: challenges }] = await Promise.all([
    supabase
      .from("resolution_proposals")
      .select("*")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
    supabase
      .from("resolution_challenges")
      .select("*")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    proposals: proposals ?? [],
    challenges: challenges ?? [],
  };
}

export async function getPortfolio(userId: string): Promise<{
  positions: Position[];
  trades: Trade[];
}> {
  const supabase = await createClient();

  const [{ data: positions }, { data: trades }] = await Promise.all([
    supabase.from("positions").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabase.from("trades").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
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
    .select("id, market_id, proposed_outcome, challenge_deadline, status, created_at")
    .eq("status", "CHALLENGED")
    .order("created_at", { ascending: true });

  return data ?? [];
}
