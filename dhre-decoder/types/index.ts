export type Tier = 'prime' | 'secondary' | 'monitoring' | 'excluded';

export interface Country {
  name: string;
  code: string;
  lat: number;
  lng: number;
  tier: Tier;
  millionairePopulation: number | null;
  priceToIncome: number;
  grossRentalYield: number;
  mortgagePercentIncome: number;
  affordabilityIndex: number;
  economicGrowthRate: number;
  percentMillionaires: number | null;
  indices: Record<string, number>;
  weightedScore: number;
  recommendation: string;
}

export interface AxisOption {
  value: string;
  label: string;
}

export type ModelWeights = Record<string, number>;

export const INDEX_KEYS = [
  'millionairePopulation',
  'priceToIncome',
  'grossRentalYield',
  'mortgagePercentIncome',
  'affordabilityIndex',
  'economicGrowthRate',
] as const;

export const INDEX_LABELS: Record<string, string> = {
  millionairePopulation: 'Millionaire Population',
  priceToIncome: 'Price-to-Income Ratio',
  grossRentalYield: 'Gross Rental Yield',
  mortgagePercentIncome: 'Mortgage % of Income',
  affordabilityIndex: 'Affordability Index',
  economicGrowthRate: 'Economic Growth Rate',
};

export const INDEX_HIGHER_BETTER: Record<string, boolean> = {
  millionairePopulation: true,
  priceToIncome: false,
  grossRentalYield: true,
  mortgagePercentIncome: false,
  affordabilityIndex: false,
  economicGrowthRate: false,
};

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  millionairePopulation: 25,
  priceToIncome: 15,
  grossRentalYield: 20,
  mortgagePercentIncome: 10,
  affordabilityIndex: 20,
  economicGrowthRate: 10,
};

export const TIER_CONFIG: Record<Tier, { label: string; color: string; bgColor: string }> = {
  prime:      { label: 'Prime',      color: '#16a34a', bgColor: '#dcfce7' },
  secondary:  { label: 'Secondary',  color: '#d97706', bgColor: '#fef3c7' },
  monitoring: { label: 'Monitoring', color: '#6b7280', bgColor: '#f3f4f6' },
  excluded:   { label: 'Excluded',   color: '#dc2626', bgColor: '#fee2e2' },
};

export interface Region {
  name: string;
  countries: string[];
  insight: string;
}
