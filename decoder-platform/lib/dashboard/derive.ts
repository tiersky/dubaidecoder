import { MetricDef, computeModel } from '../model/score';
import { VersionConfig } from '../config/types';

export interface MarketVm {
  name: string;
  iso2: string | null;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
  indices: Record<string, number>;
  score: number;
  split: number;
}

export interface AxisOption {
  value: string;
  label: string;
}

export interface DashboardVm {
  name: string;
  slug: string;
  currency: string;
  defaultBudget: number;
  metrics: MetricDef[];
  markets: MarketVm[];
  defaultWeights: Record<string, number>;
  axisOptions: AxisOption[];
  bubbleOptions: AxisOption[];
  defaults: { xAxis: string; yAxis: string; bubbleSize: string };
}

export function deriveDashboard(config: VersionConfig): DashboardVm {
  const result = computeModel(
    config.markets.map((m) => ({ name: m.name, enabled: m.enabled, values: m.values })),
    config.metrics
  );
  const byName = new Map(result.markets.map((m) => [m.name, m]));
  const markets: MarketVm[] = config.markets.map((m) => {
    const r = byName.get(m.name)!;
    return {
      name: m.name,
      iso2: m.iso2,
      lat: m.lat,
      lng: m.lng,
      enabled: m.enabled,
      values: m.values,
      indices: r.indices,
      score: r.score,
      split: r.split,
    };
  });
  const metricOptions = config.metrics.map((m) => ({ value: m.key, label: m.label }));
  const firstLower = config.metrics.find((m) => m.direction === 'lower');
  return {
    name: config.name,
    slug: config.slug,
    currency: config.currency,
    defaultBudget: config.defaultBudget,
    metrics: config.metrics,
    markets,
    defaultWeights: Object.fromEntries(config.metrics.map((m) => [m.key, m.weight])),
    axisOptions: [
      ...metricOptions,
      { value: 'score', label: 'Weighted Score' },
      { value: 'split', label: '% Split' },
    ],
    bubbleOptions: [
      { value: 'budget', label: 'Budget Split' },
      { value: 'score', label: 'Weighted Score' },
      ...metricOptions,
    ],
    defaults: {
      xAxis: (firstLower ?? config.metrics[0]).key,
      yAxis: 'score',
      bubbleSize: 'budget',
    },
  };
}

export interface AllocationRow {
  name: string;
  iso2: string | null;
  score: number;
  split: number;
  budget: number;
  enabled: boolean;
}

export function computeAllocations(
  markets: MarketVm[],
  metrics: MetricDef[],
  weights: Record<string, number>,
  enabledNames: Set<string>,
  totalBudget: number
): AllocationRow[] {
  const weighted = metrics.map((m) => ({ ...m, weight: weights[m.key] ?? 0 }));
  const result = computeModel(
    markets.map((m) => ({ name: m.name, enabled: enabledNames.has(m.name), values: m.values })),
    weighted
  );
  const geo = new Map(markets.map((m) => [m.name, m.iso2]));
  return result.markets.map((m) => ({
    name: m.name,
    iso2: geo.get(m.name) ?? null,
    score: m.score,
    split: m.split,
    budget: m.split * totalBudget,
    enabled: m.enabled,
  }));
}
