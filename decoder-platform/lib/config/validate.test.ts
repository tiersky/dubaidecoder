import { describe, it, expect } from 'vitest';
import { validateConfig } from './validate';
import { egyptMetrics, egyptMarkets } from '../model/fixtures/egypt-week6';

const good = {
  name: 'Egypt Decoder',
  slug: 'egypt',
  currency: 'USD',
  defaultBudget: 14000000,
  metrics: egyptMetrics,
  markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
};

describe('validateConfig', () => {
  it('accepts a well-formed config', () => {
    const r = validateConfig(good);
    expect(r.ok).toBe(true);
  });

  it('rejects bad slugs', () => {
    const r = validateConfig({ ...good, slug: 'Egypt Decoder!' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/slug/i);
  });

  it('rejects duplicate metric keys', () => {
    const r = validateConfig({ ...good, metrics: [...good.metrics, good.metrics[0]] });
    expect(r.ok).toBe(false);
  });

  it('rejects a market missing a metric value entry', () => {
    const markets = good.markets.map((m, i) =>
      i === 0 ? { ...m, values: { audienceRatio: 1 } } : m
    );
    const r = validateConfig({ ...good, markets });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/missing value/i);
  });

  it('rejects duplicate market names', () => {
    const markets = good.markets.map((m, i) => (i === 0 ? { ...m, name: good.markets[1].name } : m));
    const r = validateConfig({ ...good, markets });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/duplicate market names/i);
  });

  it('rejects fewer than 2 enabled markets', () => {
    const markets = good.markets.map((m, i) => ({ ...m, enabled: i === 0 }));
    const r = validateConfig({ ...good, markets });
    expect(r.ok).toBe(false);
  });

  it('rejects a metric keyed with a reserved axis key', () => {
    const metrics = good.metrics.map((m, i) => (i === 0 ? { ...m, key: 'score' } : m));
    const markets = good.markets.map((m) => ({
      ...m,
      values: { ...m.values, score: m.values.audienceRatio },
    }));
    const r = validateConfig({ ...good, metrics, markets });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/reserved/i);
  });
});
