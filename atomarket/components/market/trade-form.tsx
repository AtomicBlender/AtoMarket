"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { placeTradeAction } from "@/lib/actions/market";
import { estimateBuyCost, estimateSellCredit } from "@/lib/domain/lmsr";
import { formatNeutrons, formatPercent } from "@/lib/domain/format";
import type { Market } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const quantityPresets = [10, 25, 50, 100];
const QUANTITY_TOLERANCE = 0.0001;
const shareFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type Feedback = { kind: "success" | "error"; text: string } | null;
type ConfirmState = {
  side: "BUY" | "SELL";
  outcome: "YES" | "NO";
  quantity: number;
  estimatedAmount: number;
  sharesBefore: number;
  sharesAfter: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
};

export function TradeForm({
  market,
  disabled,
  isAuthenticated,
  neutronBalance = null,
  userYesShares = 0,
  userNoShares = 0,
}: {
  market: Market;
  disabled: boolean;
  isAuthenticated: boolean;
  neutronBalance?: number | null;
  userYesShares?: number;
  userNoShares?: number;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [quantity, setQuantity] = useState(25);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pending, setPending] = useState(false);
  const maxSellShares = outcome === "YES" ? userYesShares : userNoShares;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const loginHref = `/auth/login?next=${encodeURIComponent(nextPath)}`;

  const estimate = useMemo(
    () => {
      if (side === "BUY") {
        const buy = estimateBuyCost({
          qYes: market.q_yes,
          qNo: market.q_no,
          liquidity: market.b,
          outcome,
          quantity: Number.isFinite(quantity) ? quantity : 0,
        });
        return {
          amount: buy.costNeutrons,
          yesPriceBefore: buy.yesPriceBefore,
          yesPriceAfter: buy.yesPriceAfter,
        };
      }

      const sell = estimateSellCredit({
        qYes: market.q_yes,
        qNo: market.q_no,
        liquidity: market.b,
        outcome,
        quantity: Number.isFinite(quantity) ? quantity : 0,
      });
      return {
        amount: sell.creditNeutrons,
        yesPriceBefore: sell.yesPriceBefore,
        yesPriceAfter: sell.yesPriceAfter,
      };
    },
    [market.b, market.q_no, market.q_yes, outcome, quantity, side],
  );

  async function confirmTrade() {
    if (!confirmState) return;
    setPending(true);
    setFeedback(null);
    const formData = new FormData();
    formData.set("market_id", market.id);
    formData.set("side", confirmState.side);
    formData.set("outcome", confirmState.outcome);
    formData.set("quantity", String(confirmState.quantity));
    const result = await placeTradeAction(formData);
    setConfirmState(null);
    setFeedback({
      kind: result.ok ? "success" : "error",
      text: result.message ?? (result.ok ? "Trade completed." : "Trade failed."),
    });
    setPending(false);
  }

  function openConfirmation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (submitBlocked) return;

    const selectedShares = outcome === "YES" ? userYesShares : userNoShares;
    const snapshotQuantity = Number.isFinite(quantity) ? quantity : 0;
    const sharesAfter = side === "BUY" ? selectedShares + snapshotQuantity : selectedShares - snapshotQuantity;
    const balanceAfter =
      neutronBalance == null
        ? null
        : side === "BUY"
          ? neutronBalance - estimate.amount
          : neutronBalance + estimate.amount;

    setConfirmState({
      side,
      outcome,
      quantity: snapshotQuantity,
      estimatedAmount: estimate.amount,
      sharesBefore: selectedShares,
      sharesAfter,
      balanceBefore: neutronBalance,
      balanceAfter,
    });
  }

  const blocked = disabled || !isAuthenticated;
  const sellBlocked = side === "SELL" && maxSellShares <= 0;
  const quantityInvalidForSell = side === "SELL" && quantity > maxSellShares;
  const submitBlocked = blocked || pending || quantity <= 0 || sellBlocked || quantityInvalidForSell;
  const isQuantityMatch = (value: number) => Math.abs(quantity - value) < QUANTITY_TOLERANCE;
  const isPresetSelected = (preset: number) => isQuantityMatch(preset);
  const isMaxSelected = side === "SELL" && isQuantityMatch(maxSellShares);

  return (
    <form onSubmit={openConfirmation} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-100">Trade</p>
        <p className="text-xs text-slate-400">Buy and sell execution against LMSR pricing.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => setSide("BUY")}
          className={
            side === "BUY"
              ? "h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "h-11 border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
          }
          disabled={blocked}
        >
          Buy
        </Button>
        <Button
          type="button"
          onClick={() => setSide("SELL")}
          className={
            side === "SELL"
              ? "h-11 bg-amber-500 text-slate-950 hover:bg-amber-400"
              : "h-11 border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
          }
          disabled={blocked}
        >
          Sell
        </Button>
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
          disabled={blocked || sellBlocked}
        >
          {side} YES
        </Button>
        <Button
          type="button"
          onClick={() => setOutcome("NO")}
          className={
            outcome === "NO"
              ? "h-11 bg-rose-500 text-white hover:bg-rose-400"
              : "h-11 border border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
          }
          disabled={blocked || sellBlocked}
        >
          {side} NO
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
          min={0.01}
          step={0.01}
          value={quantity}
          disabled={blocked || sellBlocked}
          onChange={(event) => setQuantity(Number(event.target.value || 0))}
          className="h-11 border-slate-700 bg-slate-950 text-slate-100"
        />
        <div className="flex flex-wrap gap-2">
          {quantityPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={blocked || sellBlocked}
              onClick={() => setQuantity(preset)}
              className={
                isPresetSelected(preset)
                  ? "rounded-md border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                  : "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
              }
            >
              {preset}
            </button>
          ))}
          {side === "SELL" ? (
            <button
              type="button"
              disabled={blocked || sellBlocked}
              onClick={() => setQuantity(maxSellShares)}
              className={
                isMaxSelected
                  ? "rounded-md border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                  : "rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-emerald-400/40 hover:text-emerald-200"
              }
            >
              Max ({formatNeutrons(maxSellShares)})
            </button>
          ) : null}
        </div>
        {side === "SELL" ? (
          <p className="text-xs text-slate-500">
            Available to sell ({outcome}): {maxSellShares} shares
          </p>
        ) : null}
        {quantityInvalidForSell ? (
          <p className="text-xs text-rose-300">Quantity exceeds your available shares for this outcome.</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">{side === "BUY" ? "Estimated cost" : "Estimated credit"}</span>
          <strong>{formatNeutrons(estimate.amount)} neutrons</strong>
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
        type="submit"
        disabled={submitBlocked}
        className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
      >
        {pending ? "Executing trade..." : `Confirm ${outcome} ${side.toLowerCase()}`}
      </Button>

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
      {!isAuthenticated ? (
        <p className="rounded-md border border-sky-400/30 bg-sky-500/10 p-2 text-xs text-sky-200">
          Sign in to trade. <Link href={loginHref} className="underline">Open login</Link>
        </p>
      ) : null}
      {disabled ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-200">
          Trading is unavailable. Market must be OPEN and before close time.
        </p>
      ) : null}
      {sellBlocked ? (
        <p className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-200">
          You do not currently hold shares for this outcome to sell.
        </p>
      ) : null}

      {confirmState ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => {
            if (!pending) setConfirmState(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-base font-semibold text-slate-100">Confirm trade</h4>
            <p className="mt-2 text-sm text-slate-300">
              {confirmState.side} {confirmState.outcome} {shareFormat.format(confirmState.quantity)} shares
            </p>

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  {confirmState.side === "BUY" ? "Estimated cost" : "Estimated credit"}
                </span>
                <span className="font-semibold text-slate-100">
                  {formatNeutrons(confirmState.estimatedAmount)} neutrons
                </span>
              </div>
              {confirmState.balanceBefore != null && confirmState.balanceAfter != null ? (
                <>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Balance before</span>
                    <span>{formatNeutrons(confirmState.balanceBefore)} neutrons</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Balance after</span>
                    <span>{formatNeutrons(confirmState.balanceAfter)} neutrons</span>
                  </div>
                </>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">{confirmState.outcome} shares before</span>
                <span>{shareFormat.format(confirmState.sharesBefore)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-slate-500">{confirmState.outcome} shares after</span>
                <span>{shareFormat.format(confirmState.sharesAfter)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={confirmTrade}
                className="h-10 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              >
                {pending ? "Executing..." : "Confirm"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                className="h-10 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={() => setConfirmState(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
