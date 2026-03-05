"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { placeTradeAction } from "@/lib/actions/market";
import { estimateBuyCost } from "@/lib/domain/lmsr";
import { formatNeutrons, formatPercent } from "@/lib/domain/format";
import type { Market } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const quantityPresets = [10, 25, 50, 100];

export function TradeForm({
  market,
  disabled,
  isAuthenticated,
}: {
  market: Market;
  disabled: boolean;
  isAuthenticated: boolean;
}) {
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [quantity, setQuantity] = useState(25);
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

  const blocked = disabled || !isAuthenticated;

  return (
    <form action={onAction} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
      <input type="hidden" name="market_id" value={market.id} />
      <input type="hidden" name="outcome" value={outcome} />

      <div>
        <p className="text-sm font-semibold text-slate-100">Trade</p>
        <p className="text-xs text-slate-400">Buy-only execution against LMSR pricing.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => setOutcome("YES")}
          className={
            outcome === "YES"
              ? "h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "h-11 border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
          }
          disabled={blocked}
        >
          Buy YES
        </Button>
        <Button
          type="button"
          onClick={() => setOutcome("NO")}
          className={
            outcome === "NO"
              ? "h-11 bg-rose-500 text-white hover:bg-rose-400"
              : "h-11 border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
          }
          disabled={blocked}
        >
          Buy NO
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="quantity">
          Quantity (shares)
        </label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          value={quantity}
          disabled={blocked}
          onChange={(event) => setQuantity(Number(event.target.value || 0))}
          className="h-11 border-slate-700 bg-slate-950 text-slate-100"
        />
        <div className="flex flex-wrap gap-2">
          {quantityPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={blocked}
              onClick={() => setQuantity(preset)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Estimated cost</span>
          <strong>{formatNeutrons(estimate.costNeutrons)} neutrons</strong>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
            <div className="text-slate-500">YES Before</div>
            <div className="font-medium text-slate-200">{formatPercent(estimate.yesPriceBefore)}</div>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
            <div className="text-slate-500">YES After</div>
            <div className="font-medium text-slate-200">{formatPercent(estimate.yesPriceAfter)}</div>
          </div>
        </div>
      </div>

      <Button
        disabled={blocked || pending || quantity <= 0}
        className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
      >
        {pending ? "Executing trade..." : `Confirm ${outcome} buy`}
      </Button>

      {message ? <p className="rounded-md bg-slate-800 p-2 text-sm text-slate-300">{message}</p> : null}
      {!isAuthenticated ? (
        <p className="rounded-md border border-sky-400/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          Sign in to trade. <Link href="/auth/login" className="underline">Open login</Link>
        </p>
      ) : null}
      {disabled ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-200">
          Trading is unavailable. Market must be OPEN and before close time.
        </p>
      ) : null}
    </form>
  );
}
