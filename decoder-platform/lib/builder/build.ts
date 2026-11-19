/**
 * Guided builder state ⇄ VersionConfig. Pure: the server action and the
 * wizard's live preview both call buildConfig, so what the admin previews is
 * exactly what gets saved.
 */
import type { AllocationModel, MarketRow, RecommendationSet, VersionConfig, VersionContext } from '@/lib/config/types';
import type { FactKey, FactValue } from '@/lib/insights/facts';
import type { MetricDef } from '@/lib/model/score';
import { canOptimise } from './catalog';
import { computeAllocation } from '@/lib/model/allocation';

export interface BuilderMarket {
  /** iso2 when known, otherwise `name:<name>` (workbook markets without a pin). */
  key: string;
  name: string;
  iso2: string | null;
  lat: number | null;
  lng: number | null;
  origin: 'seed' | 'recommended';
}

export interface BuilderState {
  v: 1;
  mode: 'new' | 'edit';
  slug: string;
  name: string;
  currency: string;
  defaultBudget: number;
  markets: BuilderMarket[];
  destination: NonNullable<VersionContext['destination']> | null;
  industry: string;
  objective: string;
  brief: string;
  recommendations: RecommendationSet | null;
  metrics: MetricDef[];
  /** Typed values and overrides of public values, by market key then metric key. */
  values: Record<string, Record<string, number | null>>;
  /** Public values as last saved, used when the live source has none. */
  snapshot: Record<string, Record<string, number>>;
  priorities: Record<string, { priority: number; reason: string }>;
  model: AllocationModel;
  /** Settings carried over unchanged when editing an existing version. */
  extras: Pick<VersionConfig, 'allocation' | 'universe' | 'planning' | 'concentration'>;
}

export interface UniverseLookup {
  get(iso2: string): { facts: Partial<Record<FactKey, FactValue>>; lat: number; lng: number; name: string } | undefined;
}

export const marketKey = (m: { iso2: string | null; name: string }) => (m.iso2 ? m.iso2.toLowerCase() : `name:${m.name}`);

export function emptyState(): BuilderState {
  return {
    v: 1,
    mode: 'new',
    slug: '',
    name: '',
    currency: 'USD',
    defaultBudget: 1_000_000,
    markets: [],
    destination: null,
    industry: '',
    objective: '',
    brief: '',
    recommendations: null,
    metrics: [],
    values: {},
    snapshot: {},
    priorities: {},
    model: 'optimised',
    extras: {},
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ValueSource = 'typed' | 'override' | 'public' | 'saved' | 'missing';

export interface ResolvedValue {
  value: number | null;
  source: ValueSource;
  year?: number;
}

const isAuto = (m: MetricDef) => Boolean(m.provider && m.provider !== 'manual');

/** The value a market will carry for a metric, and where it comes from. */
export function resolveValue(state: BuilderState, market: BuilderMarket, metric: MetricDef, uni: UniverseLookup): ResolvedValue {
  const typed = state.values[market.key]?.[metric.key];
  if (!isAuto(metric)) {
    return typed === undefined || typed === null ? { value: null, source: 'missing' } : { value: typed, source: 'typed' };
  }
  if (typed !== undefined && typed !== null) return { value: typed, source: 'override' };
  if (metric.provider === 'distance') {
    if (state.destination && market.lat !== null && market.lng !== null) {
      return { value: Math.round(haversineKm({ lat: market.lat, lng: market.lng }, state.destination)), source: 'public' };
    }
  } else if (metric.provider?.startsWith('public:') && market.iso2) {
    const f = uni.get(market.iso2)?.facts[metric.provider.slice(7) as FactKey];
    if (f) return { value: f.value, source: 'public', year: f.year };
  }
  const saved = state.snapshot[market.key]?.[metric.key];
  return saved !== undefined ? { value: saved, source: 'saved' } : { value: null, source: 'missing' };
}

export interface BuildResult {
  config: VersionConfig;
  /** Inputs still empty: every one counts against coverage, and blocks optimisation for audience/CPM. */
  missing: Array<{ market: string; metric: string }>;
}

/** The model to use for these metrics: optimised needs audience and CPM. */
export function effectiveModel(state: Pick<BuilderState, 'model' | 'metrics'>): AllocationModel {
  if (state.model === 'optimised' && !canOptimise(state.metrics)) return 'score';
  return state.model;
}

export function buildConfig(state: BuilderState, uni: UniverseLookup): BuildResult {
  const missing: BuildResult['missing'] = [];
  const markets: MarketRow[] = state.markets.map((m) => {
    const values: Record<string, number | null> = {};
    for (const metric of state.metrics) {
      const r = resolveValue(state, m, metric, uni);
      values[metric.key] = r.value;
      if (r.value === null) missing.push({ market: m.name, metric: metric.label });
    }
    return { name: m.name, iso2: m.iso2, lat: m.lat, lng: m.lng, enabled: true, values, origin: m.origin };
  });

  const population: Record<string, number> = {};
  let popYear: number | undefined;
  for (const m of state.markets) {
    const p = m.iso2 ? uni.get(m.iso2)?.facts.population : undefined;
    if (p) {
      population[m.name] = p.value;
      popYear = Math.max(popYear ?? 0, p.year);
    } else if (state.extras.planning?.population?.values[m.name]) {
      population[m.name] = state.extras.planning.population.values[m.name];
    }
  }

  const controls: NonNullable<VersionConfig['marketControls']> = {};
  for (const m of state.markets) {
    const p = state.priorities[m.key];
    if (p && (p.priority !== 1 || p.reason.trim())) {
      controls[m.name] = { priority: p.priority, ...(p.reason.trim() && { reason: p.reason.trim() }) };
    }
  }

  const context: VersionContext = {
    ...(state.industry.trim() && { industry: state.industry.trim() }),
    ...(state.brief.trim() && { brief: state.brief.trim() }),
    ...(state.objective.trim() && { objective: state.objective.trim() }),
    ...(state.destination && { destination: state.destination }),
  };

  const names = new Set(state.markets.map((m) => m.name));
  const config: VersionConfig = {
    name: state.name.trim(),
    slug: state.slug.trim(),
    currency: state.currency,
    defaultBudget: state.defaultBudget,
    metrics: state.metrics,
    markets,
    model: effectiveModel(state),
    ...(state.extras.allocation && { allocation: state.extras.allocation }),
    ...(state.extras.universe && { universe: state.extras.universe.filter((n) => names.has(n)) }),
    ...(state.extras.concentration !== undefined && { concentration: state.extras.concentration }),
    planning: {
      ...state.extras.planning,
      frequency: state.extras.planning?.frequency ?? 3,
      ...(Object.keys(population).length && { population: { values: population, ...(popYear && { year: popYear }) } }),
    },
    ...(Object.keys(controls).length && { marketControls: controls }),
    ...(Object.keys(context).length && { context }),
    ...(state.recommendations && { recommendations: state.recommendations }),
  };
  return { config, missing };
}

/** Opens any saved version (guided or from a workbook) in the builder. */
export function stateFromConfig(config: VersionConfig): BuilderState {
  const markets: BuilderMarket[] = config.markets.map((m) => ({
    key: marketKey(m),
    name: m.name,
    iso2: m.iso2 ? m.iso2.toLowerCase() : null,
    lat: m.lat,
    lng: m.lng,
    origin: m.origin ?? 'seed',
  }));
  const metrics = config.metrics.map((m) => (m.provider ? m : { ...m, provider: 'manual' }));
  const values: BuilderState['values'] = {};
  const snapshot: BuilderState['snapshot'] = {};
  config.markets.forEach((m, i) => {
    const key = markets[i].key;
    for (const metric of metrics) {
      const v = m.values[metric.key];
      if (v === null || v === undefined) continue;
      if (isAuto(metric)) (snapshot[key] ??= {})[metric.key] = v;
      else (values[key] ??= {})[metric.key] = v;
    }
  });
  const priorities: BuilderState['priorities'] = {};
  for (const m of markets) {
    const c = config.marketControls?.[m.name];
    if (c?.priority !== undefined || c?.reason) priorities[m.key] = { priority: c.priority ?? 1, reason: c.reason ?? '' };
  }
  const { allocation, universe, planning, concentration } = config;
  return {
    v: 1,
    mode: 'edit',
    slug: config.slug,
    name: config.name,
    currency: config.currency,
    defaultBudget: config.defaultBudget,
    markets,
    destination: config.context?.destination ?? null,
    industry: config.context?.industry ?? '',
    objective: config.context?.objective ?? '',
    brief: config.context?.brief ?? '',
    recommendations: config.recommendations ?? null,
    metrics,
    values,
    snapshot,
    priorities,
    model: config.model ?? 'score',
    extras: {
      ...(allocation && { allocation }),
      ...(universe && { universe }),
      ...(planning && { planning }),
      ...(concentration !== undefined && { concentration }),
    },
  };
}

/** The allocation the saved config will produce at its default budget. */
export function previewAllocation(config: VersionConfig, budget = config.defaultBudget) {
  return computeAllocation({
    model: config.model ?? 'score',
    metrics: config.metrics,
    markets: config.markets,
    budget,
    funded: new Set(config.markets.filter((m) => m.enabled).map((m) => m.name)),
    ...(config.universe && { universe: new Set(config.universe) }),
    ...(config.allocation && { allocation: config.allocation }),
    ...(config.marketControls && { controls: config.marketControls }),
    ...(config.planning && { planning: config.planning }),
    ...(config.concentration !== undefined && { concentration: config.concentration }),
  });
}
