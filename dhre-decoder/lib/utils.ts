import { Country, ModelWeights, INDEX_KEYS } from '@/types';

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
  tier: string;
  weightedScore: number;
  percentSplit: number;
  budget: number;
}

export function computeAllocations(
  countries: Country[],
  weights: ModelWeights,
  totalBudget: number,
  excludedCodes?: Set<string>
): Allocation[] {
  const eligible = countries.filter(
    (c) => c.tier !== 'excluded' && !(excludedCodes?.has(c.code))
  );

  const scores = eligible.map((c) => {
    let score = 0;
    for (const key of INDEX_KEYS) {
      score += (weights[key] ?? 0) * (c.indices[key] ?? 0);
    }
    return { name: c.name, code: c.code, tier: c.tier, weightedScore: score };
  });

  const totalScore = scores.reduce((sum, s) => sum + s.weightedScore, 0);

  return scores.map((s) => ({
    ...s,
    percentSplit: totalScore > 0 ? s.weightedScore / totalScore : 0,
    budget: totalScore > 0 ? (s.weightedScore / totalScore) * totalBudget : 0,
  }));
}

export const countryCodeMap: Record<string, string> = {
  us: 'USA', cn: 'CHN', gb: 'GBR', fr: 'FRA', jp: 'JPN',
  de: 'DEU', ca: 'CAN', au: 'AUS', it: 'ITA', nl: 'NLD',
  ch: 'CHE', in: 'IND', se: 'SWE', ru: 'RUS', sa: 'SAU',
  sg: 'SGP', nz: 'NZL', no: 'NOR', id: 'IDN', lu: 'LUX',
  kz: 'KAZ', qa: 'QAT', om: 'OMN', jo: 'JOR', ie: 'IRL',
  kw: 'KWT', dk: 'DNK', za: 'ZAF',
};
