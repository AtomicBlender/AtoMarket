import type { ResolutionType } from "@/lib/domain/types";

export interface CreateMarketInput {
  title: string;
  question: string;
  category?: string;
  close_time: string;
  resolution_deadline: string;
  resolution_type: ResolutionType;
  resolution_source: string;
  resolution_url?: string;
  resolution_rule: string;
  challenge_window_hours?: number;
  proposal_bond_neutrons?: number;
  challenge_bond_neutrons?: number;
}

export function parseRule(ruleText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(ruleText);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Resolution rule must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Resolution rule must be valid JSON.");
  }
}

export function validateCreateMarketInput(input: CreateMarketInput) {
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!input.question.trim()) throw new Error("Question is required.");
  if (!input.resolution_source.trim()) throw new Error("Resolution source is required.");

  const close = new Date(input.close_time);
  const deadline = new Date(input.resolution_deadline);
  if (Number.isNaN(close.getTime()) || Number.isNaN(deadline.getTime())) {
    throw new Error("Close time and resolution deadline must be valid timestamps.");
  }
  if (deadline <= close) {
    throw new Error("Resolution deadline must be after close time.");
  }

  const rule = parseRule(input.resolution_rule);

  if (input.resolution_type === "URL_SELECTOR") {
    if (!input.resolution_url?.trim()) throw new Error("resolution_url is required for URL_SELECTOR.");
    if (!rule.selector) throw new Error("resolution_rule.selector is required for URL_SELECTOR.");
  }

  if (input.resolution_type === "JSON_PATH") {
    if (!input.resolution_url?.trim()) throw new Error("resolution_url is required for JSON_PATH.");
    if (!rule.json_path) throw new Error("resolution_rule.json_path is required for JSON_PATH.");
  }

  if (input.resolution_type === "MANUAL_WITH_BOND") {
    if (!rule.evidence_requirements) {
      throw new Error("resolution_rule.evidence_requirements is required for MANUAL_WITH_BOND.");
    }
  }

  return {
    ...input,
    title: input.title.trim(),
    question: input.question.trim(),
    category: input.category?.trim() || null,
    resolution_source: input.resolution_source.trim(),
    resolution_url: input.resolution_url?.trim() || null,
    challenge_window_hours: input.challenge_window_hours ?? 48,
    proposal_bond_neutrons: input.proposal_bond_neutrons ?? 500,
    challenge_bond_neutrons: input.challenge_bond_neutrons ?? 500,
    resolution_rule: rule,
  };
}

export function validateProposalEligibility(createdAt: string | null, isAdmin: boolean) {
  if (isAdmin) return;
  if (!createdAt) throw new Error("Profile not found.");

  const created = new Date(createdAt).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (Date.now() - created < sevenDays) {
    throw new Error("Account must be at least 7 days old to propose or challenge.");
  }
}
