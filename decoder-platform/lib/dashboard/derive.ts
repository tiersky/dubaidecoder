import { MetricDef } from '../model/score';
import { AllocationModel, FixedAllocation, MarketControl, PlanningSettings, VersionConfig } from '../config/types';
import { computeAllocation, type AllocationRow as ModelRow } from '../model/allocation';

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
  allocation?: FixedAllocation;
  industry?: string;
  model: AllocationModel;
  universe?: string[];
  marketControls?: Record<string, MarketControl>;
  planning?: PlanningSettings;
  concentration?: number;
}

export function deriveDashboard(config: VersionConfig): DashboardVm {
  const model = computeAllocation({
    model: config.model ?? 'workbook',
    metrics: config.metrics,
    markets: config.markets,
    budget: config.defaultBudget,
    funded: new Set(config.markets.filter((m) => m.enabled).map((m) => m.name)),
    ...(config.universe && { universe: new Set(config.universe) }),
    allocation: config.allocation,
    controls: config.marketControls,
    planning: config.planning,
    concentration: config.concentration,
  });
  const byName = new Map(model.rows.map((r) => [r.name, r]));
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
      split: r.share,
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
    ...(config.allocation ? { allocation: config.allocation } : {}),
    ...(config.context?.industry ? { industry: config.context.industry } : {}),
    model: config.model ?? 'workbook',
    ...(config.universe && { universe: config.universe }),
    ...(config.marketControls && { marketControls: config.marketControls }),
    ...(config.planning && { planning: config.planning }),
    ...(config.concentration !== undefined && { concentration: config.concentration }),
  };
}

export interface AllocationRow {
  name: string;
  iso2: string | null;
  score: number;
  split: number;
  budget: number;
  enabled: boolean;
  /** v2 detail: quality, coverage, priority, reach, saturation, marginal return, missing inputs. */
  detail: ModelRow;
}

/** Live allocation for the dashboard; every model goes through computeAllocation. */
export function computeAllocations(
  markets: MarketVm[],
  metrics: MetricDef[],
  weights: Record<string, number>,
  enabledNames: Set<string>,
  totalBudget: number,
  allocation?: FixedAllocation,
  v2: {
    model?: AllocationModel;
    universe?: string[];
    controls?: Record<string, MarketControl>;
    planning?: PlanningSettings;
    concentration?: number;
    population?: Record<string, number | null | undefined>;
  } = {}
): AllocationRow[] {
  const result = computeAllocation({
    model: v2.model ?? 'workbook',
    metrics: metrics.map((m) => ({ ...m, weight: weights[m.key] ?? 0 })),
    markets,
    budget: totalBudget,
    funded: enabledNames,
    ...(v2.universe && { universe: new Set(v2.universe) }),
    allocation,
    controls: v2.controls,
    planning: v2.planning,
    concentration: v2.concentration,
    population: v2.population,
  });
  const geo = new Map(markets.map((m) => [m.name, m.iso2]));
  return result.rows.map((r) => ({
    name: r.name,
    iso2: geo.get(r.name) ?? null,
    score: r.score,
    split: r.share,
    budget: r.budget,
    enabled: r.funded,
    detail: r,
  }));
}
