import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DIMENSIONS, cultureProfile, type Scores } from './hofstede';
import { culturalDistance, dimensionVariance, distanceScaleMax, orbitLayout } from './culture-space';

const scoresArb = fc.record(
  Object.fromEntries(DIMENSIONS.map((d) => [d.key, fc.integer({ min: 0, max: 120 })])) as Record<keyof Scores, fc.Arbitrary<number>>
) as fc.Arbitrary<Scores>;

const p = (iso2: string) => cultureProfile(iso2)!.scores;

describe('culturalDistance', () => {
  it('is zero to itself, symmetric and non-negative', () => {
    fc.assert(
      fc.property(scoresArb, scoresArb, (a, b) => {
        expect(culturalDistance(a, a)).toBe(0);
        expect(culturalDistance(a, b)).toBeCloseTo(culturalDistance(b, a), 12);
        expect(culturalDistance(a, b)).toBeGreaterThanOrEqual(0);
      })
    );
  });

  it('matches the Kogut–Singh formula by hand for one pair', () => {
    const v = dimensionVariance();
    const [a, b] = [p('gb'), p('cn')];
    const byHand = DIMENSIONS.reduce((s, { key }) => s + (a[key] - b[key]) ** 2 / v[key], 0) / 6;
    expect(culturalDistance(a, b)).toBeCloseTo(byHand, 12);
  });

  it('puts the UK nearer the USA than China', () => {
    expect(culturalDistance(p('gb'), p('us'))).toBeLessThan(culturalDistance(p('gb'), p('cn')));
  });
});

describe('orbitLayout', () => {
  it('keeps every body on the same spoke whatever the mode', () => {
    const bodies = ['cn', 'us', 'gb', 'in', 'ru'].map((id) => ({ id, scores: p(id) }));
    const a = orbitLayout(bodies, p('ae'), 'distance').placements;
    const b = orbitLayout(bodies, p('ae'), 'pdi').placements;
    expect(a.map((x) => x.angle)).toEqual(b.map((x) => x.angle));
  });

  it('keeps distance radii within the outer ring and dimension radii at score/100', () => {
    fc.assert(
      fc.property(fc.array(scoresArb, { minLength: 1, maxLength: 30 }), scoresArb, (all, center) => {
        const bodies = all.map((scores, i) => ({ id: String(i), scores }));
        const { placements, scaleMax } = orbitLayout(bodies, center, 'distance');
        for (const pl of placements) {
          expect(pl.radius).toBeGreaterThanOrEqual(0);
          expect(pl.radius).toBeLessThanOrEqual(1);
          expect(pl.radius * scaleMax).toBeCloseTo(pl.value, 9);
        }
        const dim = orbitLayout(bodies, center, 'uai').placements;
        dim.forEach((pl, i) => expect(pl.radius).toBe(all[i].uai / 100));
      })
    );
  });
});

describe('distanceScaleMax', () => {
  it('rounds up to a half step with a 0.5 floor', () => {
    expect(distanceScaleMax([])).toBe(0.5);
    expect(distanceScaleMax([0.1])).toBe(0.5);
    expect(distanceScaleMax([1.2, 0.4])).toBe(1.5);
    expect(distanceScaleMax([2])).toBe(2);
  });
});
