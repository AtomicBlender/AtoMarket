"use client";

import { useState } from "react";
import Link from "next/link";
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
  isAuthenticated,
}: {
  market: Market;
  activeProposalId?: string;
  isAuthenticated: boolean;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onAutoResolve(formData: FormData) {
    setPending(true);
    const res = await attemptAutoResolveAction(formData);
    setMessage(res.message ?? "");
    setPending(false);
  }

  async function onPropose(formData: FormData) {
    setPending(true);
    const res = await proposeResolutionAction(formData);
    setMessage(res.message ?? "");
    setPending(false);
  }

  async function onChallenge(formData: FormData) {
    setPending(true);
    const res = await challengeResolutionAction(formData);
    setMessage(res.message ?? "");
    setPending(false);
  }

  const showManual = market.resolution_type === "MANUAL_WITH_BOND";
  const showAuto = market.resolution_type === "URL_SELECTOR" || market.resolution_type === "JSON_PATH";
  const blocked = !isAuthenticated;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Resolution</h3>
        <p className="text-xs text-slate-400">Run auto checks or participate in propose/challenge flow.</p>
      </div>

      {showAuto ? (
        <form action={onAutoResolve} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <input type="hidden" name="market_id" value={market.id} />
          <p className="text-xs text-slate-400">Auto resolver checks source and applies rule.</p>
          <Button disabled={pending || blocked} className="h-10 bg-sky-500 text-slate-950 hover:bg-sky-400">
            Try Auto Resolve
          </Button>
        </form>
      ) : null}

      {showManual ? (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
            Proposal bond: {formatNeutrons(market.proposal_bond_neutrons)} neutrons. Challenge bond:{" "}
            {formatNeutrons(market.challenge_bond_neutrons)} neutrons.
          </div>

          <form action={onPropose} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <input type="hidden" name="market_id" value={market.id} />
            <p className="text-xs uppercase tracking-wide text-slate-500">Submit proposal</p>
            <select
              name="proposed_outcome"
              defaultValue="YES"
              disabled={blocked}
              className="h-10 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
            >
              <option value="YES">Propose YES</option>
              <option value="NO">Propose NO</option>
            </select>
            <Input name="evidence_url" placeholder="Evidence URL" disabled={blocked} className="h-10 border-slate-700 bg-slate-950 text-slate-100" />
            <textarea
              name="evidence_note"
              rows={2}
              placeholder="Evidence note"
              disabled={blocked}
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
            />
            <Button disabled={pending || blocked} className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              Submit Proposal
            </Button>
          </form>

          <form action={onChallenge} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <input type="hidden" name="proposal_id" value={activeProposalId ?? ""} />
            <input type="hidden" name="market_id" value={market.id} />
            <p className="text-xs uppercase tracking-wide text-slate-500">Challenge active proposal</p>
            <select
              name="challenge_outcome"
              defaultValue="NO"
              disabled={blocked || !activeProposalId}
              className="h-10 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
            >
              <option value="NO">Challenge with NO</option>
              <option value="YES">Challenge with YES</option>
            </select>
            <Input
              name="evidence_url"
              placeholder="Challenge evidence URL"
              disabled={blocked || !activeProposalId}
              className="h-10 border-slate-700 bg-slate-950 text-slate-100"
            />
            <textarea
              name="evidence_note"
              rows={2}
              placeholder="Challenge note"
              disabled={blocked || !activeProposalId}
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
            />
            <Button disabled={pending || blocked || !activeProposalId} className="h-10 bg-amber-500 text-slate-950 hover:bg-amber-400">
              Challenge Proposal
            </Button>
            {!activeProposalId ? (
              <p className="text-xs text-slate-500">No active proposal available for challenge.</p>
            ) : null}
          </form>
        </>
      ) : null}

      {!isAuthenticated ? (
        <p className="rounded-md border border-sky-400/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          Sign in to propose, challenge, or trigger auto-resolution.{" "}
          <Link href="/auth/login" className="underline">
            Open login
          </Link>
        </p>
      ) : null}

      {message ? <p className="rounded-md bg-slate-800 p-2 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
