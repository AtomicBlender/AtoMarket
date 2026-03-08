"use server";

import { revalidatePath } from "next/cache";
import { attemptAutoResolveMarket } from "@/lib/domain/resolution";
import { validateCreateMarketInput, validateProposalEligibility } from "@/lib/domain/validation";
import type { ChallengeKind, OutcomeType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  ok: boolean;
  message?: string;
  marketId?: string;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function toTradeMessage(raw: string): string {
  if (raw.includes("insufficient_shares")) return "Insufficient shares to sell that quantity.";
  if (raw.includes("insufficient_neutrons")) return "Insufficient neutrons.";
  if (raw.includes("market_closed")) return "Trading is closed for this market.";
  if (raw.includes("invalid_quantity")) return "Quantity must be greater than zero.";
  if (raw.includes("invalid_trade_cost")) return "Invalid buy cost for this trade.";
  if (raw.includes("invalid_trade_credit")) return "Invalid sell credit for this trade.";
  return raw;
}

function toProposalMessage(raw: string): string {
  if (raw.includes("not_authenticated")) return "Sign in required.";
  if (raw.includes("inactive_account")) return "Account is inactive. Contact support to reactivate.";
  if (raw.includes("market_not_found")) return "Market not found.";
  if (raw.includes("manual_bond_only")) return "Proposals only allowed for MANUAL_WITH_BOND markets.";
  if (raw.includes("market_already_finalized")) return "This market is already finalized. New proposals are not allowed.";
  if (raw.includes("resolution_deadline_passed")) return "Resolution deadline has passed. No new proposals are allowed.";
  if (raw.includes("active_proposal_exists")) {
    return "A proposal is already active for this market. You can challenge it instead.";
  }
  if (raw.includes("insufficient_proposal_bond")) return "Insufficient neutrons to post proposal bond.";
  return raw;
}

function toChallengeMessage(raw: string): string {
  if (raw.includes("not_authenticated")) return "Sign in required.";
  if (raw.includes("inactive_account")) return "Account is inactive. Contact support to reactivate.";
  if (raw.includes("proposal_not_found")) return "Proposal not found.";
  if (raw.includes("proposal_not_active")) return "Proposal is not active.";
  if (raw.includes("challenge_window_closed")) return "Challenge window closed.";
  if (raw.includes("challenge_target_market_mismatch")) return "Challenge target market mismatch.";
  if (raw.includes("market_not_found")) return "Market not found.";
  if (raw.includes("market_already_finalized")) return "This market is already finalized. Challenges are not allowed.";
  if (raw.includes("challenge_outcome_required")) return "Invalid challenge outcome.";
  if (raw.includes("challenge_outcome_not_allowed")) return "Disagreement challenges cannot specify an outcome.";
  if (raw.includes("challenge_outcome_must_be_opposite")) {
    return "Challenge outcome must be opposite of the proposed outcome.";
  }
  if (raw.includes("challenge_already_exists")) return "This proposal has already been challenged.";
  if (raw.includes("insufficient_challenge_bond")) return "Insufficient neutrons to post challenge bond.";
  return raw;
}

function isOutcome(value: string): value is OutcomeType {
  return value === "YES" || value === "NO";
}

function isChallengeKind(value: string): value is ChallengeKind {
  return value === "OPPOSITE_OUTCOME" || value === "DISAGREE_NOT_RESOLVED";
}

export async function createMarketAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };
    await assertActiveProfile(supabase, authData.user.id);

    const payload = validateCreateMarketInput({
      title: String(formData.get("title") ?? ""),
      question: String(formData.get("question") ?? ""),
      description: String(formData.get("description") ?? ""),
      category: String(formData.get("category") ?? ""),
      close_time: String(formData.get("close_time") ?? ""),
      resolution_deadline: String(formData.get("resolution_deadline") ?? ""),
      resolution_type: "MANUAL_WITH_BOND",
      resolution_source: String(formData.get("resolution_source") ?? ""),
      evidence_requirements: String(formData.get("evidence_requirements") ?? ""),
      challenge_window_hours: Number(formData.get("challenge_window_hours") ?? 48),
      proposal_bond_neutrons: Number(formData.get("proposal_bond_neutrons") ?? 500),
      challenge_bond_neutrons: Number(formData.get("challenge_bond_neutrons") ?? 500),
    });

    const { data, error } = await supabase
      .from("markets")
      .insert({
        ...payload,
        created_by: authData.user.id,
      })
      .select("id")
      .single();

    if (error) return { ok: false, message: error.message };

    revalidatePath("/markets");
    return { ok: true, message: "Market created.", marketId: data.id };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function placeTradeAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };
    await assertActiveProfile(supabase, authData.user.id);

    const marketId = String(formData.get("market_id") ?? "");
    const side = String(formData.get("side") ?? "BUY").toUpperCase();
    const outcome = String(formData.get("outcome") ?? "YES");
    const quantity = Number(formData.get("quantity") ?? "0");
    if (side !== "BUY" && side !== "SELL") {
      return { ok: false, message: "Invalid trade side." };
    }

    const { error } =
      side === "BUY"
        ? await supabase.rpc("place_trade_buy_only", {
            p_market_id: marketId,
            p_outcome: outcome,
            p_quantity: quantity,
          })
        : await supabase.rpc("place_trade_sell_only", {
            p_market_id: marketId,
            p_outcome: outcome,
            p_quantity: quantity,
          });

    if (error) return { ok: false, message: toTradeMessage(error.message) };

    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");
    revalidatePath("/markets");

    if (side === "SELL") {
      return { ok: true, message: `Sold ${quantity} ${outcome} shares.` };
    }
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
    await assertActiveProfile(supabase, authData.user.id);

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
      .select("id, status, resolution_type, resolution_deadline")
      .eq("id", marketId)
      .single();

    if (marketError || !market) return { ok: false, message: "Market not found." };
    if (market.resolution_type !== "MANUAL_WITH_BOND") {
      return { ok: false, message: "Proposals only allowed for MANUAL_WITH_BOND markets." };
    }
    if (market.status === "RESOLVED" || market.status === "INVALID_REFUND") {
      return { ok: false, message: "This market is already finalized. New proposals are not allowed." };
    }

    if (new Date(market.resolution_deadline).getTime() <= Date.now()) {
      return { ok: false, message: "Resolution deadline has passed. No new proposals are allowed." };
    }

    const { error } = await supabase.rpc("submit_resolution_proposal_with_bond", {
      p_market_id: market.id,
      p_proposed_outcome: outcome,
      p_evidence_url: evidenceUrl || null,
      p_evidence_note: evidenceNote || null,
    });

    if (error) return { ok: false, message: toProposalMessage(error.message) };

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
    await assertActiveProfile(supabase, authData.user.id);

    const proposalId = String(formData.get("proposal_id") ?? "");
    const marketId = String(formData.get("market_id") ?? "");
    const challengeKindRaw = String(formData.get("challenge_kind") ?? "OPPOSITE_OUTCOME");
    const challengeOutcomeRaw = String(formData.get("challenge_outcome") ?? "");
    const evidenceUrl = String(formData.get("evidence_url") ?? "");
    const evidenceNote = String(formData.get("evidence_note") ?? "");
    if (!isChallengeKind(challengeKindRaw)) {
      return { ok: false, message: "Invalid challenge type." };
    }

    const challengeKind = challengeKindRaw;

    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, is_admin")
      .eq("id", authData.user.id)
      .single();

    validateProposalEligibility(profile?.created_at ?? null, Boolean(profile?.is_admin));

    const { data: proposal, error: proposalError } = await supabase
      .from("resolution_proposals")
      .select("id, market_id, challenge_deadline, status, proposed_outcome")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) return { ok: false, message: "Proposal not found." };
    if (proposal.status !== "ACTIVE") return { ok: false, message: "Proposal is not active." };
    if (new Date(proposal.challenge_deadline).getTime() <= Date.now()) {
      return { ok: false, message: "Challenge window closed." };
    }

    let challengeOutcome: OutcomeType | null = null;
    if (challengeKind === "OPPOSITE_OUTCOME") {
      if (!isOutcome(challengeOutcomeRaw)) {
        return { ok: false, message: "Invalid challenge outcome." };
      }
      if (challengeOutcomeRaw === proposal.proposed_outcome) {
        return { ok: false, message: "Challenge outcome must be opposite of the proposed outcome." };
      }
      challengeOutcome = challengeOutcomeRaw;
    }

    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("id, status")
      .eq("id", proposal.market_id)
      .single();

    if (marketError || !market) return { ok: false, message: "Market not found." };
    if (market.id !== marketId) {
      return { ok: false, message: "Challenge target market mismatch." };
    }
    if (market.status === "RESOLVED" || market.status === "INVALID_REFUND") {
      return { ok: false, message: "This market is already finalized. Challenges are not allowed." };
    }

    const { error: challengeError } = await supabase.rpc("submit_resolution_challenge_with_bond", {
      p_proposal_id: proposal.id,
      p_market_id: proposal.market_id,
      p_challenge_kind: challengeKind,
      p_challenge_outcome: challengeOutcome,
      p_evidence_url: evidenceUrl || null,
      p_evidence_note: evidenceNote || null,
    });

    if (challengeError) return { ok: false, message: toChallengeMessage(challengeError.message) };

    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");
    revalidatePath("/admin");

    return {
      ok: true,
      message:
        challengeKind === "DISAGREE_NOT_RESOLVED"
          ? "Disagreement challenge submitted."
          : "Opposite-outcome challenge submitted.",
    };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function adminResolveDisputeAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };

    const marketId = String(formData.get("market_id") ?? "");
    const outcome = String(formData.get("outcome") ?? "YES");
    const notes = String(formData.get("notes") ?? "Admin resolution");

    const { error } = await supabase.rpc("admin_resolve_market_with_bonds", {
      p_market_id: marketId,
      p_outcome: outcome,
      p_notes: notes,
    });

    if (error) return { ok: false, message: error.message };

    await supabase.from("resolution_admin_actions").insert({
      market_id: marketId,
      admin_user_id: authData.user.id,
      action_type: "RESOLVE",
      note: `${notes} (Outcome: ${outcome})`,
    });

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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };

    const marketId = String(formData.get("market_id") ?? "");
    const reason = String(formData.get("reason") ?? "Resolution deadline reached.");

    const { error } = await supabase.rpc("admin_invalidate_market_with_bonds", {
      p_market_id: marketId,
      p_reason: reason,
    });

    if (error) return { ok: false, message: error.message };

    await supabase.from("resolution_admin_actions").insert({
      market_id: marketId,
      admin_user_id: authData.user.id,
      action_type: "INVALIDATE",
      note: reason,
    });

    revalidatePath("/admin");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    revalidatePath("/portfolio");

    return { ok: true, message: "Market invalidated and refunded." };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

export async function deferDisputeAction(formData: FormData): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return { ok: false, message: "Sign in required." };

    const marketId = String(formData.get("market_id") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();
    if (!notes) {
      return { ok: false, message: "Please include a reason for deferring." };
    }

    const { data, error } = await supabase.rpc("admin_defer_market_with_bonds", {
      p_market_id: marketId,
      p_notes: notes,
    });

    if (error) return { ok: false, message: error.message };

    await supabase.from("resolution_admin_actions").insert({
      market_id: marketId,
      admin_user_id: authData.user.id,
      action_type: "DEFER",
      note: notes,
    });

    revalidatePath("/admin");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    revalidatePath("/portfolio");

    if (data === "deferred_reopened") {
      return {
        ok: true,
        message: "Decision deferred. Bonds were returned and market reopened for new proposal submissions.",
      };
    }

    return {
      ok: true,
      message:
        "Decision deferred and bonds returned, but resolution deadline has passed so the market remains RESOLVING.",
    };
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

async function assertActiveProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", userId)
    .single();

  if (profile?.is_active === false) {
    throw new Error("Account is inactive. Contact support to reactivate.");
  }
}
