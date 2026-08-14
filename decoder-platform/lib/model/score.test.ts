import { describe, it, expect } from 'vitest';
import { computeModel } from './score';
import { egyptMetrics, egyptMarkets, egyptExpected } from './fixtures/egypt-week6';

describe('computeModel', () => {
  it('reproduces the verified Egypt week-6 model exactly', () => {
    const result = computeModel(egyptMarkets, egyptMetrics);
    expect(result.stats.visitors2025.avg).toBeCloseTo(780733.3333, 3);
    expect(result.stats.mediaCost.n).toBe(12); // nulls excluded
    expect(result.stats.marketTier.stdev).toBeCloseTo(12.1043, 3);
    for (const m of result.markets) {
      const exp = egyptExpected[m.name];
      expect(m.score, m.name).toBeCloseTo(exp.score, 3);
      expect(m.split, m.name).toBeCloseTo(exp.split, 5);
    }
    const totalSplit = result.markets.reduce((a, m) => a + m.split, 0);
    expect(totalSplit).toBeCloseTo(1, 9);
  });

  it('blank value in a lower-is-better metric scores near the top', () => {
    const result = computeModel(egyptMarkets, egyptMetrics);
    const czech = result.markets.find((m) => m.name === 'Czech Republic')!;
    expect(czech.indices.mediaCost).toBeCloseTo(0.986242, 4);
  });

  it('disabled markets are excluded from stats and splits but still scored', () => {
    const markets = egyptMarkets.map((m) =>
      m.name === 'Russia' ? { ...m, enabled: false } : m
    );
    const result = computeModel(markets, egyptMetrics);
    const russia = result.markets.find((m) => m.name === 'Russia')!;
    expect(russia.split).toBe(0);
    expect(russia.score).toBeGreaterThan(0);
    expect(result.stats.visitors2025.n).toBe(14); // Russia out of the stats
    const enabledSplit = result.markets.filter((m) => m.enabled).reduce((a, m) => a + m.split, 0);
    expect(enabledSplit).toBeCloseTo(1, 9);
  });

  it('zero total score yields zero splits, not NaN', () => {
    const metrics = egyptMetrics.map((m) => ({ ...m, weight: 0 }));
    const result = computeModel(egyptMarkets, metrics);
    for (const m of result.markets) expect(m.split).toBe(0);
  });
});
