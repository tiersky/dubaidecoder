import { normalCdf } from './normal';
import { sampleStats, type SampleStats } from './stats';

export type Direction = 'higher' | 'lower';

/** How a metric is measured; drives the transform in the v2 models. */
export type MetricKind = 'measure' | 'ratio' | 'score';
/** What a metric feeds in the v2 models beyond the quality score. */
export type MetricRole = 'audienceSize' | 'audienceRatio' | 'cpm' | 'priority';

export interface MetricDef {
  key: string;
  label: string;
  weight: number;
  direction: Direction;
  source?: string;
  description?: string;
  /** v2 only. Default 'measure'. */
  kind?: MetricKind;
  /** v2 only. Default 'none'. 'log' for heavy-tailed measures. */
  transform?: 'none' | 'log';
  /** v2 only; required for kind 'score': the fixed scale it is judged on. */
  scale?: { min: number; max: number };
  /** v2 only. A 'priority' metric (e.g. Market Tier) is human media expertise, not a factor. */
  role?: MetricRole;
  /** Where values come from: 'public:<factKey>', 'distance', or 'manual' (typed in). */
  provider?: string;
  /** Display unit for entry and tooltips, e.g. '%', 'USD', 'people'. */
  unit?: string;
}

export interface MarketInput {
  name: string;
  enabled: boolean;
  values: Record<string, number | null>;
}

export interface MarketResult {
  name: string;
  enabled: boolean;
  indices: Record<string, number>;
  score: number;
  split: number;
}

export interface ModelResult {
  stats: Record<string, SampleStats>;
  markets: MarketResult[];
}

/**
 * The decoder methodology: NORM.DIST indices over sample stats of the
 * enabled markets, weighted sum, splits normalized over enabled markets.
 */
export function computeModel(markets: MarketInput[], metrics: MetricDef[]): ModelResult {
  const enabled = markets.filter((m) => m.enabled);
  const stats: Record<string, SampleStats> = {};
  for (const metric of metrics) {
    stats[metric.key] = sampleStats(enabled.map((m) => m.values[metric.key] ?? null));
  }

  const scored = markets.map((m) => {
    const indices: Record<string, number> = {};
    let score = 0;
    for (const metric of metrics) {
      const { avg, stdev } = stats[metric.key];
      const x = m.values[metric.key] ?? 0;
      const phi = normalCdf(x, avg, stdev);
      const index = metric.direction === 'lower' ? 1 - phi : phi;
      indices[metric.key] = index;
      score += metric.weight * index;
    }
    return { name: m.name, enabled: m.enabled, indices, score };
  });

  const totalEnabledScore = scored
    .filter((m) => m.enabled)
    .reduce((a, m) => a + m.score, 0);

  return {
    stats,
    markets: scored.map((m) => ({
      ...m,
      split: m.enabled && totalEnabledScore > 0 ? m.score / totalEnabledScore : 0,
    })),
  };
}
