import type { MarketVm } from './derive';

/**
 * The markets the culture views should list. Country markets pass through;
 * city markets collapse to one row per parent country (culture data is
 * national), named after the country and pointing at its first city.
 */
export function cultureMarkets(markets: MarketVm[]): MarketVm[] {
  const seen = new Set<string>();
  const out: MarketVm[] = [];
  for (const m of markets) {
    if (!m.place) {
      out.push(m);
      continue;
    }
    const key = (m.iso2 ?? m.place.country).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...m, name: m.place.country });
  }
  return out;
}

/** Resolves a name from cultureMarkets back to a real market (a country row → its first city). */
export function marketForCultureName(markets: MarketVm[], name: string): MarketVm | undefined {
  return markets.find((m) => m.name === name) ?? markets.find((m) => m.place?.country === name);
}
