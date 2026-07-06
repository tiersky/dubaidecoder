export interface Country {
  name: string;
  code: string;
  population: number;
  lat: number;
  lng: number;
  // Raw model inputs (see "Country Decoder - Final 2503205" workbook sheet)
  spendsPerTrip: number;
  touristDeparturesRatio: number;
  searchVolume: number; // SV - 'Flight to AlUla'
  gdpGrowth: number; // decimal, e.g. 0.021 = 2.1%
  disposableIncome: number; // USD
  mediaCost: number;
  globalExplorers: number; // audience in millions
  budgetSplitMetric: number; // demand-side "Budget Split" input metric
  marketTiering: number; // 10 / 5 / 2.5
  audienceRatio: number; // audience ratio vs. total population (decimal)
  // Model outputs
  finalWeightedScore: number;
  percentSplit: number;
  budgetSplit: number; // AED allocation
  indices: Record<string, number>;
}

export interface AxisOption {
  value: string;
  label: string;
}

export type ModelWeights = Record<string, number>;

export const INDEX_KEYS = [
  'spendsPerTrip',
  'touristDeparturesRatio',
  'searchVolume',
  'gdpGrowth',
  'disposableIncome',
  'mediaCost',
  'globalExplorers',
  'budgetSplitMetric',
  'marketTiering',
  'audienceRatio',
] as const;

export type IndexKey = typeof INDEX_KEYS[number];

export const INDEX_LABELS: Record<string, string> = {
  spendsPerTrip: 'Spends per Trip',
  touristDeparturesRatio: 'Tourist Departures / Population',
  searchVolume: "Search Volume – 'Flight to AlUla'",
  gdpGrowth: 'GDP Growth',
  disposableIncome: 'Disposable Personal Income (USD)',
  mediaCost: 'Media Cost',
  globalExplorers: 'Global Explorers (Audience M)',
  budgetSplitMetric: 'Budget Split',
  marketTiering: 'Market Tiering',
  audienceRatio: 'Audience Ratio vs. Population',
};

// Model weights from the AlUla workbook (row "Model Weight")
export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  spendsPerTrip: 5,
  touristDeparturesRatio: 1,
  searchVolume: 10,
  gdpGrowth: 1,
  disposableIncome: 5,
  mediaCost: 20,
  globalExplorers: 2,
  budgetSplitMetric: 5,
  marketTiering: 10,
  audienceRatio: 5,
};
