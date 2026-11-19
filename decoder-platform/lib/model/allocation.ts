import type { AllocationModel, FixedAllocation, MarketControl, MarketRow, PlanningSettings } from '../config/types';
import { applyFixedAllocation } from './allocate';
import { computeQuality, median } from './quality';
import { computeModel, type MetricDef } from './score';
import {
  InfeasibleBudgetError,
  marginalValue,
  reach,
  saturationScale,
  solveProportional,
  solveResponse,
  type Bounds,
  type ResponseMarket,
} from './solve';

export const DEFAULT_FREQUENCY = 3;
export const MIN_UNIVERSE = 8;

export interface AllocationRequest {
  model: AllocationModel;
  metrics: MetricDef[];
  markets: Pick<MarketRow, 'name' | 'values'>[];
  budget: number;
  /** Markets that receive budget. In v2 models they must also be in the universe. */
  funded: Set<string>;
  /** Allocation universe for the statistics (v2 models). Default: every market. */
  universe?: Set<string>;
  /** Workbook-only fixed split; in v2 models its fixed amounts become locks. */
  allocation?: FixedAllocation;
  controls?: Record<string, MarketControl>;
  planning?: PlanningSettings;
  concentration?: number;
  /** Population by market name, for audience = population × audience ratio. */
  population?: Record<string, number | null | undefined>;
}

export interface AllocationRow {
  name: string;
  inUniverse: boolean;
  funded: boolean;
  /** Workbook: weighted score. v2: q × priority. */
  score: number;
  /** v2 data-only quality in [0, 1]; workbook: score / Σweights. */
  quality: number;
  coverage: number;
  indices: Record<string, number>;
  priority: number;
  budget: number;
  share: number;
  /** Optimised model only. */
  audience?: number;
  cpm?: number;
  reach?: number;
  saturation?: number;
  marginal?: number;
  /** Inputs this market needs before the model can fund it. */
  missing: string[];
  locked: boolean;
}

export interface AllocationResult {
  model: AllocationModel;
  rows: AllocationRow[];
  warnings: string[];
  /** Set when the budget can't be met (e.g. minimums above it); rows then carry 0. */
  error?: string;
  /** Optimised model: Σ q·h·reach. */
  totalValue?: number;
}

const roleMetric = (metrics: MetricDef[], role: MetricDef['role']) => metrics.find((m) => m.role === role);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One entry point for every allocation model. Pure and deterministic. */
export function computeAllocation(req: AllocationRequest): AllocationResult {
  return req.model === 'workbook' ? workbook(req) : v2(req);
}

/* ── Workbook: exact Excel parity (today's maths, unchanged) ─────────────── */

function workbook(req: AllocationRequest): AllocationResult {
  const result = computeModel(
    req.markets.map((m) => ({ name: m.name, enabled: req.funded.has(m.name), values: m.values })),
    req.metrics
  );
  const fixed = req.allocation ? applyFixedAllocation(req.allocation, req.funded, req.budget) : null;
  const totalWeight = req.metrics.reduce((a, m) => a + m.weight, 0);
  return {
    model: 'workbook',
    warnings: [],
    rows: result.markets.map((m) => {
      const budget = fixed ? (m.enabled ? (fixed.get(m.name) ?? 0) : 0) : m.split * req.budget;
      return {
        name: m.name,
        inUniverse: true,
        funded: m.enabled,
        score: m.score,
        quality: totalWeight > 0 ? m.score / totalWeight : 0,
        coverage: 1,
        indices: m.indices,
        priority: 1,
        budget,
        share: req.budget > 0 ? budget / req.budget : 0,
        missing: [],
        locked: Boolean(fixed && req.allocation?.fixed[m.name] !== undefined),
      };
    }),
  };
}

/* ── v2: score and optimised ─────────────────────────────────────────────── */

function v2(req: AllocationRequest): AllocationResult {
  const warnings: string[] = [];
  const universe = req.universe ?? new Set(req.markets.map((m) => m.name));
  const inUniverse = req.markets.filter((m) => universe.has(m.name));
  if (inUniverse.length < MIN_UNIVERSE) {
    warnings.push(`The allocation universe has ${inUniverse.length} markets; below ${MIN_UNIVERSE} the statistics get noisy.`);
  }
  if (req.allocation && Object.keys(req.allocation.shares).length > 0) {
    warnings.push('Workbook fixed shares apply only in workbook mode; fixed amounts are kept as locks.');
  }

  const quality = computeQuality(req.markets, inUniverse, req.metrics, { curveRoles: req.model === 'optimised' });
  const priorities = priorityFor(req);
  const funded = req.markets.filter((m) => universe.has(m.name) && req.funded.has(m.name));

  const lockOf = (name: string): number | undefined => req.controls?.[name]?.lock ?? req.allocation?.fixed[name];
  const boundsOf = (name: string): Bounds => {
    const lock = lockOf(name);
    if (lock !== undefined) return { min: lock, max: lock };
    const c = req.controls?.[name];
    return { min: c?.min ?? 0, max: c?.max ?? Infinity };
  };

  const rows = new Map<string, AllocationRow>(
    req.markets.map((m) => {
      const qr = quality.get(m.name)!;
      const h = priorities.get(m.name) ?? 1;
      return [
        m.name,
        {
          name: m.name,
          inUniverse: universe.has(m.name),
          funded: false,
          score: qr.q * h,
          quality: qr.q,
          coverage: qr.coverage,
          indices: qr.indices,
          priority: h,
          budget: 0,
          share: 0,
          missing: [],
          locked: lockOf(m.name) !== undefined,
        },
      ];
    })
  );

  let result: AllocationResult;
  try {
    result =
      req.model === 'optimised'
        ? optimised(req, funded, rows, boundsOf, warnings)
        : scored(req, funded, rows, boundsOf, warnings);
  } catch (err) {
    if (!(err instanceof InfeasibleBudgetError)) throw err;
    result = { model: req.model, rows: [...rows.values()], warnings, error: err.message };
  }
  return result;
}

function scored(
  req: AllocationRequest,
  funded: AllocationRequest['markets'],
  rows: Map<string, AllocationRow>,
  boundsOf: (n: string) => Bounds,
  warnings: string[]
): AllocationResult {
  const p = req.concentration ?? 1;
  const weights = funded.map((m) => Math.pow(rows.get(m.name)!.score, p));
  const spends = solveProportional(weights, funded.map((m) => boundsOf(m.name)), req.budget);
  funded.forEach((m, i) => {
    const r = rows.get(m.name)!;
    r.funded = true;
    r.budget = spends[i];
    r.share = req.budget > 0 ? spends[i] / req.budget : 0;
  });
  return { model: 'score', rows: [...rows.values()], warnings };
}

function optimised(
  req: AllocationRequest,
  funded: AllocationRequest['markets'],
  rows: Map<string, AllocationRow>,
  boundsOf: (n: string) => Bounds,
  warnings: string[]
): AllocationResult {
  const sizeMetric = roleMetric(req.metrics, 'audienceSize');
  const ratioMetric = roleMetric(req.metrics, 'audienceRatio');
  const cpmMetric = roleMetric(req.metrics, 'cpm');
  const rate = req.planning?.cpmToBudgetRate ?? 1;

  const ready: { m: AllocationRequest['markets'][number]; rm: ResponseMarket }[] = [];
  const lockedOnly: string[] = [];
  for (const m of funded) {
    const r = rows.get(m.name)!;
    const size = sizeMetric ? num(m.values[sizeMetric.key]) : null;
    const ratio = ratioMetric ? num(m.values[ratioMetric.key]) : null;
    const pop = num(req.population?.[m.name]);
    const audience = size ?? (ratio !== null && pop !== null ? ratio * pop : null);
    const cpmRaw = cpmMetric ? num(m.values[cpmMetric.key]) : null;
    const cpm = cpmRaw !== null ? cpmRaw * rate : null;
    if (!(audience && audience > 0)) r.missing.push(sizeMetric ? sizeMetric.label : ratioMetric ? `${ratioMetric.label} or population` : 'audience size');
    if (!(cpm && cpm > 0)) r.missing.push(cpmMetric ? cpmMetric.label : 'CPM');
    if (r.missing.length) {
      if (r.locked) lockedOnly.push(m.name);
      continue;
    }
    r.audience = audience!;
    r.cpm = cpm!;
    const frequency = req.planning?.perMarketFrequency?.[m.name] ?? req.planning?.frequency ?? DEFAULT_FREQUENCY;
    ready.push({ m, rm: { value: r.score, audience: audience!, cpm: cpm!, frequency } });
  }
  const skipped = funded.filter((m) => rows.get(m.name)!.missing.length && !rows.get(m.name)!.locked);
  if (skipped.length) {
    warnings.push(`${skipped.map((m) => m.name).join(', ')} can't be optimised until audience and CPM are filled; ${skipped.length === 1 ? 'it gets' : 'they get'} no budget.`);
  }

  // Locked markets without curve inputs still take their amount off the top.
  const lockedSpend = lockedOnly.reduce((a, n) => a + boundsOf(n).min, 0);
  for (const n of lockedOnly) {
    const r = rows.get(n)!;
    r.funded = true;
    r.budget = boundsOf(n).min;
  }
  if (!ready.length) {
    if (lockedSpend > req.budget + 1e-6) throw new InfeasibleBudgetError('Locked amounts add up to more than the budget.', lockedSpend - req.budget);
    return finish(req, rows, warnings, 0, lockedSpend < req.budget ? 'No market has the audience and CPM needed to optimise.' : undefined);
  }

  const spends = solveResponse(ready.map((x) => x.rm), ready.map((x) => boundsOf(x.m.name)), req.budget - lockedSpend);
  let totalValue = 0;
  ready.forEach(({ m, rm }, i) => {
    const r = rows.get(m.name)!;
    const s = spends[i];
    r.funded = true;
    r.budget = s;
    r.reach = reach(rm, s);
    r.saturation = 1 - Math.exp(-s / saturationScale(rm));
    r.marginal = marginalValue(rm, s);
    totalValue += rm.value * r.reach;
  });
  return finish(req, rows, warnings, totalValue);
}

function finish(req: AllocationRequest, rows: Map<string, AllocationRow>, warnings: string[], totalValue: number, error?: string): AllocationResult {
  for (const r of rows.values()) r.share = req.budget > 0 ? r.budget / req.budget : 0;
  return { model: req.model, rows: [...rows.values()], warnings, totalValue, ...(error && { error }) };
}

/* ── Media expertise ─────────────────────────────────────────────────────── */

/**
 * Priority hᵢ per market: an explicit control wins; otherwise a priority
 * metric (Market Tier) converted as (tier / median tier)^γ. A uniform scale on
 * h cancels out of both v2 models, so the median adds no universe drift.
 */
function priorityFor(req: AllocationRequest): Map<string, number> {
  const out = new Map<string, number>();
  const tierMetric = roleMetric(req.metrics, 'priority');
  const gamma = req.planning?.tierGamma ?? TIER_GAMMA_DEFAULT;
  const tiers = tierMetric
    ? req.markets.map((m) => num(m.values[tierMetric.key])).filter((v): v is number => v !== null && v > 0).sort((a, b) => a - b)
    : [];
  const medTier = median(tiers);
  for (const m of req.markets) {
    const explicit = req.controls?.[m.name]?.priority;
    if (explicit !== undefined) {
      out.set(m.name, explicit);
      continue;
    }
    const t = tierMetric ? num(m.values[tierMetric.key]) : null;
    out.set(m.name, t !== null && t > 0 && medTier > 0 ? Math.pow(t / medTier, gamma) : 1);
  }
  return out;
}

/** Fallback until a version's γ is fitted against its old budgets (see migrate-tier.ts). */
export const TIER_GAMMA_DEFAULT = 0.12;
