"use server";

import { revalidatePath } from "next/cache";
import { attemptAutoResolveMarket } from "@/lib/domain/resolution";
import { validateCreateMarketInput, validateProposalEligibility } from "@/lib/domain/validation";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  message?: string;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export async function createMarketAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };

    const payload = validateCreateMarketInput({
      title: String(formData.get("title") ?? ""),
      question: String(formData.get("question") ?? ""),
      category: String(formData.get("category") ?? ""),
      close_time: String(formData.get("close_time") ?? ""),
      resolution_deadline: String(formData.get("resolution_deadline") ?? ""),
      resolution_type: String(formData.get("resolution_type") ?? "URL_SELECTOR") as
        | "URL_SELECTOR"
        | "JSON_PATH"
        | "MANUAL_WITH_BOND",
      resolution_source: String(formData.get("resolution_source") ?? ""),
      resolution_url: String(formData.get("resolution_url") ?? ""),
      resolution_rule: String(formData.get("resolution_rule") ?? ""),
      challenge_window_hours: Number(formData.get("challenge_window_hours") ?? 48),
      proposal_bond_neutrons: Number(formData.get("proposal_bond_neutrons") ?? 500),
      challenge_bond_neutrons: Number(formData.get("challenge_bond_neutrons") ?? 500),
    });

    const { error } = await supabase.from("markets").insert({
      ...payload,
      created_by: authData.user.id,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath("/markets");
    return { ok: true, message: "Market created." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function placeTradeAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const marketId = String(formData.get("market_id") ?? "");
    const outcome = String(formData.get("outcome") ?? "YES");
    const quantity = Number(formData.get("quantity") ?? "0");

    const { error } = await supabase.rpc("place_trade_buy_only", {
      p_market_id: marketId,
      p_outcome: outcome,
      p_quantity: quantity,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");
    revalidatePath("/markets");

    return { ok: true, message: `Bought ${quantity} ${outcome} shares.` };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function proposeResolutionAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { ok: false, message: "Sign in required." };

    const marketId = String(formData.get("market_id") ?? "");
    const outcome = String(formData.get("proposed_outcome") ?? "YES");
    const evidenceUrl = String(formData.get("evidence_url") ?? "");
    const evidenceNote = String(formData.get("evidence_note") ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, is_admin")
      .eq("id", authData.user.id)
      .single();

    validateProposalEligibility(profile?.created_at ?? null, Boolean(profile?.is_admin));

    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id, resolution_type, close_time, proposal_bond_neutrons, challenge_window_hours")
      .eq("id", marketId)
      .single();

    if (marketError || !market) return { ok: false, message: "Market not found." };
    if (market.resolution_type !== "MANUAL_WITH_BOND") {
      return { ok: false, message: "Proposals only allowed for MANUAL_WITH_BOND markets." };
    }
    if (new Date(market.close_time).getTime() > Date.now()) {
      return { ok: false, message: "Market must be closed before proposing." };
    }

    const challengeDeadline = new Date(Date.now() + market.challenge_window_hours * 3600 * 1000).toISOString();

    const { error } = await supabase.from("resolution_proposals").insert({
      market_id: market.id,
      proposed_by: authData.user.id,
      proposed_outcome: outcome,
      evidence_url: evidenceUrl || null,
      evidence_note: evidenceNote || null,
      bond_neutrons: market.proposal_bond_neutrons,
      challenge_deadline: challengeDeadline,
      status: "ACTIVE",
    });

    if (error) return { ok: false, message: error.message };

    await supabase
      .from("profiles")
      .update({ neutron_balance: (await currentBalance(supabase, authData.user.id)) - market.proposal_bond_neutrons })
      .eq("id", authData.user.id);

    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");

    return { ok: true, message: "Resolution proposal submitted." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function challengeResolutionAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { ok: false, message: "Sign in required." };

    const proposalId = String(formData.get("proposal_id") ?? "");
    const marketId = String(formData.get("market_id") ?? "");
    const challengeOutcome = String(formData.get("challenge_outcome") ?? "NO");
    const evidenceUrl = String(formData.get("evidence_url") ?? "");
    const evidenceNote = String(formData.get("evidence_note") ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, is_admin")
      .eq("id", authData.user.id)
      .single();

    validateProposalEligibility(profile?.created_at ?? null, Boolean(profile?.is_admin));

    const { data: proposal, error: proposalError } = await supabase
      .from("resolution_proposals")
      .select("id, market_id, challenge_deadline, status")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) return { ok: false, message: "Proposal not found." };
    if (proposal.status !== "ACTIVE") return { ok: false, message: "Proposal is not active." };
    if (new Date(proposal.challenge_deadline).getTime() <= Date.now()) {
      return { ok: false, message: "Challenge window closed." };
    }

    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("challenge_bond_neutrons")
      .eq("id", marketId)
      .single();

    if (marketError || !market) return { ok: false, message: "Market not found." };

    const { error: challengeError } = await supabase.from("resolution_challenges").insert({
      proposal_id: proposal.id,
      market_id: proposal.market_id,
      challenged_by: authData.user.id,
      challenge_outcome: challengeOutcome,
      evidence_url: evidenceUrl || null,
      evidence_note: evidenceNote || null,
      bond_neutrons: market.challenge_bond_neutrons,
    });

    if (challengeError) return { ok: false, message: challengeError.message };

    const { error: proposalUpdateError } = await supabase
      .from("resolution_proposals")
      .update({ status: "CHALLENGED" })
      .eq("id", proposal.id);

    if (proposalUpdateError) return { ok: false, message: proposalUpdateError.message };

    await supabase
      .from("profiles")
      .update({ neutron_balance: (await currentBalance(supabase, authData.user.id)) - market.challenge_bond_neutrons })
      .eq("id", authData.user.id);

    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");
    revalidatePath("/admin");

    return { ok: true, message: "Challenge submitted." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function adminResolveDisputeAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const marketId = String(formData.get("market_id") ?? "");
    const outcome = String(formData.get("outcome") ?? "YES");
    const notes = String(formData.get("notes") ?? "Admin resolution");

    const { error } = await supabase.rpc("finalize_market_yes_no", {
      p_market_id: marketId,
      p_outcome: outcome,
      p_notes: notes,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath("/admin");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    revalidatePath("/portfolio");

    return { ok: true, message: "Market resolved." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function invalidateMarketAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const marketId = String(formData.get("market_id") ?? "");
    const reason = String(formData.get("reason") ?? "Resolution deadline reached.");

    const { error } = await supabase.rpc("finalize_market_invalid_refund", {
      p_market_id: marketId,
      p_reason: reason,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath("/admin");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    revalidatePath("/portfolio");

    return { ok: true, message: "Market invalidated and refunded." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function attemptAutoResolveAction(formData: FormData): Promise<ActionResult> {
  const marketId = String(formData.get("market_id") ?? "");

  const result = await attemptAutoResolveMarket(marketId);
  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/markets");

  if (!result.resolved) {
    return { ok: false, message: result.reason ?? "No resolution." };
  }

  return { ok: true, message: `Auto-resolved ${result.outcome}.` };
}

async function currentBalance(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("neutron_balance")
    .eq("id", userId)
    .single();
  return Number(profile?.neutron_balance ?? 0);
}
