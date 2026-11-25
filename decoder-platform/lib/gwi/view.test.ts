import { describe, expect, it } from 'vitest';
import { compactPeople, gwiMarketView, waveSpan } from './view';
import type { GwiConfig } from './types';

const size = (s: number, sample: number) => ({ size: s, sample, universe: s * 10, share: 10 });
const cell = (pct: number, sample: number, index = 100) => ({ pct, index, sample });

const GWI: GwiConfig = {
  waves: ['q1_2026', 'q4_2025'],
  audiences: [
    { key: 'a', name: 'Affluent investors', description: 'proxy', expression: { and: [{ question: 'i7', datapoints: ['i7_1'] }] } },
    { key: 'p', name: 'Property investors', expression: { and: [{ question: 'q3d', datapoints: ['q3d_3'] }] } },
  ],
  primaryAudience: 'a',
  reference: ['ae'],
  panels: [
    { key: 'vac', title: 'Holidays', question: 'q32203', audience: 'a', datapoints: [{ code: 'beach', label: 'Beach' }, { code: 'city', label: 'City' }] },
    { key: 'dest', title: 'Considering', question: 'gwi-travel.q4425', audience: 'a', datapoints: [{ code: 'fr', label: 'France', home: 'fr' }, { code: 'it', label: 'Italy', home: 'it' }] },
  ],
  results: {
    fetchedAt: '2026-11-25T00:00:00Z',
    calls: 3,
    waves: ['q4_2025', 'q1_2026'],
    locations: { fr: { code: 's2_33', name: 'France' }, gr: { code: 's2_30', name: 'Greece' }, it: { code: 's2_39', name: 'Italy' }, ae: { code: 's2_971', name: 'UAE' } },
    unsupported: [],
    sizes: {
      a: { fr: size(2_853_000, 2495), gr: size(92_000, 84), it: size(2_238_000, 2175), ae: size(1_797_000, 1371) },
      p: { fr: size(1_212_000, 1065), gr: size(61_000, 25) },
    },
    panels: {
      vac: {
        fr: { beach: cell(58, 2495), city: cell(46, 2495, 125) },
        gr: { beach: cell(68, 84), city: cell(41, 84) },
        it: { beach: cell(64, 2175), city: cell(50, 2175) },
        ae: { beach: cell(90, 1371), city: cell(90, 1371) },
      },
      dest: { fr: { fr: cell(0, 138), it: cell(22, 138) }, it: { fr: cell(10, 20), it: cell(0, 20) } },
    },
  },
};
const MARKETS = ['mc', 'fr', 'gr', 'it'];

describe('gwiMarketView', () => {
  it('reads Monaco through France and says so', () => {
    const v = gwiMarketView(GWI, 'mc', MARKETS)!;
    expect(v.country).toEqual({ iso2: 'fr', name: 'France' });
    expect(v.proxyOf).toBe('mc');
    expect(gwiMarketView(GWI, 'fr', MARKETS)!.proxyOf).toBeUndefined();
  });

  it('averages each bar over the decoder countries only, sorted by share', () => {
    const v = gwiMarketView(GWI, 'fr', MARKETS)!;
    const vac = v.panels.find((p) => p.key === 'vac')!;
    expect(vac.bars.map((b) => b.label)).toEqual(['Beach', 'City']);
    // France, Greece, Italy; the UAE reference country is left out.
    expect(vac.bars[0].avg).toBeCloseTo((58 + 68 + 64) / 3);
    expect(vac.bars[1].index).toBe(125);
    expect(vac.low).toBe(false);
  });

  it('hides a destination for its own residents and drops panels too thin to show', () => {
    const fr = gwiMarketView(GWI, 'fr', MARKETS)!;
    expect(fr.panels.find((p) => p.key === 'dest')!.bars.map((b) => b.label)).toEqual(['Italy']);
    const it = gwiMarketView(GWI, 'it', MARKETS)!;
    expect(it.missing).toEqual(['Considering']); // 20 respondents
  });

  it('flags a thin audience as indicative and leaves out sizes below the minimum', () => {
    const gr = gwiMarketView(GWI, 'gr', MARKETS)!;
    expect(gr.audience.low).toBe(true);
    expect(gr.audience.size?.sample).toBe(84);
    expect(gr.others).toEqual([]); // property investors: 25 respondents
    expect(gr.panels[0].low).toBe(true);
    expect(gr.reference.map((r) => r.name)).toEqual(['UAE']);
  });

  it('returns null without results or for a country GWI lacks', () => {
    expect(gwiMarketView({ ...GWI, results: undefined }, 'fr', MARKETS)).toBeNull();
    expect(gwiMarketView(GWI, 'qa', MARKETS)).toBeNull();
    expect(gwiMarketView(undefined, 'fr', MARKETS)).toBeNull();
  });
});

describe('formatting', () => {
  it('spans waves in order', () => expect(waveSpan(['q2_2026', 'q4_2025', 'q1_2026'])).toBe('Q4 2025 – Q2 2026'));
  it('compacts people counts', () => {
    expect(compactPeople(1_797_197)).toBe('1.8M');
    expect(compactPeople(48_350_359)).toBe('48M');
    expect(compactPeople(92_100)).toBe('92k');
  });
});
