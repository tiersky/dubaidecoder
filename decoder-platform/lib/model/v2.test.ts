import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeAllocation, type AllocationRequest } from './allocation';
import { computeQuality, metricIndex, metricReference } from './quality';
import { fitTierGamma, skewness, suggestMetricSettings } from './migrate';
import { reach, roundToUnits, saturationScale, solveProportional, solveResponse, type ResponseMarket } from './solve';
import type { MetricDef } from './score';
import { egyptMarkets, egyptMetrics, egyptExpected } from './fixtures/egypt-week6';

const v2Egypt = suggestMetricSettings(egyptMetrics, egyptMarkets);
const all = new Set(egyptMarkets.map((m) => m.name));
const req = (over: Partial<AllocationRequest> = {}): AllocationRequest => ({
  model: 'score',
  metrics: v2Egypt,
  markets: egyptMarkets,
  budget: 1_000_000,
  funded: all,
  planning: { tierGamma: 0.14 },
  ...over,
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const byName = <T extends { name: string }>(rows: T[]) => new Map(rows.map((r) => [r.name, r] as const));

/* ── Solvers ─────────────────────────────────────────────────────────────── */

const responseMarket = fc.record({
  value: fc.double({ min: 0.05, max: 2, noNaN: true }),
  audience: fc.double({ min: 1e4, max: 5e7, noNaN: true }),
  cpm: fc.double({ min: 0.5, max: 40, noNaN: true }),
  frequency: fc.double({ min: 1, max: 8, noNaN: true }),
});
const objective = (ms: ResponseMarket[], s: number[]) => sum(ms.map((m, i) => m.value * reach(m, s[i])));

describe('solveResponse (optimised model)', () => {
  it('spends exactly the budget and equalises marginal value across funded markets', () => {
    fc.assert(
      fc.property(fc.array(responseMarket, { minLength: 2, maxLength: 12 }), fc.double({ min: 1e3, max: 5e7, noNaN: true }), (ms, budget) => {
        const s = solveResponse(ms, ms.map(() => ({ min: 0, max: Infinity })), budget);
        expect(sum(s)).toBeCloseTo(budget, 4);
        // Compare in log space: fully saturated markets underflow to 0 otherwise.
        const lnMv = (m: ResponseMarket, v: number) => Math.log((m.value * 1000) / (m.frequency * m.cpm)) - v / saturationScale(m);
        const funded = s.map((v, i) => ({ v, l: lnMv(ms[i], v) })).filter((x) => x.v > budget * 1e-9);
        const ls = funded.map((x) => x.l);
        expect(Math.max(...ls) - Math.min(...ls)).toBeLessThan(1e-6);
        // Unfunded markets are not worth their first unit.
        s.forEach((v, i) => {
          if (v <= budget * 1e-9) expect(lnMv(ms[i], 0)).toBeLessThanOrEqual(Math.max(...ls) + 1e-6);
        });
      })
    );
  });

  it('no transfer between two markets improves the objective', () => {
    fc.assert(
      fc.property(
        fc.array(responseMarket, { minLength: 2, maxLength: 8 }),
        fc.double({ min: 1e4, max: 1e7, noNaN: true }),
        fc.nat(),
        fc.nat(),
        fc.double({ min: 0.001, max: 0.2, noNaN: true }),
        (ms, budget, a, b, frac) => {
          const s = solveResponse(ms, ms.map(() => ({ min: 0, max: Infinity })), budget);
          const i = a % ms.length;
          const j = b % ms.length;
          if (i === j || s[i] <= 0) return;
          const moved = [...s];
          const d = s[i] * frac;
          moved[i] -= d;
          moved[j] += d;
          expect(objective(ms, moved)).toBeLessThanOrEqual(objective(ms, s) * (1 + 1e-9));
        }
      )
    );
  });

  it('matches a brute-force search on a small case', () => {
    const ms: ResponseMarket[] = [
      { value: 0.8, audience: 2e6, cpm: 10, frequency: 3 },
      { value: 0.5, audience: 8e6, cpm: 4, frequency: 3 },
      { value: 1.35, audience: 4e5, cpm: 15, frequency: 3 },
    ];
    const B = 1_000_000;
    const s = solveResponse(ms, ms.map(() => ({ min: 0, max: Infinity })), B);
    let best = 0;
    for (let x = 0; x <= B; x += B / 200) for (let y = 0; x + y <= B; y += B / 200) best = Math.max(best, objective(ms, [x, y, B - x - y]));
    expect(objective(ms, s)).toBeGreaterThanOrEqual(best * (1 - 1e-6));
  });

  it('never lowers any market when the budget grows', () => {
    fc.assert(
      fc.property(fc.array(responseMarket, { minLength: 2, maxLength: 8 }), fc.double({ min: 1e3, max: 1e7, noNaN: true }), (ms, b) => {
        const bounds = ms.map(() => ({ min: 0, max: Infinity }));
        const lo = solveResponse(ms, bounds, b);
        const hi = solveResponse(ms, bounds, b * 1.5);
        lo.forEach((v, i) => expect(hi[i]).toBeGreaterThanOrEqual(v - 1e-6 * b));
      })
    );
  });
});

describe('solveProportional (score model)', () => {
  it('honours min/max bounds and spends exactly the budget', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ w: fc.double({ min: 0.01, max: 5, noNaN: true }), min: fc.double({ min: 0, max: 50, noNaN: true }), extra: fc.double({ min: 0, max: 400, noNaN: true }) }), { minLength: 2, maxLength: 12 }),
        (xs) => {
          const bounds = xs.map((x) => ({ min: x.min, max: x.min + x.extra }));
          const budget = (sum(bounds.map((b) => b.min)) + sum(bounds.map((b) => b.max))) / 2;
          const s = solveProportional(xs.map((x) => x.w), bounds, budget);
          expect(sum(s)).toBeCloseTo(budget, 6);
          s.forEach((v, i) => {
            expect(v).toBeGreaterThanOrEqual(bounds[i].min - 1e-9);
            expect(v).toBeLessThanOrEqual(bounds[i].max + 1e-9);
          });
        }
      )
    );
  });

  it('is plain proportional sharing without bounds', () => {
    const s = solveProportional([1, 2, 3], [0, 0, 0].map(() => ({ min: 0, max: Infinity })), 600);
    expect(s[0]).toBeCloseTo(100, 6);
    expect(s[2]).toBeCloseTo(300, 6);
  });
});

describe('roundToUnits', () => {
  it('keeps the exact total', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 30 }), (xs) => {
        const total = sum(xs);
        expect(sum(roundToUnits(xs, total))).toBe(Math.round(total));
      })
    );
  });
});

/* ── Quality ─────────────────────────────────────────────────────────────── */

describe('quality', () => {
  it('judgment scores depend only on their own value and declared scale', () => {
    const m: MetricDef = { key: 't', label: 'Tier', weight: 1, direction: 'higher', kind: 'score', scale: { min: 0, max: 50 } };
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 50, noNaN: true }), { minLength: 1, maxLength: 20 }), fc.double({ min: 0, max: 50, noNaN: true }), (others, x) => {
        const ref = metricReference(m, others.map((v, i) => ({ name: String(i), values: { t: v } })));
        expect(metricIndex(m, x, ref)).toBeCloseTo(x / 50, 12);
      })
    );
  });

  it('a blank never scores above the same market at the best observed value', () => {
    const blank = egyptMarkets.map((m) => (m.name === 'Czech Republic' ? m : m));
    const q = computeQuality(blank, blank, v2Egypt);
    const best = Math.min(...egyptMarkets.map((m) => m.values.mediaCost).filter((v): v is number => v !== null));
    const filled = egyptMarkets.map((m) => (m.name === 'Czech Republic' ? { ...m, values: { ...m.values, mediaCost: best } } : m));
    const q2 = computeQuality(filled, filled, v2Egypt);
    expect(q.get('Czech Republic')!.q).toBeLessThanOrEqual(q2.get('Czech Republic')!.q);
    expect(q.get('Czech Republic')!.coverage).toBeLessThan(1);
  });

  it('is unchanged by a change of units', () => {
    const scaled = egyptMarkets.map((m) => ({ ...m, values: { ...m.values, visitors2025: m.values.visitors2025! / 1000, mediaCost: m.values.mediaCost === null ? null : m.values.mediaCost * 3.67 } }));
    const a = computeQuality(egyptMarkets, egyptMarkets, v2Egypt);
    const b = computeQuality(scaled, scaled, v2Egypt);
    for (const m of egyptMarkets) expect(b.get(m.name)!.q).toBeCloseTo(a.get(m.name)!.q, 10);
  });
});

/* ── Allocation (dispatcher) ─────────────────────────────────────────────── */

describe('computeAllocation', () => {
  it('workbook mode reproduces the verified Egypt workbook', () => {
    const r = computeAllocation({ model: 'workbook', metrics: egyptMetrics, markets: egyptMarkets, budget: 1, funded: all });
    for (const row of r.rows) expect(row.share, row.name).toBeCloseTo(egyptExpected[row.name].split, 5);
  });

  it('removing a market from the universe equals rebuilding without it', () => {
    for (const model of ['score', 'optimised'] as const) {
      const population = Object.fromEntries(egyptMarkets.map((m, i) => [m.name, 5e6 + i * 3e6]));
      const out = 'Germany';
      const rest = egyptMarkets.filter((m) => m.name !== out);
      const a = computeAllocation(req({ model, population, universe: new Set(rest.map((m) => m.name)), funded: new Set(rest.map((m) => m.name)) }));
      const b = computeAllocation(req({ model, population, markets: rest, funded: new Set(rest.map((m) => m.name)) }));
      const bb = byName(b.rows);
      for (const row of a.rows.filter((x) => x.name !== out)) {
        expect(row.budget, `${model} ${row.name}`).toBeCloseTo(bb.get(row.name)!.budget, 6);
      }
      expect(byName(a.rows).get(out)!.budget).toBe(0);
    }
  });

  it("turning a market's funding off moves the money but not anyone's quality", () => {
    const base = byName(computeAllocation(req()).rows);
    const funded = new Set(all);
    funded.delete('UK');
    const off = computeAllocation(req({ funded }));
    for (const row of off.rows) expect(row.quality).toBeCloseTo(base.get(row.name)!.quality, 12);
    expect(byName(off.rows).get('UK')!.budget).toBe(0);
    expect(sum(off.rows.map((r) => r.budget))).toBeCloseTo(1_000_000, 4);
  });

  it('keeps leave-one-out drift small on Egypt (score model)', () => {
    const base = byName(computeAllocation(req()).rows);
    const drifts: number[] = [];
    for (const out of all) {
      const rest = egyptMarkets.filter((m) => m.name !== out);
      const r = byName(computeAllocation(req({ markets: rest, funded: new Set(rest.map((m) => m.name)) })).rows);
      const names = [...r.keys()];
      for (const a of names)
        for (const c of names)
          if (a < c) {
            const before = base.get(a)!.budget / base.get(c)!.budget;
            const after = r.get(a)!.budget / r.get(c)!.budget;
            drifts.push(Math.abs(after / before - 1));
          }
    }
    drifts.sort((x, y) => x - y);
    // Measured with leave-one-out references (p95 6.3%, worst 11.1%); today's
    // workbook model is p95 9.4%, worst 74.9%. Leave-one-out is chosen over a
    // whole-universe reference (3.8% / 5.8%) because it guarantees that
    // improving a market's own figure never lowers its own index.
    expect(drifts[Math.floor(drifts.length * 0.95)]).toBeLessThanOrEqual(0.07);
    expect(drifts.at(-1)!).toBeLessThanOrEqual(0.12);
  });

  it('a better value never lowers that market’s own quality or budget (score model)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...egyptMarkets.map((m) => m.name)), fc.double({ min: 1.01, max: 3, noNaN: true }), (name, k) => {
        const better = egyptMarkets.map((m) => (m.name === name ? { ...m, values: { ...m.values, visitors2025: m.values.visitors2025! * k } } : m));
        const a = byName(computeAllocation(req()).rows).get(name)!;
        const b = byName(computeAllocation(req({ markets: better })).rows).get(name)!;
        expect(b.quality).toBeGreaterThanOrEqual(a.quality - 1e-12);
        expect(b.budget).toBeGreaterThanOrEqual(a.budget - 1e-6);
      }),
      { numRuns: 40 }
    );
  });

  it('honours locks, minimums and maximums, and reports infeasible plans', () => {
    const r = computeAllocation(req({ controls: { Germany: { lock: 50_000 }, India: { min: 80_000 }, Russia: { max: 30_000 } } }));
    const m = byName(r.rows);
    expect(m.get('Germany')!.budget).toBeCloseTo(50_000, 6);
    expect(m.get('India')!.budget).toBeGreaterThanOrEqual(80_000 - 1e-6);
    expect(m.get('Russia')!.budget).toBeLessThanOrEqual(30_000 + 1e-6);
    const bad = computeAllocation(req({ controls: { Germany: { min: 2_000_000 } } }));
    expect(bad.error).toMatch(/Minimums/);
  });

  it('priority moves money towards favoured markets', () => {
    const base = byName(computeAllocation(req()).rows).get('Spain')!.budget;
    const fav = byName(computeAllocation(req({ controls: { Spain: { priority: 2 } } })).rows).get('Spain')!.budget;
    expect(fav).toBeGreaterThan(base);
  });

  it('optimised model flags markets without audience or CPM and gives them nothing', () => {
    const population = Object.fromEntries(egyptMarkets.map((m) => [m.name, 10_000_000]));
    const r = computeAllocation(req({ model: 'optimised', population }));
    const czech = byName(r.rows).get('Czech Republic')!;
    expect(czech.missing.length).toBeGreaterThan(0);
    expect(czech.budget).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/Czech Republic/);
    expect(sum(r.rows.map((x) => x.budget))).toBeCloseTo(1_000_000, 3);
    const russia = byName(r.rows).get('Russia')!;
    expect(russia.saturation).toBeGreaterThan(0);
    expect(russia.saturation).toBeLessThan(1);
  });
});

/* ── Migration ───────────────────────────────────────────────────────────── */

describe('migration', () => {
  it('spots the tier, CPM and audience columns and the heavy-tailed measures', () => {
    const by = new Map(v2Egypt.map((m) => [m.key, m]));
    expect(by.get('marketTier')!.role).toBe('priority');
    expect(by.get('mediaCost')!.role).toBe('cpm');
    expect(by.get('audienceRatio')!.role).toBe('audienceRatio');
    expect(by.get('visitors2025')!.transform).toBe('log');
    expect(by.get('yoyGrowth')!.kind).toBe('ratio');
    expect(skewness([1, 2, 3])).toBeCloseTo(0, 10);
  });

  it('fits Egypt’s tier strength so the score model stays close to the old budgets', () => {
    const fit = fitTierGamma({ metrics: egyptMetrics, v2Metrics: v2Egypt, markets: egyptMarkets, budget: 1_000_000 })!;
    expect(fit.gamma).toBeGreaterThan(0.05);
    expect(fit.gamma).toBeLessThan(0.3);
    expect(fit.rms).toBeLessThan(0.008); // under 0.8 points of share
    expect(fit.rms).toBeLessThan(fit.rmsWithoutTier);
  });
});
