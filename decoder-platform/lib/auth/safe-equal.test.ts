import { describe, it, expect } from 'vitest';
import { safeEqual } from './safe-equal';

describe('safeEqual', () => {
  it('matches equal strings', () => expect(safeEqual('abc', 'abc')).toBe(true));
  it('rejects different strings of any length', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});
