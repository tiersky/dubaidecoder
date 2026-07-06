import { AxisOption } from '@/types';

export const axisOptions: AxisOption[] = [
  { value: 'population', label: 'Population' },
  { value: 'spendsPerTrip', label: 'Spends per Trip' },
  { value: 'touristDeparturesRatio', label: 'Tourist Departures / Population' },
  { value: 'searchVolume', label: "Search Volume – 'Flight to AlUla'" },
  { value: 'gdpGrowth', label: 'GDP Growth' },
  { value: 'disposableIncome', label: 'Disposable Income (USD)' },
  { value: 'mediaCost', label: 'Media Cost' },
  { value: 'globalExplorers', label: 'Global Explorers (M)' },
  { value: 'finalWeightedScore', label: 'Weighted Score' },
  { value: 'percentSplit', label: '% Split' },
];

export const bubbleSizeOptions: AxisOption[] = [
  { value: 'budgetSplit', label: 'Budget Split' },
  { value: 'finalWeightedScore', label: 'Weighted Score' },
  { value: 'population', label: 'Population' },
  { value: 'searchVolume', label: "Search Volume – 'Flight to AlUla'" },
  { value: 'globalExplorers', label: 'Global Explorers (M)' },
  { value: 'disposableIncome', label: 'Disposable Income (USD)' },
];
