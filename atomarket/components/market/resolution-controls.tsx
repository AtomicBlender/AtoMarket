"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  attemptAutoResolveAction,
  challengeResolutionAction,
  proposeResolutionAction,
} from "@/lib/actions/market";
import type { Market } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNeutrons } from "@/lib/domain/format";

export function ResolutionControls({
  market,
  activeProposalId,
  activeProposalOutcome,
  hasBlockingProposal,
  isAuthenticated,
  neutronBalance,
}: {
  market: Market;
  activeProposalId?: string;
  activeProposalOutcome?: "YES" | "NO";
  hasBlockingProposal: boolean;
  isAuthenticated: boolean;
  neutronBalance: number | null;
}) {
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | {
        type: "proposal" | "challenge";
        formData: FormData;
      }
    | null
  >(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const loginHref = `/auth/login?next=${encodeURIComponent(nextPath)}`;

  async function onAutoResolve(formData: FormData) {
    setPending(true);
    setFeedback(null);
    const res = await attemptAutoResolveAction(formData);
    setFeedback({
      kind: res.ok ? "success" : "error",
      text: res.message ?? (res.ok ? "Completed." : "Action failed."),
    });
    setPending(false);
  }

  async function onPropose(formData: FormData) {
    setPending(true);
    setFeedback(null);
    const res = await proposeResolutionAction(formData);
    setFeedback({
      kind: res.ok ? "success" : "error",
      text: res.message ?? (res.ok ? "Completed." : "Action failed."),
    });
    setPending(false);
  }

  async function onChallenge(formData: FormData) {
    setPending(true);
    setFeedback(null);
    const res = await challengeResolutionAction(formData);
    setFeedback({
      kind: res.ok ? "success" : "error",
      text: res.message ?? (res.ok ? "Completed." : "Action failed."),
    });
    setPending(false);
  }

  function assertSufficientBalance(bondAmount: number): boolean {
    if (neutronBalance == null) return true;
    if (neutronBalance < bondAmount) {
      setFeedback({
        kind: "error",
        text: `Insufficient balance. You need ${formatNeutrons(bondAmount)} neutrons, but have ${formatNeutrons(
          neutronBalance,
        )}.`,
      });
      return false;
    }
    return true;
  }

  function handleProposeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!assertSufficientBalance(market.proposal_bond_neutrons)) return;
    setConfirmAcknowledged(false);
    setConfirmState({
      type: "proposal",
      formData: new FormData(event.currentTarget),
    });
  }

  function handleChallengeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!assertSufficientBalance(market.challenge_bond_neutrons)) return;
    setConfirmAcknowledged(false);
    setConfirmState({
      type: "challenge",
      formData: new FormData(event.currentTarget),
    });
  }

  async function confirmSubmission() {
    if (!confirmState) return;
    if (!confirmAcknowledged) return;
    const { type, formData } = confirmState;
    setConfirmState(null);
    setConfirmAcknowledged(false);
    if (type === "proposal") {
      await onPropose(formData);
      return;
    }
    await onChallenge(formData);
  }

  const showManual = market.resolution_type === "MANUAL_WITH_BOND";
  const showAuto = market.resolution_type === "URL_SELECTOR" || market.resolution_type === "JSON_PATH";
  const blocked = !isAuthenticated;
  const deadlinePassed = new Date(market.resolution_deadline).getTime() <= Date.now();
  const isFinalized = market.status === "RESOLVED" || market.status === "INVALID_REFUND";
  const showProposalForm = !hasBlockingProposal && !deadlinePassed && !isFinalized;
  const proposalBlocked = blocked || pending || !showProposalForm;
  const hasActiveProposal = Boolean(activeProposalId && activeProposalOutcome);
  const oppositeChallengeOutcome = activeProposalOutcome === "YES" ? "NO" : "YES";
  const showChallengeForm = hasActiveProposal && !deadlinePassed && !isFinalized;
  const challengeBlocked = blocked || pending || !showChallengeForm;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
      <header>
        <h3 className="text-sm font-semibold text-slate-100">Resolution</h3>
        <p className="text-xs text-slate-400">Submit evidence-backed proposals and challenge disputed outcomes.</p>
      </header>

      {showAuto ? (
        <form action={onAutoResolve} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <input type="hidden" name="market_id" value={market.id} />
          <p className="text-xs text-slate-400">Auto resolver checks the source and applies rule logic.</p>
          <Button disabled={pending || blocked} className="h-10 w-full bg-sky-500 text-slate-950 hover:bg-sky-400">
            {pending ? "Running..." : "Try Auto Resolve"}
          </Button>
        </form>
      ) : null}

      {showManual ? (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
            <p>Proposal bond: {formatNeutrons(market.proposal_bond_neutrons)} neutrons</p>
            <p>Challenge bond: {formatNeutrons(market.challenge_bond_neutrons)} neutrons</p>
            <p>Resolution deadline: {new Date(market.resolution_deadline).toLocaleString()}</p>
          </div>

          {deadlinePassed ? (
            <p className="rounded-md border border-rose-400/30 bg-rose-500/10 p-2 text-xs text-rose-200">
              Resolution deadline has passed. New proposals and challenges are closed.
            </p>
          ) : null}
          {isFinalized ? (
            <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2 text-xs text-emerald-200">
              This market is finalized. New proposals and challenges are closed.
            </p>
          ) : null}

          {showProposalForm ? (
            <form onSubmit={handleProposeSubmit} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <input type="hidden" name="market_id" value={market.id} />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Submit Proposal</p>
                <p className="mt-1 text-xs text-slate-500">
                  You can submit proposals any time before the resolution deadline, and cite evidence from any date.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="proposed_outcome">
                  Proposed outcome
                </label>
                <select
                  id="proposed_outcome"
                  name="proposed_outcome"
                  defaultValue="YES"
                  disabled={proposalBlocked}
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                >
                  <option value="YES">Propose YES</option>
                  <option value="NO">Propose NO</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="proposal_evidence_url">
                  Evidence URL
                </label>
                <Input
                  id="proposal_evidence_url"
                  name="evidence_url"
                  placeholder="https://example.com/proof"
                  disabled={proposalBlocked}
                  className="h-10 border-slate-700 bg-slate-950 text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="proposal_evidence_note">
                  Evidence note
                </label>
                <textarea
                  id="proposal_evidence_note"
                  name="evidence_note"
                  rows={3}
                  placeholder="Quote the exact line and explain why it resolves YES/NO."
                  disabled={proposalBlocked}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
                />
              </div>

              <Button type="submit" disabled={proposalBlocked} className="h-10 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                {pending ? "Submitting..." : "Submit Proposal"}
              </Button>
            </form>
          ) : hasBlockingProposal ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
              A proposal already exists for this market. New proposals are disabled until current resolution is finalized.
            </div>
          ) : null}

          {showChallengeForm ? (
            <form onSubmit={handleChallengeSubmit} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <input type="hidden" name="proposal_id" value={activeProposalId ?? ""} />
              <input type="hidden" name="market_id" value={market.id} />

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Challenge Active Proposal</p>
                <p className="mt-1 text-xs text-slate-500">Provide concise counter-evidence for the opposite outcome.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="challenge_outcome">
                  Challenge outcome
                </label>
                <input type="hidden" name="challenge_outcome" value={oppositeChallengeOutcome} />
                <div
                  id="challenge_outcome"
                  className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm leading-10 text-slate-100"
                >
                  Challenge with {oppositeChallengeOutcome}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="challenge_evidence_url">
                  Challenge evidence URL
                </label>
                <Input
                  id="challenge_evidence_url"
                  name="evidence_url"
                  placeholder="https://example.com/counter-evidence"
                  disabled={challengeBlocked}
                  className="h-10 border-slate-700 bg-slate-950 text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400" htmlFor="challenge_evidence_note">
                  Challenge note
                </label>
                <textarea
                  id="challenge_evidence_note"
                  name="evidence_note"
                  rows={3}
                  placeholder="Explain why the active proposal is incorrect."
                  disabled={challengeBlocked}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
                />
              </div>

              <Button type="submit" disabled={challengeBlocked} className="h-10 w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
                {pending ? "Submitting..." : "Challenge Proposal"}
              </Button>
            </form>
          ) : !hasActiveProposal ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
              No active proposal is currently available to challenge.
            </div>
          ) : null}
        </>
      ) : null}

      {!isAuthenticated ? (
        <p className="rounded-md border border-sky-400/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          Sign in to propose, challenge, or trigger auto-resolution. <Link href={loginHref} className="underline">Open login</Link>
        </p>
      ) : null}

      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-md border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm text-emerald-200"
              : "rounded-md border border-rose-400/30 bg-rose-500/10 p-2 text-sm text-rose-200"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      {confirmState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100">Confirm submission</h4>
            <p className="mt-2 text-sm text-slate-300">
              Are you sure you want to submit this {confirmState.type}?
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Bond amount:{" "}
              <span className="font-semibold text-slate-100">
                {formatNeutrons(
                  confirmState.type === "proposal"
                    ? market.proposal_bond_neutrons
                    : market.challenge_bond_neutrons,
                )}{" "}
                neutrons
              </span>
            </p>
            {neutronBalance != null ? (
              <p className="mt-1 text-sm text-slate-300">
                Your balance: <span className="font-semibold text-slate-100">{formatNeutrons(neutronBalance)} neutrons</span>
              </p>
            ) : null}
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={confirmAcknowledged}
                onChange={(event) => setConfirmAcknowledged(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500"
              />
              <span>
                I understand this {confirmState.type} will submit now and deduct a bond of{" "}
                <span className="font-semibold text-slate-100">
                  {formatNeutrons(
                    confirmState.type === "proposal"
                      ? market.proposal_bond_neutrons
                      : market.challenge_bond_neutrons,
                  )}{" "}
                  neutrons
                </span>
                . The bond will be refunded if the resolution is finalized in your favor.
              </span>
            </label>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                disabled={!confirmAcknowledged || pending}
                onClick={confirmSubmission}
                className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  setConfirmState(null);
                  setConfirmAcknowledged(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
