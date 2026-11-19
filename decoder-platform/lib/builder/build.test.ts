import { describe, it, expect } from 'vitest';
import { buildConfig, emptyState, effectiveModel, mergeRecommendations, MAX_RECOMMENDATIONS, resolveValue, stateFromConfig, type BuilderState, type UniverseLookup } from './build';
import type { RecommendationItem } from '@/lib/config/types';
import { CATALOG, catalogById, canOptimise, metricFromCatalog } from './catalog';
import { validateConfig } from '@/lib/config/validate';
import { egyptMarkets, egyptMetrics } from '@/lib/model/fixtures/egypt-week6';

const facts = {
  gb: { name: 'UK', lat: 55.4, lng: -3.4, facts: { gdpPppPerHead: { value: 60000, year: 2026 }, population: { value: 68e6, year: 2024 } } },
  de: { name: 'Germany', lat: 51.2, lng: 10.5, facts: { gdpPppPerHead: { value: 70000, year: 2026 }, population: { value: 84e6, year: 2024 } } },
  fr: { name: 'France', lat: 46.2, lng: 2.2, facts: { population: { value: 68e6, year: 2024 } } },
};
const uni: UniverseLookup = { get: (iso2) => facts[iso2 as keyof typeof facts] };

function state(): BuilderState {
  const s = emptyState();
  s.slug = 'test-decoder';
  s.name = 'Test Decoder';
  s.destination = { iso2: 'ae', name: 'UAE', lat: 24, lng: 54 };
  s.markets = [
    { key: 'gb', name: 'UK', iso2: 'gb', lat: 55.4, lng: -3.4, origin: 'seed' },
    { key: 'de', name: 'Germany', iso2: 'de', lat: 51.2, lng: 10.5, origin: 'seed' },
    { key: 'fr', name: 'France', iso2: 'fr', lat: 46.2, lng: 2.2, origin: 'recommended' },
  ];
  s.metrics = ['audienceRatio', 'cpm', 'gdpPppPerHead', 'distance'].map((id) => metricFromCatalog(catalogById.get(id)!));
  s.values = {
    gb: { audienceRatio: 0.12, cpm: 9 },
    de: { audienceRatio: 0.1, cpm: 8 },
    fr: { audienceRatio: 0.09 },
  };
  s.priorities = { de: { priority: 1.5, reason: 'Sales office' } };
  return s;
}

describe('buildConfig', () => {
  it('fills public and distance values, keeps typed ones, and lists what is missing', () => {
    const { config, missing } = buildConfig(state(), uni);
    const uk = config.markets.find((m) => m.name === 'UK')!;
    expect(uk.values.gdpPppPerHead).toBe(60000);
    expect(uk.values.audienceRatio).toBe(0.12);
    expect(uk.values.distance).toBeGreaterThan(5000);
    expect(missing).toEqual([
      { market: 'France', metric: 'Media cost (CPM)' },
      { market: 'France', metric: 'GDP per head (PPP)' },
    ]);
    expect(config.model).toBe('optimised');
    expect(config.marketControls).toEqual({ Germany: { priority: 1.5, reason: 'Sales office' } });
    expect(config.planning?.population?.values.UK).toBe(68e6);
    expect(config.markets.find((m) => m.name === 'France')!.origin).toBe('recommended');
    expect(validateConfig(config).ok).toBe(true);
  });

  it('an override beats the public value', () => {
    const s = state();
    s.values.gb.gdpPppPerHead = 55000;
    const r = resolveValue(s, s.markets[0], s.metrics[2], uni);
    expect(r).toEqual({ value: 55000, source: 'override' });
  });

  it('falls back to score mode without audience and CPM', () => {
    const s = state();
    s.metrics = s.metrics.filter((m) => m.key !== 'cpm');
    expect(canOptimise(s.metrics)).toBe(false);
    expect(effectiveModel(s)).toBe('score');
  });
});

describe('stateFromConfig', () => {
  it('round-trips a guided config', () => {
    const first = buildConfig(state(), uni).config;
    const again = buildConfig(stateFromConfig(first), uni).config;
    expect(again).toEqual(first);
  });

  it('opens a workbook config: every metric becomes typed, values survive', () => {
    const wb = {
      name: 'Egypt',
      slug: 'egypt',
      currency: 'USD',
      defaultBudget: 1e6,
      metrics: egyptMetrics,
      markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
    };
    const s = stateFromConfig(wb);
    expect(s.markets[0].key).toBe('name:Russia');
    expect(s.metrics.every((m) => m.provider === 'manual')).toBe(true);
    const out = buildConfig(s, uni).config;
    for (const m of wb.markets) expect(out.markets.find((x) => x.name === m.name)!.values).toEqual(m.values);
  });

  it('keeps public values as saved when the live source has none', () => {
    const first = buildConfig(state(), uni).config;
    const s = stateFromConfig(first);
    const empty: UniverseLookup = { get: () => undefined };
    expect(resolveValue(s, s.markets[0], s.metrics[2], empty)).toEqual({ value: 60000, source: 'saved' });
  });
});

describe('catalog', () => {
  it('has unique ids that are not reserved keys', () => {
    const ids = CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of ['score', 'split', 'budget']) expect(ids).not.toContain(r);
  });
});

describe('previewAllocation', () => {
  it('spends the whole budget and honours the priority', async () => {
    const { previewAllocation } = await import('./build');
    const s = state();
    s.values.fr.cpm = 8.5;
    s.metrics = s.metrics.filter((m) => m.key !== 'gdpPppPerHead');
    const { config } = buildConfig(s, uni);
    const r = previewAllocation(config);
    expect(r.error).toBeUndefined();
    expect(r.rows.reduce((a, x) => a + x.budget, 0)).toBeCloseTo(config.defaultBudget, 0);
    const base = previewAllocation({ ...config, marketControls: undefined });
    const de = (x: typeof r) => x.rows.find((row) => row.name === 'Germany')!.budget;
    expect(de(r)).toBeGreaterThan(de(base));
  });
});

describe('review fixes: editing an existing version in the builder', () => {
  const wb = {
    name: 'Egypt',
    slug: 'egypt',
    currency: 'USD',
    defaultBudget: 1e6,
    metrics: egyptMetrics,
    markets: egyptMarkets.map((m, i) => ({ ...m, iso2: null, lat: null, lng: null, enabled: i !== 1 })),
    marketControls: { [egyptMarkets[0].name]: { lock: 200000, priority: 1.5, reason: 'Office' }, [egyptMarkets[2].name]: { min: 50000 } },
  };

  it('keeps switched-off markets, locks and bounds', () => {
    const out = buildConfig(stateFromConfig(wb), uni).config;
    expect(out.markets[1].enabled).toBe(false);
    expect(out.markets.filter((m) => !m.enabled)).toHaveLength(1);
    expect(out.marketControls?.[egyptMarkets[0].name]).toEqual({ lock: 200000, priority: 1.5, reason: 'Office' });
    expect(out.marketControls?.[egyptMarkets[2].name]).toEqual({ min: 50000 });
  });

  it('converts a legacy version the same way the dashboard does', async () => {
    const { upgradeLegacyConfig } = await import('@/lib/model/migrate');
    const out = buildConfig(stateFromConfig(wb), uni).config;
    const up = upgradeLegacyConfig(wb);
    expect(out.model).toBe('score');
    expect(out.metrics.map((m) => m.role)).toEqual(up.metrics.map((m) => m.role));
    expect(out.planning?.tierGamma).toBe(up.planning?.tierGamma);
  });

  it('changing a priority back to 1× keeps the lock', () => {
    const s = stateFromConfig(wb);
    s.priorities[s.markets[0].key] = { priority: 1, reason: '' };
    expect(buildConfig(s, uni).config.marketControls?.[egyptMarkets[0].name]).toEqual({ lock: 200000 });
  });
});

describe('mergeRecommendations', () => {
  const item = (iso2: string, status: RecommendationItem['status']): RecommendationItem => ({
    iso2, name: iso2, fit: 50, lookalike: 50, closestSeed: null, headline: 'h', reasons: ['r'], risks: [], status,
  });
  it('never exceeds the cap, keeps every inclusion and the newest exclusions', () => {
    const included = ['aa', 'ab', 'ac'].map((c) => item(c, 'included'));
    const excluded = Array.from({ length: 60 }, (_, i) => item(`x${i}`, 'excluded'));
    const fresh = Array.from({ length: 12 }, (_, i) => item(`f${i}`, 'suggested'));
    const out = mergeRecommendations([...included, ...excluded], fresh);
    expect(out).toHaveLength(MAX_RECOMMENDATIONS);
    expect(out.filter((i) => i.status === 'included')).toHaveLength(3);
    expect(out.filter((i) => i.status === 'suggested')).toHaveLength(12);
    expect(out.at(-1)!.iso2).toBe('x59');
    expect(new Set(out.map((i) => i.iso2)).size).toBe(out.length);
  });
});
