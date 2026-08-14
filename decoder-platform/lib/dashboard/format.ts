/**
 * Generic numeric formatter shared across dashboard tables/cards.
 * Values under 1 in magnitude are shown with two decimals (ratios/rates);
 * larger values are rounded and thousands-separated. Null renders as an
 * em dash placeholder.
 */
export function fmt(v: number | null): string {
  if (v === null) return '—';
  if (Math.abs(v) < 1) return v.toFixed(2);
  return Math.round(v).toLocaleString();
}
