import type { FixedAllocation, MarketRow, VersionConfig } from '../config/types';
import { computeAllocation } from './allocation';
import type { MetricDef } from './score';

type Markets = Pick<MarketRow, 'name' | 'values' | 'enabled'>[];

const values = (markets: Markets, key: string) =>
  markets.map((m) => m.values[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

/** Sample skewness (adjusted Fisher–Pearson); 0 when undefined. */
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const m2 = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const m3 = xs.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
  if (m2 === 0) return 0;
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / m2 ** 1.5);
}

/**
 * Proposes v2 settings for each metric from its label and values: which
 * column is the media-expertise tier, CPM or audience, and which measures are
 * heavy-tailed enough for a log scale. The admin confirms in the wizard.
 * Settings the metric already has are kept.
 */
export function suggestMetricSettings(metrics: MetricDef[], markets: Markets): MetricDef[] {
  const taken = new Set(metrics.map((m) => m.role).filter(Boolean));
  const claim = (role: NonNullable<MetricDef['role']>, test: boolean) => {
    if (!test || taken.has(role)) return undefined;
    taken.add(role);
    return role;
  };
  return metrics.map((m) => {
    const label = m.label.toLowerCase();
    const xs = values(markets, m.key);
    const role =
      m.role ??
      claim('priority', /\btier\b|priority/.test(label)) ??
      claim('cpm', /\bcpm\b|media cost/.test(label)) ??
      claim('audienceSize', /audience size|addressable/.test(label)) ??
      claim('audienceRatio', /audience/.test(label) && (/ratio|share|%|pop/.test(label) || xs.every((x) => x >= 0 && x <= 1)));
    const isRatio = xs.length > 0 && xs.every((x) => x >= 0 && x <= 1);
    const kind = m.kind ?? (isRatio ? 'ratio' : 'measure');
    const transform =
      m.transform ?? (kind === 'measure' && xs.length > 0 && xs.every((x) => x > 0) && skewness(xs) > 1 ? 'log' : 'none');
    return { ...m, kind, transform, ...(role && { role }) };
  });
}

export interface TierFit {
  gamma: number;
  /** RMS share error vs the old budgets, in share units (0.0051 = 0.51 points). */
  rms: number;
  /** Same error with tier ignored (γ = 0), for comparison. */
  rmsWithoutTier: number;
}

/**
 * Fits γ in h = (tier / median tier)^γ so the v2 score model reproduces the
 * version's current (workbook) budgets as closely as possible. Uses the
 * version's own enabled markets, independent of any dashboard toggles.
 */
export function fitTierGamma(input: {
  metrics: MetricDef[];
  v2Metrics: MetricDef[];
  markets: Markets;
  budget: number;
  allocation?: FixedAllocation;
}): TierFit | null {
  if (!input.v2Metrics.some((m) => m.role === 'priority')) return null;
  const funded = new Set(input.markets.filter((m) => m.enabled).map((m) => m.name));
  const old = computeAllocation({
    model: 'workbook',
    metrics: input.metrics,
    markets: input.markets,
    budget: input.budget,
    funded,
    allocation: input.allocation,
  });
  const target = new Map(old.rows.map((r) => [r.name, r.share]));
  const err = (gamma: number) => {
    const r = computeAllocation({
      model: 'score',
      metrics: input.v2Metrics,
      markets: input.markets,
      budget: input.budget,
      funded,
      planning: { tierGamma: gamma },
    });
    const sq = r.rows.filter((x) => funded.has(x.name)).map((x) => (x.share - (target.get(x.name) ?? 0)) ** 2);
    return Math.sqrt(sq.reduce((a, b) => a + b, 0) / Math.max(1, sq.length));
  };
  let best = { gamma: 0, rms: err(0) };
  const rmsWithoutTier = best.rms;
  for (let g = 0.01; g <= 2.0001; g += 0.01) {
    const e = err(g);
    if (e < best.rms) best = { gamma: Math.round(g * 100) / 100, rms: e };
  }
  return { ...best, rmsWithoutTier };
}

/**
 * Moves a version with no model set (every workbook upload so far) onto the
 * v2 score model: suggested metric settings, and γ fitted so budgets stay
 * close to the workbook's. A version that names its model is left alone.
 * Memoised per config object: the fit runs ~200 allocations.
 */
export function upgradeLegacyConfig(config: VersionConfig): VersionConfig {
  if (config.model) return config;
  // A workbook fixed split (amounts or shares) has no v2 equivalent: keep the workbook formula.
  if (config.allocation && (Object.keys(config.allocation.fixed).length || Object.keys(config.allocation.shares).length)) {
    return { ...config, model: 'workbook' };
  }
  const v2Metrics = suggestMetricSettings(config.metrics, config.markets);
  const fit = cachedFit(config, v2Metrics);
  return {
    ...config,
    model: 'score',
    metrics: v2Metrics,
    planning: { ...config.planning, ...(fit && config.planning?.tierGamma === undefined && { tierGamma: fit.gamma }) },
  };
}

// The γ fit runs ~200 allocations; dashboards re-derive on every request, so
// remember recent fits by their inputs (results are plain numbers: safe to share).
const fitCache = new Map<string, TierFit | null>();

function cachedFit(config: VersionConfig, v2Metrics: MetricDef[]): TierFit | null {
  const key = JSON.stringify([config.metrics, config.markets, config.defaultBudget]);
  if (fitCache.has(key)) return fitCache.get(key)!;
  const fit = fitTierGamma({ metrics: config.metrics, v2Metrics, markets: config.markets, budget: config.defaultBudget });
  fitCache.set(key, fit);
  if (fitCache.size > 50) fitCache.delete(fitCache.keys().next().value!);
  return fit;
}

/**
 * The config with an admin-chosen model. Leaving an unset (legacy) model for
 * v2 adopts the suggested metric settings and fitted tier strength first;
 * choosing 'workbook' on a legacy version pins it so it stops being upgraded.
 */
export function withModel(config: VersionConfig, model: NonNullable<VersionConfig['model']>): VersionConfig {
  if (model === config.model) return config;
  const base = !config.model && model !== 'workbook' ? upgradeLegacyConfig(config) : config;
  return { ...base, model };
}
