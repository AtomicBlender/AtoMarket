const EPSILON = 1e-12;

function logSumExp(a: number, b: number): number {
  const max = Math.max(a, b);
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
}

export function lmsrCost(qYes: number, qNo: number, liquidity: number): number {
  const a = qYes / liquidity;
  const b = qNo / liquidity;
  return liquidity * logSumExp(a, b);
}

export function yesPrice(qYes: number, qNo: number, liquidity: number): number {
  const expYes = Math.exp(qYes / liquidity);
  const expNo = Math.exp(qNo / liquidity);
  const denominator = expYes + expNo;
  return denominator <= EPSILON ? 0.5 : expYes / denominator;
}

export function estimateBuyCost(params: {
  qYes: number;
  qNo: number;
  liquidity: number;
  outcome: "YES" | "NO";
  quantity: number;
}): { costNeutrons: number; yesPriceBefore: number; yesPriceAfter: number } {
  const { qYes, qNo, liquidity, outcome, quantity } = params;

  const nextQYes = outcome === "YES" ? qYes + quantity : qYes;
  const nextQNo = outcome === "NO" ? qNo + quantity : qNo;

  const costBefore = lmsrCost(qYes, qNo, liquidity);
  const costAfter = lmsrCost(nextQYes, nextQNo, liquidity);

  return {
    costNeutrons: Math.ceil(Math.max(0, costAfter - costBefore)),
    yesPriceBefore: yesPrice(qYes, qNo, liquidity),
    yesPriceAfter: yesPrice(nextQYes, nextQNo, liquidity),
  };
}
