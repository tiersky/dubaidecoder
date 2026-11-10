/**
 * Shared visual constants for canvas/SVG charts, which cannot read CSS
 * variables directly. Keep in step with app/globals.css.
 */

export const INK = '#1d1d1f';
export const INK_2 = '#5f5f66';
export const INK_3 = '#86868b';
export const ACCENT = '#0071e3';
export const NEUTRAL_LAND = '#dfe3ea';
export const NEUTRAL_LAND_HOVER = '#cfd5de';
export const GRID = 'rgba(0, 0, 0, 0.06)';

/** Sequential blue ramp (light → dark) for budget magnitude. */
export const RAMP = [
  '#b7d3f6', // 150
  '#86b6ef', // 250
  '#5598e7', // 350
  '#2a78d6', // 450
  '#1c5cab', // 550
  '#104281', // 650
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Interpolate the ramp at t ∈ [0, 1]. */
export function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const pos = clamped * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = hexToRgb(RAMP[i]);
  const b = hexToRgb(RAMP[i + 1]);
  const mix = a.map((c, k) => Math.round(c + (b[k] - c) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

/** Ramp position at which white text clears 4.5:1 (step ~450 and darker). */
export const RAMP_WHITE_TEXT_FROM = 0.55;

/** Share relative to the largest share, so the leader is always the darkest. */
export function relativeShare(split: number, maxSplit: number): number {
  if (!maxSplit || maxSplit <= 0) return 0;
  return split / maxSplit;
}

/**
 * Colour position spread across the funded range (min→max), so close shares
 * still read as distinct tones. Bar *lengths* stay proportional (relativeShare).
 */
export function toneScale(splits: number[]): (split: number) => number {
  const funded = splits.filter((s) => s > 0);
  if (funded.length === 0) return () => 0;
  const min = Math.min(...funded);
  const max = Math.max(...funded);
  return (split) => (max === min ? 1 : (split - min) / (max - min));
}

/** Font family for canvas text: whatever the body actually resolved to. */
export function chartFont(): string {
  if (typeof document === 'undefined') return 'system-ui, sans-serif';
  return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}

export const TOOLTIP_CHART = {
  backgroundColor: 'rgba(29, 29, 31, 0.88)',
  titleColor: '#f5f5f7',
  bodyColor: '#e5e5ea',
  padding: 10,
  cornerRadius: 10,
  displayColors: false,
  caretSize: 0,
} as const;

export function formatMoney(currency: string, value: number): string {
  return `${currency} ${Math.round(value).toLocaleString()}`;
}

/** Compact money for tight spaces: USD 1.25M, USD 840K. */
export function formatMoneyCompact(currency: string, value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${currency} ${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${currency} ${Math.round(value / 1e3)}K`;
  return `${currency} ${Math.round(value)}`;
}
