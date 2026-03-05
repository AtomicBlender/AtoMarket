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
      <form action={onResolve} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="market_id" value={marketId} />
        <select
          name="outcome"
          defaultValue="YES"
          className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
        >
          <option value="YES">Resolve YES</option>
          <option value="NO">Resolve NO</option>
        </select>
        <input
          name="notes"
          defaultValue="Admin dispute decision"
          className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
        />
        <Button className="bg-blue-500 text-white hover:bg-blue-400">Resolve</Button>
      </form>

      <form action={onInvalidate} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="market_id" value={marketId} />
        <input
          name="reason"
          defaultValue="Unable to resolve before deadline"
          className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
        />
        <Button className="bg-rose-500 text-white hover:bg-rose-400">Invalidate + Refund</Button>
      </form>

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
