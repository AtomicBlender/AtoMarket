"use client";

import { useMemo, useState } from "react";
import { placeTradeAction } from "@/lib/actions/market";
import { estimateBuyCost } from "@/lib/domain/lmsr";
import { formatNeutrons, formatPercent } from "@/lib/domain/format";
import type { Market } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TradeForm({ market, disabled }: { market: Market; disabled: boolean }) {
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [quantity, setQuantity] = useState(10);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const estimate = useMemo(
    () =>
      estimateBuyCost({
        qYes: market.q_yes,
        qNo: market.q_no,
        liquidity: market.b,
        outcome,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      }),
    [market.b, market.q_no, market.q_yes, outcome, quantity],
  );

  async function onAction(formData: FormData) {
    setPending(true);
    const result = await placeTradeAction(formData);
    setMessage(result.message ?? "");
    setPending(false);
  }

  return (
    <form action={onAction} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <input type="hidden" name="market_id" value={market.id} />
      <input type="hidden" name="outcome" value={outcome} />

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => setOutcome("YES")}
          className={outcome === "YES" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-100"}
          disabled={disabled}
        >
          Buy YES
        </Button>
        <Button
          type="button"
          onClick={() => setOutcome("NO")}
          className={outcome === "NO" ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-100"}
          disabled={disabled}
        >
          Buy NO
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300" htmlFor="quantity">
          Quantity (shares)
        </label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          value={quantity}
          disabled={disabled}
          onChange={(event) => setQuantity(Number(event.target.value || 0))}
          className="border-slate-700 bg-slate-950 text-slate-100"
        />
      </div>

      <div className="rounded-lg bg-slate-800 p-3 text-sm text-slate-300">
        <div className="flex justify-between">
          <span>Estimated cost</span>
          <strong>{formatNeutrons(estimate.costNeutrons)} neutrons</strong>
        </div>
        <div className="mt-1 flex justify-between">
          <span>YES price before</span>
          <strong>{formatPercent(estimate.yesPriceBefore)}</strong>
        </div>
        <div className="mt-1 flex justify-between">
          <span>YES price after</span>
          <strong>{formatPercent(estimate.yesPriceAfter)}</strong>
        </div>
      </div>

      <Button
        disabled={disabled || pending || quantity <= 0}
        className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
      >
        {pending ? "Executing..." : `Buy ${outcome}`}
      </Button>

      {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      {disabled ? <p className="text-xs text-amber-300">Trading is unavailable while market is not OPEN.</p> : null}
    </form>
  );
}
