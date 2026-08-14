import { describe, it, expect } from 'vitest';
import { sampleStats } from './stats';

describe('sampleStats', () => {
  it('matches the week-6 workbook visitor stats (15 markets)', () => {
    const visitors = [
      2230000, 1880000, 1180000, 1140000, 1140000, 1070000, 526000, 507000,
      495000, 372000, 269000, 250000, 246000, 243000, 163000,
    ];
    const s = sampleStats(visitors);
    expect(s.avg).toBeCloseTo(780733.3333, 3);
    expect(s.stdev).toBeCloseTo(638008.1131, 3);
    expect(s.n).toBe(15);
  });

  it('excludes nulls, matching the workbook media-cost stats (12 of 15 markets)', () => {
    const cpm = [14, 10, 6.5, 4.5, 7.5, 11, 16, 8.5, null, 7, null, null, 5.2, 6.5, 3.5];
    const s = sampleStats(cpm);
    expect(s.avg).toBeCloseTo(8.35, 4);
    expect(s.stdev).toBeCloseTo(3.7884, 4);
    expect(s.n).toBe(12);
  });

  it('handles degenerate inputs', () => {
    expect(sampleStats([])).toEqual({ avg: 0, stdev: 0, n: 0 });
    expect(sampleStats([null, null])).toEqual({ avg: 0, stdev: 0, n: 0 });
    expect(sampleStats([7])).toEqual({ avg: 7, stdev: 0, n: 1 });
  });
});
