import { describe, expect, it } from 'vitest';
import { defaultPlan, planRequest, restorePlan, toStored } from './plan';
import type { DashboardVm } from './derive';

const vm = {
  defaultBudget: 1000,
  defaultWeights: { a: 60, b: 40 },
  markets: [
    { name: 'X', enabled: true },
    { name: 'Y', enabled: true },
    { name: 'Z', enabled: false },
  ],
  model: 'score',
  metrics: [
    { key: 'a', label: 'A', weight: 60, direction: 'higher' },
    { key: 'b', label: 'B', weight: 40, direction: 'higher' },
  ],
} as unknown as DashboardVm;

describe('plan', () => {
  it('defaults to the decoder’s enabled markets, budget and weights', () => {
    const p = defaultPlan(vm);
    expect([...p.enabled]).toEqual(['X', 'Y']);
    expect(p.budget).toBe(1000);
    expect(p.weightsOn).toBe(false);
  });

  it('round-trips through storage', () => {
    const p = { ...defaultPlan(vm), budget: 5000, weightsOn: true, weights: { a: 10, b: 90 }, enabled: new Set(['Y', 'Z']) };
    expect(restorePlan(JSON.parse(JSON.stringify(toStored(p))), vm)).toEqual(p);
  });

  it('drops markets and metrics the decoder no longer has, and rejects bad values', () => {
    const p = restorePlan({ budget: -5, weightsOn: true, weights: { a: 'x', b: 70, gone: 5 }, enabled: ['X', 'Gone', 3] }, vm);
    expect(p.budget).toBe(1000);
    expect(p.weights).toEqual({ a: 60, b: 70 });
    expect([...p.enabled]).toEqual(['X']);
  });

  it('ignores stored weights while custom weights are off, and garbage entirely', () => {
    expect(restorePlan({ weightsOn: false, weights: { a: 1, b: 1 } }, vm).weights).toEqual({ a: 60, b: 40 });
    expect(restorePlan('nope', vm)).toEqual(defaultPlan(vm));
    expect(restorePlan(null, vm)).toEqual(defaultPlan(vm));
  });

  it('builds one request: plan weights, budget, funded set and the matching universe', () => {
    const r = planRequest(vm, { budget: 7, weights: { a: 1, b: 2 }, weightsOn: true, enabled: new Set(['Y']) });
    expect(r.metrics.map((m) => m.weight)).toEqual([1, 2]);
    expect(r.budget).toBe(7);
    expect([...r.funded]).toEqual(['Y']);
    expect([...r.universe!]).toEqual(['Y']);
  });
});
