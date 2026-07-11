import { AxisOption } from '@/types';

export const axisOptions: AxisOption[] = [
  { value: 'population', label: 'Population' },
  { value: 'visitors2025', label: '2025 Visitors' },
  { value: 'yoyGrowth', label: 'YoY Visitor Growth' },
  { value: 'audienceRatio', label: 'Audience Ratio / Pop.' },
  { value: 'departuresToVisitors', label: 'Departures to 2025 Visitors Ratio' },
  { value: 'outboundSpends', label: 'Outbound Trip Spends (USD B)' },
  { value: 'mediaCost', label: 'Media Cost Benchmark CPM' },
  { value: 'gdpPerCapita', label: 'GDP per Capita (USD)' },
  { value: 'flightSeats', label: 'Daily Flight Seating Capacity' },
  { value: 'touristDepartures', label: 'Tourist Departures' },
  { value: 'finalWeightedScore', label: 'Weighted Score' },
  { value: 'percentSplit', label: '% Split' },
];

export const bubbleSizeOptions: AxisOption[] = [
  { value: 'budgetSplit', label: 'Budget Split' },
  { value: 'finalWeightedScore', label: 'Weighted Score' },
  { value: 'population', label: 'Population' },
  { value: 'visitors2025', label: '2025 Visitors' },
  { value: 'flightSeats', label: 'Daily Flight Seating Capacity' },
  { value: 'gdpPerCapita', label: 'GDP per Capita (USD)' },
];
