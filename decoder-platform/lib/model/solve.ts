/**
 * Budget solvers for the v2 models. Both are "find the level t at which the
 * clamped per-market spends sum to the budget", where each market's spend is
 * monotone in t, so a bisection in log space is exact to float precision.
 */

export interface Bounds {
  min: number; // ≥ 0
  max: number; // ≥ min, may be Infinity
}

export class InfeasibleBudgetError extends Error {
  constructor(
    message: string,
    readonly shortfall: number
  ) {
    super(message);
    this.name = 'InfeasibleBudgetError';
  }
}

const clamp = (x: number, b: Bounds) => Math.min(b.max, Math.max(b.min, x));

/**
 * Generic level solver on u = ln t. `spend(i, u)` must be non-decreasing in u
 * and ≥ 0. Returns spends that sum to `budget` within each market's bounds.
 * Working in log space keeps very saturated or very cheap markets finite.
 */
function solveLevel(n: number, bounds: Bounds[], budget: number, spend: (i: number, u: number) => number): number[] {
  const minSum = bounds.reduce((a, b) => a + b.min, 0);
  const maxSum = bounds.reduce((a, b) => a + b.max, 0);
  if (minSum > budget + 1e-6) {
    throw new InfeasibleBudgetError(`Minimums add up to more than the budget.`, minSum - budget);
  }
  if (maxSum < budget - 1e-6) {
    throw new InfeasibleBudgetError(`Maximums add up to less than the budget.`, budget - maxSum);
  }
  const at = (u: number) => Array.from({ length: n }, (_, i) => clamp(spend(i, u), bounds[i]));
  const total = (u: number) => at(u).reduce((a, b) => a + b, 0);

  let lo = -50;
  let hi = 50;
  while (total(lo) > budget && lo > -1e6) lo *= 2;
  while (total(hi) < budget && hi < 1e6) hi *= 2;
  for (let k = 0; k < 200 && hi - lo > 1e-13 * Math.max(1, Math.abs(hi)); k++) {
    const mid = (lo + hi) / 2;
    if (total(mid) < budget) lo = mid;
    else hi = mid;
  }
  const s = at(hi);
  // Spread float residue over the markets with headroom so the sum is exact.
  const residue = budget - s.reduce((a, b) => a + b, 0);
  if (residue !== 0 && Number.isFinite(residue)) {
    const free = s.map((v, i) => Math.max(0, residue > 0 ? bounds[i].max - v : v - bounds[i].min));
    const open = free.filter((f) => f === Infinity).length;
    const room = free.reduce((a, b) => a + b, 0);
    if (open > 0) for (let i = 0; i < n; i++) s[i] += free[i] === Infinity ? residue / open : 0;
    else if (room > 0) for (let i = 0; i < n; i++) s[i] += (residue * free[i]) / room;
  }
  return s;
}

/** Score model: spend ∝ weight, within bounds (capped water-filling). */
export function solveProportional(weights: number[], bounds: Bounds[], budget: number): number[] {
  if (weights.every((w) => w <= 0)) {
    // Nothing to weigh by: honour minimums, split the rest evenly where allowed.
    return solveLevel(weights.length, bounds, budget, (_i, u) => Math.exp(u));
  }
  return solveLevel(weights.length, bounds, budget, (i, u) => weights[i] * Math.exp(u));
}

export interface ResponseMarket {
  /** Value per person reached: quality × priority. */
  value: number;
  /** Addressable audience (people). */
  audience: number;
  /** Cost per thousand impressions, in budget currency. */
  cpm: number;
  /** Effective frequency κ. */
  frequency: number;
}

/** Saturation scale c = κ·A·CPM/1000: spend at which 63% of the audience is reached. */
export const saturationScale = (m: ResponseMarket) => (m.frequency * m.audience * m.cpm) / 1000;

/** People reached at spend s: A·(1 − e^(−s/c)). */
export const reach = (m: ResponseMarket, s: number) => m.audience * (1 - Math.exp(-s / saturationScale(m)));

/** Marginal value of the next unit of spend: value·(1000/(κ·CPM))·e^(−s/c). */
export const marginalValue = (m: ResponseMarket, s: number) =>
  ((m.value * 1000) / (m.frequency * m.cpm)) * Math.exp(-s / saturationScale(m));

/**
 * Optimised model: maximise Σ value·reach(s) subject to Σ s = budget and the
 * bounds. Concave, so the optimum equalises marginal value λ across unclamped
 * markets: s = c·(ln v₀ − ln λ) with v₀ the marginal value at zero spend. We
 * solve on u = −ln λ so spend is increasing in u.
 */
export function solveResponse(markets: ResponseMarket[], bounds: Bounds[], budget: number): number[] {
  const v0 = markets.map((m) => marginalValue(m, 0));
  if (v0.every((v) => !(v > 0))) return solveProportional(markets.map(() => 0), bounds, budget);
  const c = markets.map(saturationScale);
  const lnV0 = v0.map((v) => (v > 0 ? Math.log(v) : -Infinity));
  return solveLevel(markets.length, bounds, budget, (i, u) => (v0[i] > 0 ? Math.max(0, c[i] * (lnV0[i] + u)) : 0));
}

/** Largest-remainder rounding to whole currency units; keeps the exact total. */
export function roundToUnits(values: number[], total: number): number[] {
  const target = Math.round(total);
  const floors = values.map((v) => Math.floor(v));
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}
