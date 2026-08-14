import { describe, it, expect } from 'vitest';
import { deriveDashboard, computeAllocations } from './derive';
import { egyptMetrics, egyptMarkets, egyptExpected } from '../model/fixtures/egypt-week6';
import type { VersionConfig } from '../config/types';

const config: VersionConfig = {
  name: 'Egypt Decoder',
  slug: 'egypt',
  currency: 'USD',
  defaultBudget: 14000000,
  metrics: egyptMetrics,
  markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
};

describe('deriveDashboard', () => {
  const vm = deriveDashboard(config);

  it('computes scores and splits at runtime matching the verified oracle', () => {
    const germany = vm.markets.find((m) => m.name === 'Germany')!;
    expect(germany.score).toBeCloseTo(egyptExpected.Germany.score, 3);
    expect(germany.split).toBeCloseTo(egyptExpected.Germany.split, 5);
  });

  it('builds axis options from metrics plus computed fields', () => {
    expect(vm.axisOptions.map((o) => o.value)).toContain('score');
    expect(vm.axisOptions.map((o) => o.value)).toContain('mediaCost');
    expect(vm.bubbleOptions[0].value).toBe('budget');
  });

  it('defaults xAxis to the first lower-direction metric', () => {
    expect(vm.defaults).toEqual({ xAxis: 'mediaCost', yAxis: 'score', bubbleSize: 'budget' });
  });

  it('carries default weights from metric definitions', () => {
    expect(vm.defaultWeights.marketTier).toBe(50);
    expect(vm.defaultWeights.yoyGrowth).toBe(0);
  });
});

describe('computeAllocations', () => {
  const vm = deriveDashboard(config);
  const allNames = new Set(vm.markets.map((m) => m.name));

  it('prices budgets from splits', () => {
    const rows = computeAllocations(vm.markets, vm.metrics, vm.defaultWeights, allNames, 14000000);
    const total = rows.reduce((a, r) => a + r.budget, 0);
    expect(total).toBeCloseTo(14000000, 4);
    const germany = rows.find((r) => r.name === 'Germany')!;
    expect(germany.budget).toBeCloseTo(egyptExpected.Germany.split * 14000000, 2);
  });

  it('renormalizes when a market is excluded', () => {
    const without = new Set([...allNames].filter((n) => n !== 'Germany'));
    const rows = computeAllocations(vm.markets, vm.metrics, vm.defaultWeights, without, 14000000);
    expect(rows.find((r) => r.name === 'Germany')!.budget).toBe(0);
    const total = rows.reduce((a, r) => a + r.budget, 0);
    expect(total).toBeCloseTo(14000000, 4);
  });

  it('zero weights yield zero splits, not NaN', () => {
    const zero = Object.fromEntries(vm.metrics.map((m) => [m.key, 0]));
    const rows = computeAllocations(vm.markets, vm.metrics, zero, allNames, 14000000);
    expect(rows.every((r) => r.budget === 0)).toBe(true);
  });
});
