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

describe('validateConfig — context (industry/brief for AI analysis)', () => {
  it('keeps an optional context with industry and brief', () => {
    const r = validateConfig({
      ...good,
      context: { industry: 'Tourism & destination marketing', brief: 'Leisure travel to Egypt.' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.context).toEqual({
      industry: 'Tourism & destination marketing',
      brief: 'Leisure travel to Egypt.',
    });
  });

  it('accepts configs without context (all existing versions)', () => {
    const r = validateConfig(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.context).toBeUndefined();
  });

  it('rejects an over-long brief', () => {
    const r = validateConfig({ ...good, context: { brief: 'x'.repeat(2001) } });
    expect(r.ok).toBe(false);
  });
});

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

describe('validateConfig allocation', () => {
  const base = {
    name: 'X', slug: 'x', currency: 'USD', defaultBudget: 100,
    metrics: [{ key: 'a', label: 'A', weight: 1, direction: 'higher' }],
    markets: ['P', 'Q'].map((name) => ({ name, iso2: null, lat: null, lng: null, enabled: true, values: { a: 1 } })),
  };

  it('accepts and keeps a complete allocation', () => {
    const r = validateConfig({ ...base, allocation: { fixed: { P: 10 }, shares: { Q: 1 } } });
    expect(r.ok && r.config.allocation).toEqual({ fixed: { P: 10 }, shares: { Q: 1 } });
  });

  it('rejects unknown, duplicated and missing markets', () => {
    const r = validateConfig({ ...base, allocation: { fixed: { P: 10, Z: 1 }, shares: { P: 1 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('allocation: unknown market "Z"');
      expect(r.errors).toContain('allocation: a market is listed in both fixed and shares');
      expect(r.errors).toContain('allocation: market "Q" has no fixed amount or share');
    }
  });
});

describe('validateConfig — allocation model v2 fields', () => {
  it('accepts a v2 config and keeps its settings', () => {
    const r = validateConfig({
      ...good,
      model: 'optimised',
      universe: ['Russia', 'Germany', 'Poland'],
      marketControls: { Germany: { priority: 1.5, reason: 'Sales office', min: 1000 } },
      planning: { frequency: 3, tierGamma: 0.13 },
      metrics: good.metrics.map((m) => (m.key === 'marketTier' ? { ...m, role: 'priority' } : m)),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.marketControls?.Germany.priority).toBe(1.5);
  });

  it('rejects a judgment score without a scale, duplicate roles, unknown names and min above max', () => {
    const r = validateConfig({
      ...good,
      universe: ['Atlantis'],
      marketControls: { Germany: { min: 10, max: 5 } },
      metrics: good.metrics.map((m) =>
        m.key === 'marketTier' ? { ...m, kind: 'score' } : m.key === 'mediaCost' || m.key === 'audienceRatio' ? { ...m, role: 'cpm' } : m
      ),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/needs a declared scale/);
      expect(r.errors.join('\n')).toMatch(/more than one "cpm"/);
      expect(r.errors.join('\n')).toMatch(/universe: unknown market "Atlantis"/);
      expect(r.errors.join('\n')).toMatch(/min is above max/);
    }
  });
});

describe('validateConfig — city markets with summer traffic', () => {
  const summer = {
    jets: {
      airports: ['LFMN Nice'],
      summerPer2Days: 118.5,
      offPer2Days: 60,
      uplift: 1.98,
      seasonArrivals: 7231,
      series: [{ label: '2025-06-06', value: 110 }, { label: '2025-06-20', value: 121 }],
      peak: '2025-07-18',
      captureRate: 0.97,
      gccShare: 0.016,
    },
    yachts: {
      sites: ['Monaco', 'Nice'],
      summerHoursPerMonth: 121061,
      offHoursPerMonth: 70000,
      uplift: 1.73,
      series: [{ label: '7', value: 130000 }],
      peakMonth: 7,
      year: 2023,
    },
    notes: ['Fri–Sat samples.'],
  };
  const city = (name: string, extra: object = {}) => ({
    ...good.markets[0],
    name,
    iso2: 'fr',
    lat: 43.7,
    lng: 7.27,
    place: { kind: 'city', country: 'France' },
    ...extra,
  });

  it('keeps place and summer through validation (unknown keys would be stripped)', () => {
    const r = validateConfig({ ...good, markets: [city('Nice', { summer }), city('Cannes'), ...good.markets.slice(2)] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nice = r.config.markets.find((m) => m.name === 'Nice')!;
    expect(nice.place).toEqual({ kind: 'city', country: 'France' });
    expect(nice.summer).toEqual(summer);
    expect(r.config.markets.find((m) => m.name === 'Cannes')!.summer).toBeUndefined();
  });

  it('rejects a malformed summer block', () => {
    const bad = { ...summer, yachts: { ...summer.yachts, peakMonth: 13 } };
    const r = validateConfig({ ...good, markets: [city('Nice', { summer: bad }), ...good.markets.slice(1)] });
    expect(r.ok).toBe(false);
  });
});

describe('validateConfig — GWI audiences and panels', () => {
  const gwi = {
    waves: ['q4_2025', 'q1_2026'],
    audiences: [
      {
        key: 'affluent',
        name: 'Affluent investors',
        expression: { and: [{ question: 'i7', datapoints: ['i7_1'] }, { or: [{ question: 'i5', datapoints: ['i5_3'] }] }] },
      },
    ],
    primaryAudience: 'affluent',
    panels: [{ key: 'vac', title: 'Vacations', question: 'q32203', datapoints: [{ code: 'q32203_4', label: 'Beach' }], audience: 'affluent' }],
    results: {
      fetchedAt: '2026-11-25T00:00:00Z',
      calls: 2,
      waves: ['q4_2025', 'q1_2026'],
      locations: { ae: { code: 's2_971', name: 'UAE' } },
      unsupported: ['mc'],
      sizes: { affluent: { ae: { size: 1797197, sample: 1371, universe: 9273204, share: 19.4 } } },
      panels: { vac: { ae: { q32203_4: { pct: 60.9, index: 106.7, sample: 1371 } } } },
    },
  };

  it('keeps nested expressions and stored results', () => {
    const r = validateConfig({ ...good, gwi });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.gwi).toEqual(gwi);
  });

  it('rejects a panel or primary audience pointing at an undefined audience', () => {
    const r = validateConfig({ ...good, gwi: { ...gwi, primaryAudience: 'nope', panels: [{ ...gwi.panels[0], audience: 'ghost' }] } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain('gwi: primary audience "nope" is not defined');
      expect(r.errors).toContain('gwi.panels.vac: unknown audience "ghost"');
    }
  });

  it('rejects an empty condition list', () => {
    expect(validateConfig({ ...good, gwi: { ...gwi, audiences: [{ ...gwi.audiences[0], expression: { and: [] } }] } }).ok).toBe(false);
  });
});
