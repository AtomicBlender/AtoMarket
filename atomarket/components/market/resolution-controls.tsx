"use client";

import { useState } from "react";
import {
  attemptAutoResolveAction,
  challengeResolutionAction,
  proposeResolutionAction,
} from "@/lib/actions/market";
import type { Market } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResolutionControls({
  market,
  activeProposalId,
}: {
  market: Market;
  activeProposalId?: string;
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

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold text-slate-100">Resolution Actions</h3>

      {showAuto ? (
        <form action={onAutoResolve}>
          <input type="hidden" name="market_id" value={market.id} />
          <Button disabled={pending} className="bg-sky-500 text-slate-950 hover:bg-sky-400">
            Try Auto Resolve
          </Button>
        </form>
      ) : null}

      {showManual ? (
        <>
          <form action={onPropose} className="space-y-2">
            <input type="hidden" name="market_id" value={market.id} />
            <select
              name="proposed_outcome"
              defaultValue="YES"
              className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
            >
              <option value="YES">Propose YES</option>
              <option value="NO">Propose NO</option>
            </select>
            <Input name="evidence_url" placeholder="Evidence URL" className="border-slate-700 bg-slate-950 text-slate-100" />
            <textarea
              name="evidence_note"
              rows={2}
              placeholder="Evidence note"
              className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
            />
            <Button disabled={pending} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              Submit Proposal
            </Button>
          </form>

          {activeProposalId ? (
            <form action={onChallenge} className="space-y-2">
              <input type="hidden" name="proposal_id" value={activeProposalId} />
              <input type="hidden" name="market_id" value={market.id} />
              <select
                name="challenge_outcome"
                defaultValue="NO"
                className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
              >
                <option value="NO">Challenge with NO</option>
                <option value="YES">Challenge with YES</option>
              </select>
              <Input name="evidence_url" placeholder="Challenge evidence URL" className="border-slate-700 bg-slate-950 text-slate-100" />
              <textarea
                name="evidence_note"
                rows={2}
                placeholder="Challenge note"
                className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
              />
              <Button disabled={pending} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                Challenge Proposal
              </Button>
            </form>
          ) : null}
        </>
      ) : null}

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
