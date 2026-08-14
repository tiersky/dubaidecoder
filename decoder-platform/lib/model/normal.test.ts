import { describe, it, expect } from 'vitest';
import { normalCdf } from './normal';

describe('normalCdf', () => {
  it('matches standard normal values', () => {
    expect(normalCdf(0, 0, 1)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1, 0, 1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.959964, 0, 1)).toBeCloseTo(0.025, 5);
  });

  it('matches Excel NORM.DIST from the Egypt week-6 workbook', () => {
    // Russia 2025 visitors: NORM.DIST(2230000, 780733.3333, 638008.1131, TRUE)
    expect(normalCdf(2230000, 780733.3333, 638008.1131)).toBeCloseTo(0.988443, 5);
    // Germany market tier: NORM.DIST(50, 8.82, 12.1043, TRUE)
    expect(normalCdf(50, 8.82, 12.1043)).toBeCloseTo(0.999666, 5);
  });

  it('degenerate stdev returns 0.5', () => {
    expect(normalCdf(5, 5, 0)).toBe(0.5);
    expect(normalCdf(99, 5, -1)).toBe(0.5);
  });
});
