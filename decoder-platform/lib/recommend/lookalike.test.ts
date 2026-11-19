import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rankLookalikes, type LookalikeCountry } from './lookalike';

const country = (iso2: string, ppp: number, pop: number, internet: number, lat = 0, lng = 0): LookalikeCountry => ({
  iso2,
  name: iso2.toUpperCase(),
  lat,
  lng,
  facts: {
    gdpPppPerHead: { value: ppp, year: 2025 },
    spendPerHead: { value: ppp * 0.55, year: 2024 },
    population: { value: pop, year: 2024 },
    internet: { value: internet, year: 2024 },
  },
  culture: null,
});

const universe: LookalikeCountry[] = [
  country('aa', 60000, 60e6, 95, 50, 0),
  country('bb', 55000, 80e6, 93, 52, 10),
  country('cc', 58000, 10e6, 96, 48, 5),
  country('dd', 57000, 40e6, 94, 45, 8),
  country('ee', 9000, 200e6, 45, 10, 80),
  country('ff', 3000, 30e6, 30, 5, 30),
  country('gg', 30000, 20e6, 80, 35, 30),
  country('hh', 52000, 5e6, 97, 60, 20),
  country('ii', 15000, 100e6, 70, 20, 100),
];

describe('rankLookalikes', () => {
  it('never recommends a starting or excluded country, and puts the obvious lookalikes first', () => {
    const r = rankLookalikes(universe, { seeds: ['aa', 'bb'], exclude: ['hh'] });
    const codes = r.map((x) => x.iso2);
    expect(codes).not.toContain('aa');
    expect(codes).not.toContain('bb');
    expect(codes).not.toContain('hh');
    expect(codes.slice(0, 2).sort()).toEqual(['cc', 'dd']);
    expect(codes.at(-1)).toBe('ff');
    expect(r[0].closestSeed).not.toBeNull();
  });

  it('is independent of seed order and deterministic', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(['aa', 'bb', 'cc', 'ee'], { minLength: 1 }), (seeds) => {
        const a = rankLookalikes(universe, { seeds });
        const b = rankLookalikes(universe, { seeds: [...seeds].reverse() });
        expect(b).toEqual(a);
      })
    );
  });

  it('moving a candidate towards the starting countries never lowers its fit', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        const fitOf = (ppp: number) =>
          rankLookalikes([...universe.filter((c) => c.iso2 !== 'gg'), country('gg', ppp, 20e6, 80)], { seeds: ['aa', 'bb'] }).find(
            (x) => x.iso2 === 'gg'
          )!.fit;
        const far = 9000 + t * 20000;
        const near = far + (57500 - far) * 0.5;
        expect(fitOf(near)).toBeGreaterThanOrEqual(fitOf(far) - 1e-9);
      }),
      { numRuns: 30 }
    );
  });

  it('drops microstates and uses distance only when a destination is given', () => {
    const tiny = [...universe, country('mc', 60000, 40_000, 99)];
    expect(rankLookalikes(tiny, { seeds: ['aa'] }).map((x) => x.iso2)).not.toContain('mc');
    const withDest = rankLookalikes(universe, { seeds: ['aa'], destination: { lat: 50, lng: 0 } });
    expect(withDest.find((x) => x.iso2 === 'cc')!.distanceKm).toBeGreaterThan(0);
    expect(rankLookalikes(universe, { seeds: ['aa'] })[0].distanceKm).toBeNull();
  });

  it('returns nothing without a known starting country', () => {
    expect(rankLookalikes(universe, { seeds: ['zz'] })).toEqual([]);
  });
});
