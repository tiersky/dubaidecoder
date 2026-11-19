import { normalCdf } from './normal';
import type { MetricDef } from './score';

/** MAD → standard deviation for normal data. */
const MAD_SCALE = 1.4826;

export interface QualityMarket {
  name: string;
  values: Record<string, number | null>;
}

export interface QualityResult {
  /** Data-driven quality in [0, 1]. */
  q: number;
  /** Share of the factor weight that had data, in [0, 1]. */
  coverage: number;
  /** Per-metric index in [0, 1]; absent when the value is missing. */
  indices: Record<string, number>;
}

export interface MetricReference {
  median: number;
  spread: number; // MAD × 1.4826 in transformed units
  sorted: number[]; // transformed universe values, for the rank fallback
}

/**
 * Metrics that count towards quality. The media-expertise tier is never a
 * factor (it is the priority). In the optimised model, audience and CPM enter
 * through the response curve, so they leave the quality score to avoid
 * counting them twice; in the score model they stay ordinary factors.
 */
export function qualityMetrics(metrics: MetricDef[], curveRoles = false): MetricDef[] {
  return metrics.filter((m) => m.weight > 0 && m.role !== 'priority' && !(curveRoles && m.role));
}

/** ln for 'log' metrics, so a change of units (thousands vs units) cancels out. Zero or below sits at the bottom. */
function transform(m: MetricDef, x: number): number {
  if (m.transform === 'log') return x > 0 ? Math.log(x) : -Infinity;
  return x;
}

export function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** Robust reference for one metric over the universe's non-missing values. */
export function metricReference(m: MetricDef, universe: QualityMarket[]): MetricReference {
  const sorted = universe
    .map((u) => u.values[m.key])
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
    .map((v) => transform(m, v))
    .sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  const spread = mad * MAD_SCALE;
  return { median: med, spread: Number.isFinite(spread) ? spread : 0, sorted };
}

/** Mid-rank percentile of t among the reference values, in (0, 1). */
function midRank(t: number, sorted: number[]): number {
  if (sorted.length === 0) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < t) below++;
    else if (v === t) equal++;
  }
  return (below + equal / 2 + 0.5) / (sorted.length + 1);
}

/** Index in [0, 1] for one value; null when it can't be scored. */
export function metricIndex(m: MetricDef, x: number | null | undefined, ref: MetricReference): number | null {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  let raw: number;
  if (m.kind === 'score' && m.scale) {
    // Judgment scores keep their own fixed scale: never measured against the group.
    raw = Math.min(1, Math.max(0, (x - m.scale.min) / (m.scale.max - m.scale.min)));
  } else {
    const t = transform(m, x);
    raw = ref.spread > 0 ? normalCdf(t, ref.median, ref.spread) : midRank(t, ref.sorted);
  }
  return m.direction === 'lower' ? 1 - raw : raw;
}

/**
 * v2 quality: robust index per metric against the rest of the allocation universe, a
 * weighted mean over the metrics that have data, shrunk towards neutral (0.5)
 * by how much of the weight is missing. A blank never earns points.
 */
export function computeQuality(
  markets: QualityMarket[],
  universe: QualityMarket[],
  metrics: MetricDef[],
  opts: { curveRoles?: boolean } = {}
): Map<string, QualityResult> {
  const used = qualityMetrics(metrics, opts.curveRoles);
  const totalWeight = used.reduce((a, m) => a + m.weight, 0);
  const out = new Map<string, QualityResult>();
  for (const mk of markets) {
    // Leave-one-out: a market is compared with the *other* markets in the
    // universe, so improving its own figure can never lower its own index.
    const peers = universe.filter((u) => u.name !== mk.name);
    const refs = new Map(used.map((m) => [m.key, metricReference(m, peers)]));
    const indices: Record<string, number> = {};
    let observed = 0;
    let acc = 0;
    for (const m of used) {
      const i = metricIndex(m, mk.values[m.key], refs.get(m.key)!);
      if (i === null) continue;
      indices[m.key] = i;
      observed += m.weight;
      acc += m.weight * i;
    }
    const coverage = totalWeight > 0 ? observed / totalWeight : 0;
    const q = observed > 0 ? coverage * (acc / observed) + (1 - coverage) * 0.5 : 0.5;
    out.set(mk.name, { q, coverage, indices });
  }
  return out;
}
