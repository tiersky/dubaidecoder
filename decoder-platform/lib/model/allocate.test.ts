import { describe, it, expect } from 'vitest';
import { applyFixedAllocation } from './allocate';
import type { FixedAllocation } from '../config/types';

// Palm Jebel Ali v2: USA fixed at 1.3M, the rest split 36/14/10/8/2.
const pja: FixedAllocation = {
  fixed: { USA: 1300000 },
  shares: { China: 36, UK: 14, India: 10, UAE: 8, Russia: 2 },
};
const all = new Set(['China', 'USA', 'UK', 'India', 'UAE', 'Russia']);

describe('applyFixedAllocation', () => {
  it('reproduces the agreed 5M distribution', () => {
    const b = applyFixedAllocation(pja, all, 5000000);
    expect(b.get('USA')).toBe(1300000);
    expect(b.get('China')).toBeCloseTo(1902857.14, 1);
    expect(b.get('UK')).toBeCloseTo(740000, 6);
    expect(b.get('India')).toBeCloseTo(528571.43, 1);
    expect(b.get('UAE')).toBeCloseTo(422857.14, 1);
    expect(b.get('Russia')).toBeCloseTo(105714.29, 1);
    const total = [...b.values()].reduce((a, v) => a + v, 0);
    expect(total).toBeCloseTo(5000000, 6);
  });

  it('keeps fixed amounts and rescales the remainder when the budget changes', () => {
    const b = applyFixedAllocation(pja, all, 8000000);
    expect(b.get('USA')).toBe(1300000);
    expect(b.get('China')).toBeCloseTo((6700000 * 36) / 70, 6);
  });

  it('redistributes the remainder over enabled share markets only', () => {
    const b = applyFixedAllocation(pja, new Set(['USA', 'China', 'UK']), 5000000);
    expect(b.get('USA')).toBe(1300000);
    expect(b.get('China')).toBeCloseTo((3700000 * 36) / 50, 6);
    expect(b.get('Russia')).toBe(0);
  });

  it('scales fixed amounts down when the budget is below their sum', () => {
    const b = applyFixedAllocation(pja, all, 650000);
    expect(b.get('USA')).toBe(650000);
    expect(b.get('China')).toBe(0);
  });

  it('gives the whole budget to fixed markets when no share market is enabled', () => {
    const b = applyFixedAllocation(pja, new Set(['USA']), 5000000);
    expect(b.get('USA')).toBe(5000000);
  });
});
