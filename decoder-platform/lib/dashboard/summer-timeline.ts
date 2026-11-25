/**
 * The overview's summer timeline: when each city market peaks, on one shared
 * calendar of half-months from June to September.
 *
 * Each city's private-jet fortnights and monthly yacht hours are scaled to its
 * own summer peak (1 = that city's busiest half-month), so a small resort and
 * London read on the same scale: the chart compares timing, not size. Where a
 * city has both, the two are averaged.
 */
import type { SummerTraffic } from '@/lib/config/types';

export const SLOTS = [
  { month: 6, half: 1, label: 'Early Jun' },
  { month: 6, half: 2, label: 'Late Jun' },
  { month: 7, half: 1, label: 'Early Jul' },
  { month: 7, half: 2, label: 'Late Jul' },
  { month: 8, half: 1, label: 'Early Aug' },
  { month: 8, half: 2, label: 'Late Aug' },
  { month: 9, half: 1, label: 'Early Sep' },
  { month: 9, half: 2, label: 'Late Sep' },
] as const;

export interface TimelineCell {
  /** 0–1 against the city's own peak; null when neither source covers the slot. */
  level: number | null;
  jets: number | null;
  yachts: number | null;
}

export interface TimelineRow {
  name: string;
  cells: TimelineCell[];
  /** Index into SLOTS of the busiest half-month. */
  peak: number;
  sources: Array<'jets' | 'yachts'>;
}

export interface SummerTimeline {
  rows: TimelineRow[];
  /** Mean level per slot across the rows: the season for the whole plan. */
  overall: Array<number | null>;
  /** Number of rows peaking in each slot. */
  peaks: number[];
}

const slotOf = (iso: string): number => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return -1;
  return SLOTS.findIndex((s) => s.month === d.getUTCMonth() + 1 && s.half === (d.getUTCDate() <= 15 ? 1 : 2));
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function jetSlots(jets: SummerTraffic['jets']): Array<number | null> {
  const buckets: number[][] = SLOTS.map(() => []);
  for (const p of jets?.series ?? []) {
    const i = slotOf(p.label);
    if (i >= 0 && Number.isFinite(p.value)) buckets[i].push(p.value);
  }
  return buckets.map(mean);
}

function yachtSlots(yachts: SummerTraffic['yachts']): Array<number | null> {
  const byMonth = new Map((yachts?.series ?? []).map((p) => [Number(p.label), p.value]));
  return SLOTS.map((s) => {
    const v = byMonth.get(s.month);
    return v != null && Number.isFinite(v) ? v : null;
  });
}

/** Scales a series to its own maximum; null when it has no positive value. */
function normalise(xs: Array<number | null>): Array<number | null> | null {
  const max = Math.max(0, ...xs.filter((x): x is number => x != null));
  return max > 0 ? xs.map((x) => (x == null ? null : x / max)) : null;
}

export function summerTimeline(markets: Array<{ name: string; summer?: SummerTraffic }>): SummerTimeline {
  const rows: TimelineRow[] = [];
  for (const m of markets) {
    const jets = jetSlots(m.summer?.jets);
    const yachts = yachtSlots(m.summer?.yachts);
    const nj = normalise(jets);
    const ny = normalise(yachts);
    if (!nj && !ny) continue;
    const combined = SLOTS.map((_, i) => mean([nj?.[i], ny?.[i]].filter((x): x is number => x != null)));
    // Rescale so each city's own busiest half-month reads 1.
    const levels = normalise(combined)!;
    let peak = 0;
    levels.forEach((l, i) => {
      if (l != null && l > (levels[peak] ?? -1)) peak = i;
    });
    rows.push({
      name: m.name,
      cells: SLOTS.map((_, i) => ({ level: levels[i], jets: jets[i], yachts: yachts[i] })),
      peak,
      sources: [...(nj ? (['jets'] as const) : []), ...(ny ? (['yachts'] as const) : [])],
    });
  }
  // Earliest peak first, so the chart reads as the season moving through the cities.
  rows.sort((a, b) => a.peak - b.peak || a.name.localeCompare(b.name));
  const overall = SLOTS.map((_, i) => mean(rows.map((r) => r.cells[i].level).filter((x): x is number => x != null)));
  const peaks = SLOTS.map((_, i) => rows.filter((r) => r.peak === i).length);
  return { rows, overall, peaks };
}
