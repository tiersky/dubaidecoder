import { describe, expect, it } from 'vitest';
import { cultureMarkets, marketForCultureName } from './culture-markets';
import type { MarketVm } from './derive';

const vm = (name: string, iso2: string | null, country?: string): MarketVm => ({
  name,
  iso2,
  lat: null,
  lng: null,
  enabled: true,
  values: {},
  indices: {},
  score: 0,
  split: 0,
  ...(country && { place: { kind: 'city' as const, country } }),
});

describe('cultureMarkets', () => {
  it('passes country markets through unchanged', () => {
    const ms = [vm('France', 'fr'), vm('Italy', 'it')];
    expect(cultureMarkets(ms)).toEqual(ms);
  });

  it('collapses cities to one row per country, named after the country', () => {
    const ms = [vm('Nice', 'fr', 'France'), vm('Cannes', 'fr', 'France'), vm('Olbia', 'it', 'Italy')];
    expect(cultureMarkets(ms).map((m) => [m.name, m.iso2])).toEqual([
      ['France', 'fr'],
      ['Italy', 'it'],
    ]);
  });

  it('maps a country row back to its first city, and real names to themselves', () => {
    const ms = [vm('Nice', 'fr', 'France'), vm('Cannes', 'fr', 'France')];
    expect(marketForCultureName(ms, 'France')?.name).toBe('Nice');
    expect(marketForCultureName(ms, 'Cannes')?.name).toBe('Cannes');
    expect(marketForCultureName(ms, 'Spain')).toBeUndefined();
  });
});
