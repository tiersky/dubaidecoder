/**
 * How firm is each budget? Re-runs the allocation many times with the inputs
 * jittered by how reliable their source is, and reports the 10th–90th
 * percentile budget and how often each market keeps its rank (±1).
 * Deterministic: a fixed seed, so the same inputs always give the same ranges.
 */
import { computeAllocation, type AllocationRequest } from './allocation';
import type { MetricDef } from './score';

export interface Uncertainty {
  /** By market name. */
  ranges: Record<string, { p10: number; p50: number; p90: number; rankStability: number }>;
  draws: number;
}

/** Relative 1-σ noise per source. */
export const NOISE = { public: 0.05, typed: 0.15, weight: 0.1 } as const;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const isPublic = (m: MetricDef) => Boolean(m.provider && m.provider !== 'manual');

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function simulateAllocation(req: AllocationRequest, draws = 400, seed = 7): Uncertainty {
  const base = computeAllocation(req);
  const funded = base.rows.filter((r) => r.funded);
  const baseRank = new Map([...funded].sort((a, b) => b.budget - a.budget).map((r, i) => [r.name, i]));
  const samples = new Map(funded.map((r) => [r.name, [] as number[]]));
  const kept = new Map(funded.map((r) => [r.name, 0]));
  const rand = mulberry32(seed);
  // Score-kind metrics (a declared judgement scale) and the priority tier are human input: not jittered.
  const jitter = (m: MetricDef) => m.role !== 'priority' && m.kind !== 'score';
  let ok = 0;

  for (let d = 0; d < draws; d++) {
    const metrics = req.metrics.map((m) => ({ ...m, weight: Math.max(0, m.weight * (1 + NOISE.weight * normal(rand))) }));
    const markets = req.markets.map((mk) => {
      const values: Record<string, number | null> = {};
      for (const m of req.metrics) {
        const v = mk.values[m.key];
        if (v === null || v === undefined || !jitter(m)) {
          values[m.key] = v ?? null;
          continue;
        }
        const sd = isPublic(m) ? NOISE.public : NOISE.typed;
        let x = v * Math.exp(sd * normal(rand));
        if (m.kind === 'ratio' || m.role === 'audienceRatio') x = Math.min(1, x);
        values[m.key] = x;
      }
      return { ...mk, values };
    });
    const frequency = 2 + 2 * rand();
    const r = computeAllocation({ ...req, metrics, markets, planning: { ...req.planning, frequency } });
    if (r.error) continue;
    ok++;
    const ranked = r.rows.filter((x) => x.funded).sort((a, b) => b.budget - a.budget);
    ranked.forEach((row, i) => {
      samples.get(row.name)?.push(row.budget);
      if (Math.abs(i - (baseRank.get(row.name) ?? i)) <= 1) kept.set(row.name, (kept.get(row.name) ?? 0) + 1);
    });
  }

  const ranges: Uncertainty['ranges'] = {};
  for (const [name, xs] of samples) {
    xs.sort((a, b) => a - b);
    ranges[name] = {
      p10: quantile(xs, 0.1),
      p50: quantile(xs, 0.5),
      p90: quantile(xs, 0.9),
      rankStability: ok ? (kept.get(name) ?? 0) / ok : 0,
    };
  }
  return { ranges, draws: ok };
}

/**
 * Where the next slice of budget would go: the allocation at budget + step,
 * minus today's. Shows which markets the model would grow first.
 */
export function nextIncrement(req: AllocationRequest, step: number): Array<{ name: string; extra: number }> {
  const now = computeAllocation(req);
  const more = computeAllocation({ ...req, budget: req.budget + step });
  if (now.error || more.error) return [];
  const before = new Map(now.rows.map((r) => [r.name, r.budget]));
  return more.rows
    .filter((r) => r.funded)
    .map((r) => ({ name: r.name, extra: r.budget - (before.get(r.name) ?? 0) }))
    .filter((r) => r.extra > 0.5)
    .sort((a, b) => b.extra - a.extra);
}
