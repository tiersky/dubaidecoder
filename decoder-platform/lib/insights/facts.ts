/**
 * Country context facts: definitions shared by the server fetchers and the
 * client UI. Values come from free, keyless public sources (IMF World
 * Economic Outlook, World Bank Indicators, Our World in Data).
 */

export type FactKey =
  | 'gdpGrowth'
  | 'inflation'
  | 'gdpPppPerHead'
  | 'gdpPerHead'
  | 'spendPerHead'
  | 'population'
  | 'internet'
  | 'urban'
  | 'over65'
  | 'lifeSatisfaction'
  | 'hdi';

export type FactGroup = 'economy' | 'society';
export type FactUnit = 'pct' | 'usd' | 'intl' | 'people' | 'score10' | 'index';

export interface FactDef {
  key: FactKey;
  label: string;
  group: FactGroup;
  unit: FactUnit;
  source: 'IMF' | 'World Bank' | 'Our World in Data';
  about: string;
}

export const FACTS: FactDef[] = [
  { key: 'gdpGrowth', label: 'Real GDP growth', group: 'economy', unit: 'pct', source: 'IMF', about: 'Annual change in real GDP. IMF World Economic Outlook; the current and later years are projections.' },
  { key: 'inflation', label: 'Inflation', group: 'economy', unit: 'pct', source: 'IMF', about: 'Annual average change in consumer prices. IMF World Economic Outlook.' },
  { key: 'gdpPppPerHead', label: 'GDP per head (PPP)', group: 'economy', unit: 'intl', source: 'IMF', about: 'GDP per person at purchasing-power parity, in international dollars: what incomes buy locally.' },
  { key: 'gdpPerHead', label: 'GDP per head', group: 'economy', unit: 'usd', source: 'World Bank', about: 'GDP per person in current US dollars.' },
  { key: 'spendPerHead', label: 'Household spend per head', group: 'economy', unit: 'usd', source: 'World Bank', about: 'Household final consumption per person, current US dollars (total consumption divided by population).' },
  { key: 'population', label: 'Population', group: 'society', unit: 'people', source: 'World Bank', about: 'Total population.' },
  { key: 'internet', label: 'Online population', group: 'society', unit: 'pct', source: 'World Bank', about: 'Share of people using the internet.' },
  { key: 'urban', label: 'Urban population', group: 'society', unit: 'pct', source: 'World Bank', about: 'Share of people living in urban areas.' },
  { key: 'over65', label: 'Aged 65 and over', group: 'society', unit: 'pct', source: 'World Bank', about: 'Share of the population aged 65 and above.' },
  { key: 'lifeSatisfaction', label: 'Life satisfaction', group: 'society', unit: 'score10', source: 'Our World in Data', about: 'Average self-reported life evaluation on a 0–10 ladder (World Happiness Report).' },
  { key: 'hdi', label: 'Human Development Index', group: 'society', unit: 'index', source: 'Our World in Data', about: 'UNDP composite of life expectancy, education and income, 0–1.' },
];

export interface FactValue {
  value: number;
  year: number;
  /** IMF figures for the current year onwards are projections. */
  projected?: boolean;
}

export interface SeriesPoint {
  year: number;
  value: number;
  projected: boolean;
}

export interface CountryData {
  iso2: string;
  facts: Partial<Record<FactKey, FactValue>>;
  /** Yearly IMF series around the current year, for the outlook chart. */
  outlook: { gdpGrowth: SeriesPoint[]; inflation: SeriesPoint[] };
}

export interface CountryDataResponse {
  countries: Record<string, CountryData>;
  /** Sources that failed this time; their facts are simply absent. */
  unavailable: string[];
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatFact(unit: FactUnit, value: number): string {
  switch (unit) {
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'usd':
      return `$${whole.format(value)}`;
    case 'intl':
      return `$${whole.format(value)}`;
    case 'people':
      return compact.format(value);
    case 'score10':
      return value.toFixed(2);
    case 'index':
      return value.toFixed(3);
  }
}
