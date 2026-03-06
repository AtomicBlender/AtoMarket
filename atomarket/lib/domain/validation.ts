import type { ResolutionType } from "@/lib/domain/types";

export interface CreateMarketInput {
  title: string;
  question: string;
  description?: string;
  category?: string;
  close_time: string;
  resolution_deadline: string;
  resolution_type: ResolutionType;
  resolution_source: string;
  evidence_requirements: string;
  challenge_window_hours?: number;
  proposal_bond_neutrons?: number;
  challenge_bond_neutrons?: number;
}

export function validateCreateMarketInput(input: CreateMarketInput) {
  if (!input.title.trim()) throw new Error("Title is required.");
  if (!input.question.trim()) throw new Error("Question is required.");
  if (!input.resolution_source.trim()) throw new Error("Resolution source is required.");
  if (!input.evidence_requirements.trim()) throw new Error("Evidence requirements are required.");

  const close = new Date(input.close_time);
  const deadline = new Date(input.resolution_deadline);
  if (Number.isNaN(close.getTime()) || Number.isNaN(deadline.getTime())) {
    throw new Error("Close time and resolution deadline must be valid timestamps.");
  }
  if (deadline <= close) {
    throw new Error("Resolution deadline must be after close time.");
  }

  if (input.resolution_type !== "MANUAL_WITH_BOND") {
    throw new Error("New markets currently support only MANUAL_WITH_BOND resolution.");
  }

  return {
    title: input.title.trim(),
    question: input.question.trim(),
    description: input.description?.trim() || null,
    category: input.category?.trim() || null,
    close_time: input.close_time,
    resolution_deadline: input.resolution_deadline,
    resolution_type: input.resolution_type,
    resolution_source: input.resolution_source.trim(),
    challenge_window_hours: input.challenge_window_hours ?? 48,
    proposal_bond_neutrons: input.proposal_bond_neutrons ?? 500,
    challenge_bond_neutrons: input.challenge_bond_neutrons ?? 500,
    resolution_rule: {
      evidence_requirements: input.evidence_requirements.trim(),
    },
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

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): string {
  const normalized = normalizeUsername(input);
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error("Username must be 3-24 chars, lowercase letters, numbers, or underscores.");
  }
  return normalized;
}
