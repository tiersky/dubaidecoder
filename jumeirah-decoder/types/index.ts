export interface Country {
  name: string;
  code: string;
  population: number;
  lat: number;
  lng: number;
  millionairesRatio: number;
  internationalTravellers: number;
  tourismExpenditureUsd: number;
  avgSpendPerTripUsd: number;
  gdpPppPerCapitaUsd: number;
  dailyFlightsToDxb: number;
  dailySeatsToDxb: number;
  luxurySpendPerCapita: number;
  novTravelVolume: number;
  googleTravelIntent: number;
  svDubaiLuxuryShopping: number;
  gdpGrowth: number;
  confidenceScore: number | null;
  finalWeightedScore: number;
  percentSplit: number;
  budgetSplit: number;
  indices: Record<string, number>;
}

export interface PerceptionScore {
  score: number;
  explanation: string;
}

export interface AxisOption {
  value: string;
  label: string;
}

export type ModelWeights = Record<string, number>;

export const INDEX_KEYS = [
  'internationalTravellers',
  'tourismExpenditureUsd',
  'avgSpendPerTripUsd',
  'googleTravelIntent',
  'gdpPppPerCapitaUsd',
  'confidenceScore',
] as const;

export type IndexKey = typeof INDEX_KEYS[number];

export const INDEX_LABELS: Record<IndexKey, string> = {
  internationalTravellers: 'International Travellers',
  tourismExpenditureUsd: 'Tourism Expenditure',
  avgSpendPerTripUsd: 'Avg. Spend per Trip',
  googleTravelIntent: 'Google Travel Intent',
  gdpPppPerCapitaUsd: 'GDP (PPP) per Capita',
  confidenceScore: 'Confidence Score',
};

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  internationalTravellers: 20,
  tourismExpenditureUsd: 20,
  avgSpendPerTripUsd: 20,
  googleTravelIntent: 20,
  gdpPppPerCapitaUsd: 20,
  confidenceScore: 20,
};
