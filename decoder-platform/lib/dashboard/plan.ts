/**
 * The user's working plan on a dashboard: total budget, metric weights and
 * which markets are in the allocation. One plan feeds every tab and country
 * page, so excluding a market or moving the budget reads the same everywhere.
 */
import type { AllocationRequest } from '@/lib/model/allocation';
import { statsUniverse, type DashboardVm } from './derive';

export interface Plan {
  budget: number;
  weights: Record<string, number>;
  /** Custom weights switched on in the Budget tab. */
  weightsOn: boolean;
  enabled: Set<string>;
}

type PlanVm = Pick<DashboardVm, 'defaultBudget' | 'defaultWeights' | 'markets'>;

export function defaultPlan(vm: PlanVm): Plan {
  return {
    budget: vm.defaultBudget,
    weights: { ...vm.defaultWeights },
    weightsOn: false,
    enabled: new Set(vm.markets.filter((m) => m.enabled).map((m) => m.name)),
  };
}

/** Storage form: plain JSON. */
export interface StoredPlan {
  budget: number;
  weights: Record<string, number>;
  weightsOn: boolean;
  enabled: string[];
}

export const toStored = (p: Plan): StoredPlan => ({ ...p, enabled: [...p.enabled] });

/**
 * A stored plan checked against the decoder as it is now: unknown markets and
 * metrics are dropped and anything malformed falls back to the default, so a
 * republished decoder never inherits a broken plan.
 */
export function restorePlan(raw: unknown, vm: PlanVm): Plan {
  const base = defaultPlan(vm);
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<StoredPlan>;
  const names = new Set(vm.markets.map((m) => m.name));
  const okNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const weightsOn = s.weightsOn === true;
  const weights = { ...base.weights };
  if (weightsOn && s.weights && typeof s.weights === 'object') {
    for (const k of Object.keys(weights)) if (okNum(s.weights[k])) weights[k] = s.weights[k];
  }
  return {
    budget: okNum(s.budget) && s.budget > 0 ? s.budget : base.budget,
    weights,
    weightsOn,
    enabled: Array.isArray(s.enabled) ? new Set(s.enabled.filter((n) => typeof n === 'string' && names.has(n))) : base.enabled,
  };
}

/** The allocation request for a plan: the one source for every view's numbers. */
export function planRequest(
  vm: Pick<DashboardVm, 'model' | 'metrics' | 'markets' | 'universe' | 'allocation' | 'marketControls' | 'planning' | 'concentration'>,
  plan: Plan
): AllocationRequest {
  return {
    model: vm.model,
    metrics: vm.metrics.map((m) => ({ ...m, weight: plan.weights[m.key] ?? 0 })),
    markets: vm.markets,
    budget: plan.budget,
    funded: plan.enabled,
    universe: statsUniverse(vm.markets.map((m) => m.name), vm.universe, plan.enabled),
    allocation: vm.allocation,
    controls: vm.marketControls,
    planning: vm.planning,
    concentration: vm.concentration,
  };
}
