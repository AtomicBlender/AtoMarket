"use client";

import { useState } from "react";
import { adminResolveDisputeAction, invalidateMarketAction } from "@/lib/actions/market";
import { Button } from "@/components/ui/button";

export function AdminControls({ marketId }: { marketId: string }) {
  const [message, setMessage] = useState("");

  async function onResolve(formData: FormData) {
    const result = await adminResolveDisputeAction(formData);
    setMessage(result.message ?? "");
  }

  async function onInvalidate(formData: FormData) {
    const result = await invalidateMarketAction(formData);
    setMessage(result.message ?? "");
  }

  return (
    <div className="space-y-3">
      <form action={onResolve} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Resolve market</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="market_id" value={marketId} />
          <select
            name="outcome"
            defaultValue="YES"
            className="h-10 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
          >
            <option value="YES">Resolve YES</option>
            <option value="NO">Resolve NO</option>
          </select>
          <input
            name="notes"
            defaultValue="Admin dispute decision"
            className="h-10 min-w-56 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
          />
          <Button className="h-10 bg-blue-500 text-white hover:bg-blue-400">Resolve</Button>
        </div>
      </form>

      <form action={onInvalidate} className="space-y-2 rounded-xl border border-rose-500/35 bg-rose-500/5 p-3">
        <p className="text-xs uppercase tracking-wide text-rose-300">Invalidate and refund</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="market_id" value={marketId} />
          <input
            name="reason"
            defaultValue="Unable to resolve before deadline"
            className="h-10 min-w-56 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
          />
          <Button className="h-10 bg-rose-500 text-white hover:bg-rose-400">Invalidate + Refund</Button>
        </div>
      </form>

      {message ? <p className="rounded-md bg-slate-800 p-2 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
