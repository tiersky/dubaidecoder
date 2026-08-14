import { normalCdf } from './normal';
import { sampleStats, type SampleStats } from './stats';

export type Direction = 'higher' | 'lower';

export interface MetricDef {
  key: string;
  label: string;
  weight: number;
  direction: Direction;
  source?: string;
  description?: string;
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
