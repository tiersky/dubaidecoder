import type { FixedAllocation } from '../config/types';

/**
 * Budget per market under a fixed allocation: enabled `fixed` markets take
 * their amount off the top, the remainder is split over enabled `shares`
 * markets pro rata. If the budget is below the fixed sum, or no share market
 * is enabled, the whole budget goes to the fixed markets in proportion to
 * their amounts. Markets that are disabled or unlisted get 0.
 */
export function applyFixedAllocation(
  alloc: FixedAllocation,
  enabledNames: Set<string>,
  totalBudget: number
): Map<string, number> {
  const budgets = new Map<string, number>();
  const fixed = Object.entries(alloc.fixed).filter(([n]) => enabledNames.has(n));
  const shares = Object.entries(alloc.shares).filter(([n]) => enabledNames.has(n));
  const fixedSum = fixed.reduce((a, [, v]) => a + v, 0);
  const shareSum = shares.reduce((a, [, v]) => a + v, 0);

  for (const n of [...Object.keys(alloc.fixed), ...Object.keys(alloc.shares)]) budgets.set(n, 0);

  if (fixedSum > 0 && (totalBudget <= fixedSum || shareSum <= 0)) {
    for (const [n, v] of fixed) budgets.set(n, (v / fixedSum) * totalBudget);
    return budgets;
  }
  for (const [n, v] of fixed) budgets.set(n, v);
  const remainder = totalBudget - fixedSum;
  if (shareSum > 0) for (const [n, v] of shares) budgets.set(n, (v / shareSum) * remainder);
  return budgets;
}
