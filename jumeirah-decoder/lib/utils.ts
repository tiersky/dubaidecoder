import { Country, ModelWeights, INDEX_KEYS, IndexKey } from '@/types';

export function calculateAverage(countries: Country[], metric: keyof Country): number {
  const values = countries.map(c => {
    const val = c[metric];
    return typeof val === 'number' ? val : 0;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function formatCurrency(value: number, currency = 'AED'): string {
  return `${currency} ${value.toLocaleString()}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export interface Allocation {
  name: string;
  code: string;
  weightedScore: number;
  percentSplit: number;
  budget: number;
}

// Compute allocations from raw per-country fields. Each metric is normalized
// against the max across the *active* country set (so toggling a country
// off automatically rescales the remaining ones), then weighted-summed.
export function computeAllocations(
  countries: Country[],
  weights: ModelWeights,
  totalBudget: number
): Allocation[] {
  if (countries.length === 0) return [];

  // Compute per-metric max from countries that actually have a value for it.
  // Null values are treated as "no data" and contribute nothing to the country's
  // score (rather than being coerced to 0, which would penalize them). They're
  // also excluded from the per-metric max so coverage gaps don't skew the scale.
  const maxByKey: Record<IndexKey, number> = {} as Record<IndexKey, number>;
  for (const key of INDEX_KEYS) {
    const values = countries
      .map((c) => c[key])
      .filter((v): v is number => typeof v === 'number');
    maxByKey[key] = values.length > 0 ? Math.max(...values) : 0;
  }

  const scores = countries.map((c) => {
    let score = 0;
    for (const key of INDEX_KEYS) {
      const raw = c[key];
      if (typeof raw !== 'number') continue;
      const max = maxByKey[key];
      const normalized = max > 0 ? raw / max : 0;
      score += (weights[key] ?? 0) * normalized;
    }
    return { name: c.name, code: c.code, weightedScore: score };
  });

  const totalScore = scores.reduce((sum, s) => sum + s.weightedScore, 0);

  return scores.map((s) => ({
    ...s,
    percentSplit: totalScore > 0 ? s.weightedScore / totalScore : 0,
    budget: totalScore > 0 ? (s.weightedScore / totalScore) * totalBudget : 0,
  }));
}

// Dubai (DXB) reference coordinates for proximity calculations.
export const DUBAI_LAT = 25.2048;
export const DUBAI_LNG = 55.2708;

// Great-circle distance in kilometres between two lat/lng points.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function distanceToDubaiKm(lat: number, lng: number): number {
  return haversineKm(lat, lng, DUBAI_LAT, DUBAI_LNG);
}

// ISO Alpha-2 to ISO Alpha-3 mapping for react-simple-maps (which uses Alpha-3)
export const countryCodeMap: Record<string, string> = {
  sa: 'SAU', bh: 'BHR', om: 'OMN', qa: 'QAT', kw: 'KWT',
  ru: 'RUS', cn: 'CHN', gb: 'GBR', fr: 'FRA', de: 'DEU',
  it: 'ITA', ch: 'CHE', es: 'ESP', pl: 'POL',
  ae: 'ARE', us: 'USA', nl: 'NLD', kz: 'KAZ', be: 'BEL',
  au: 'AUS', at: 'AUT', in: 'IND', tr: 'TUR', ro: 'ROU',
  za: 'ZAF', cz: 'CZE', hu: 'HUN', eg: 'EGY',
};
