import { describe, it, expect } from 'vitest';
import { buildMarketContext, contextFingerprint } from './market-context';
import type { VersionConfig } from '../config/types';

const config: VersionConfig = {
  name: 'Test Decoder',
  slug: 'test',
  currency: 'USD',
  defaultBudget: 1_000_000,
  context: { industry: 'Real estate development', brief: 'Waterfront villas' },
  metrics: [
    { key: 'visitors', label: 'Visitors', weight: 60, direction: 'higher', source: 'UNWTO', description: 'Annual arrivals' },
    { key: 'cpm', label: 'Media CPM', weight: 40, direction: 'lower' },
  ],
  markets: [
    { name: 'Alpha', iso2: 'gb', lat: null, lng: null, enabled: true, values: { visitors: 900, cpm: 9 } },
    { name: 'Beta', iso2: 'de', lat: null, lng: null, enabled: true, values: { visitors: 500, cpm: 2 } },
    { name: 'Gamma', iso2: 'fr', lat: null, lng: null, enabled: true, values: { visitors: 100, cpm: 5 } },
    { name: 'Delta', iso2: null, lat: null, lng: null, enabled: false, values: { visitors: 50, cpm: null } },
  ],
};

describe('buildMarketContext', () => {
  it('returns null for an unknown market', () => {
    expect(buildMarketContext(config, 'Nowhere')).toBeNull();
  });

  it('summarizes the version, the market and its allocation', () => {
    const ctx = buildMarketContext(config, 'Alpha')!;
    expect(ctx.version).toMatchObject({
      name: 'Test Decoder',
      industry: 'Real estate development',
      brief: 'Waterfront villas',
      currency: 'USD',
      totalBudget: 1_000_000,
      marketCount: 4,
      activeMarketCount: 3,
      fixedSplit: false,
    });
    expect(ctx.market.name).toBe('Alpha');
    expect(ctx.market.funded).toBe(true);
    expect(ctx.market.budgetRank).toBeGreaterThanOrEqual(1);
    expect(ctx.market.budgetRank).toBeLessThanOrEqual(3);
    // sharePct is rounded to 2dp, so allow ±100 on a 1M budget.
    expect(Math.abs(ctx.market.budget - (ctx.market.sharePct / 100) * 1_000_000)).toBeLessThan(100);
  });

  it('ranks raw values against active peers and keeps metric metadata', () => {
    const ctx = buildMarketContext(config, 'Alpha')!;
    const visitors = ctx.metrics.find((m) => m.label === 'Visitors')!;
    expect(visitors).toMatchObject({ value: 900, rank: 1, of: 3, weightPct: 60, betterWhen: 'higher', source: 'UNWTO' });
    const cpm = ctx.metrics.find((m) => m.label === 'Media CPM')!;
    // Highest CPM of the three, and lower is better: weakest on this metric.
    expect(cpm.rank).toBe(3);
    expect(cpm.betterWhen).toBe('lower');
  });

  it('orders drivers by contribution and splits them into strengths and weaknesses', () => {
    const ctx = buildMarketContext(config, 'Alpha')!;
    expect(ctx.drivers.strengths[0]).toBe('Visitors');
    expect(ctx.drivers.weaknesses).toContain('Media CPM');
  });

  it('marks a disabled market as not funded', () => {
    const ctx = buildMarketContext(config, 'Delta')!;
    expect(ctx.market.funded).toBe(false);
    expect(ctx.market.budget).toBe(0);
    expect(ctx.market.budgetRank).toBeNull();
  });

  it('lists the top funded peers for comparison', () => {
    const ctx = buildMarketContext(config, 'Gamma')!;
    expect(ctx.peers.length).toBe(3);
    expect(ctx.peers[0].sharePct).toBeGreaterThanOrEqual(ctx.peers[1].sharePct);
  });
});

describe('contextFingerprint', () => {
  it('is stable for the same input and changes when the context changes', () => {
    const a = contextFingerprint(buildMarketContext(config, 'Alpha')!);
    const b = contextFingerprint(buildMarketContext(config, 'Alpha')!);
    const changed = contextFingerprint(
      buildMarketContext({ ...config, context: { industry: 'Hospitality' } }, 'Alpha')!
    );
    expect(a).toBe(b);
    expect(a).not.toBe(changed);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
