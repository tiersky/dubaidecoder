import { describe, expect, it } from 'vitest';
import { SLOTS, summerTimeline } from './summer-timeline';
import type { SummerTraffic } from '@/lib/config/types';

const jets = (pts: Array<[string, number]>): SummerTraffic['jets'] => ({
  airports: ['XXXX Test'],
  summerPer2Days: 1,
  offPer2Days: null,
  uplift: null,
  seasonArrivals: 1,
  series: pts.map(([label, value]) => ({ label, value })),
  peak: pts[0][0],
  captureRate: null,
  gccShare: null,
});
const yachts = (byMonth: number[]): SummerTraffic['yachts'] => ({
  sites: ['Test'],
  summerHoursPerMonth: 1,
  offHoursPerMonth: 1,
  uplift: null,
  series: byMonth.map((value, i) => ({ label: String(i + 1), value })),
  peakMonth: 1,
  year: 2023,
});
const months = (jun: number, jul: number, aug: number, sep: number) => [1, 1, 1, 1, 1, jun, jul, aug, sep, 1, 1, 1];

describe('summerTimeline', () => {
  it('puts fortnights in half-month slots and peaks at the busiest one', () => {
    const t = summerTimeline([
      { name: 'A', summer: { jets: jets([['2025-06-06', 10], ['2025-07-18', 40], ['2025-08-15', 20], ['2025-08-29', 30]]) } },
    ]);
    const r = t.rows[0];
    expect(r.cells.map((c) => c.jets)).toEqual([10, null, null, 40, 20, 30, null, null]);
    expect(SLOTS[r.peak].label).toBe('Late Jul');
    expect(r.cells[r.peak].level).toBe(1);
    expect(r.cells[0].level).toBeCloseTo(0.25);
    expect(r.cells[1].level).toBeNull();
  });

  it('averages two fortnights in one slot', () => {
    const t = summerTimeline([{ name: 'A', summer: { jets: jets([['2025-08-01', 10], ['2025-08-15', 30]]) } }]);
    expect(t.rows[0].cells[4].jets).toBe(20);
  });

  it('blends jets and yachts after scaling each to its own peak', () => {
    const t = summerTimeline([
      {
        name: 'A',
        summer: {
          jets: jets([['2025-07-04', 100], ['2025-08-01', 50]]),
          yachts: yachts(months(0, 500, 1000, 0)),
        },
      },
    ]);
    const r = t.rows[0];
    expect(r.sources).toEqual(['jets', 'yachts']);
    // Early Jul: jets 1, yachts 0.5 → 0.75; Early Aug: jets 0.5, yachts 1 → 0.75; Late Aug: yachts 1 only.
    expect(r.cells[2].level).toBeCloseTo(0.75);
    expect(r.cells[4].level).toBeCloseTo(0.75);
    expect(r.cells[5].level).toBe(1);
    expect(SLOTS[r.peak].label).toBe('Late Aug');
  });

  it('skips markets with no summer data or all-zero series, and orders rows by peak', () => {
    const t = summerTimeline([
      { name: 'Late', summer: { yachts: yachts(months(1, 2, 3, 9)) } },
      { name: 'None' },
      { name: 'Zero', summer: { jets: jets([['2025-06-06', 0]]) } },
      { name: 'Early', summer: { yachts: yachts(months(9, 2, 1, 1)) } },
    ]);
    expect(t.rows.map((r) => r.name)).toEqual(['Early', 'Late']);
    expect(t.peaks).toEqual([1, 0, 0, 0, 0, 0, 1, 0]);
    expect(t.overall[0]).toBeCloseTo((1 + 1 / 9) / 2);
  });

  it('keeps every level within 0–1 for any input', () => {
    const t = summerTimeline([{ name: 'A', summer: { jets: jets([['2025-06-20', 3], ['2025-09-26', 7]]), yachts: yachts(months(5, 0, 8, 2)) } }]);
    for (const c of t.rows[0].cells) {
      if (c.level == null) continue;
      expect(c.level).toBeGreaterThanOrEqual(0);
      expect(c.level).toBeLessThanOrEqual(1);
    }
  });
});
