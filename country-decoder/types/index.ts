export interface Country {
  name: string;
  code: string;
  population: number;
  lat: number;
  lng: number;
  millionairesRatio: number;
  luxurySpendPerCapita: number;
  novTravelVolume: number;
  googleTravelIntent: number;
  svDubaiLuxuryShopping: number;
  gdpGrowth: number;
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
  'millionairesRatio',
  'luxurySpend',
  'novTravelVolume',
  'googleTravelIntent',
  'svDubaiLuxuryShopping',
  'gdpGrowth',
  'disposableIncome',
  'mediaCost',
  'audienceGWI',
  'marketTiering',
  'audienceRatio',
] as const;

export const INDEX_LABELS: Record<string, string> = {
  millionairesRatio: 'Millionaires vs Population',
  luxurySpend: 'Luxury Spend per Capita',
  novTravelVolume: 'November Travel Volume',
  googleTravelIntent: 'Google Travel Intent',
  svDubaiLuxuryShopping: 'SV Dubai Luxury Shopping',
  gdpGrowth: 'GDP Growth',
  disposableIncome: 'Disposable Income',
  mediaCost: 'Media Cost',
  audienceGWI: 'Audience Size (GWI)',
  marketTiering: 'Market Tiering',
  audienceRatio: 'Audience Ratio',
};

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  millionairesRatio: 5,
  luxurySpend: 30,
  novTravelVolume: 30,
  googleTravelIntent: 30,
  svDubaiLuxuryShopping: 20,
  gdpGrowth: 5,
  disposableIncome: 5,
  mediaCost: 1,
  audienceGWI: 30,
  marketTiering: 30,
  audienceRatio: 5,
};
