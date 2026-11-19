import { describe, it, expect } from 'vitest';
import { simulateAllocation, nextIncrement } from './uncertainty';
import { egyptMarkets, egyptMetrics } from './fixtures/egypt-week6';
import { suggestMetricSettings } from './migrate';
import type { AllocationRequest } from './allocation';

const metrics = suggestMetricSettings(egyptMetrics, egyptMarkets);
const req: AllocationRequest = {
  model: 'score',
  metrics,
  markets: egyptMarkets,
  budget: 14_000_000,
  funded: new Set(egyptMarkets.map((m) => m.name)),
};

describe('simulateAllocation', () => {
  const u = simulateAllocation(req, 120);

  it('is deterministic and brackets every budget', () => {
    expect(simulateAllocation(req, 120)).toEqual(u);
    expect(u.draws).toBe(120);
    for (const r of Object.values(u.ranges)) {
      expect(r.p10).toBeLessThanOrEqual(r.p50);
      expect(r.p50).toBeLessThanOrEqual(r.p90);
      expect(r.rankStability).toBeGreaterThanOrEqual(0);
      expect(r.rankStability).toBeLessThanOrEqual(1);
    }
  });

  it('the median simulated plan stays near the base plan', () => {
    const p50s = Object.values(u.ranges).reduce((a, r) => a + r.p50, 0);
    expect(p50s / req.budget).toBeGreaterThan(0.95);
    expect(p50s / req.budget).toBeLessThan(1.05);
  });

  it('noisier inputs give wider ranges', () => {
    const typed = simulateAllocation({ ...req, metrics: metrics.map((m) => ({ ...m, provider: 'manual' })) }, 120);
    const pub = simulateAllocation({ ...req, metrics: metrics.map((m) => ({ ...m, provider: 'public:gdpPerHead' })) }, 120);
    const width = (x: typeof u) => Object.values(x.ranges).reduce((a, r) => a + (r.p90 - r.p10), 0);
    expect(width(typed)).toBeGreaterThan(width(pub));
  });
});

describe('nextIncrement', () => {
  it('spreads the extra budget exactly', () => {
    const inc = nextIncrement(req, 100_000);
    expect(inc.reduce((a, r) => a + r.extra, 0)).toBeCloseTo(100_000, -1);
    expect(inc[0].extra).toBeGreaterThanOrEqual(inc.at(-1)!.extra);
  });
});
