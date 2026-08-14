import type { MetricDef, MarketInput } from '../score';

export const egyptMetrics: MetricDef[] = [
  { key: 'audienceRatio', label: 'Audience Ratio / Pop.', weight: 5, direction: 'higher', source: 'GWI' },
  { key: 'visitors2025', label: '2025 Visitors', weight: 10, direction: 'higher', source: 'Brief' },
  { key: 'yoyGrowth', label: 'YoY Visitor Growth', weight: 0, direction: 'higher', source: 'Brief' },
  { key: 'departuresToVisitors', label: 'Departures to 2025 Visitors Ratio', weight: 5, direction: 'higher', source: 'Statbase' },
  { key: 'outboundSpends', label: 'Outbound Trip Spends (USD B)', weight: 5, direction: 'higher', source: 'Statista' },
  { key: 'mediaCost', label: 'Media Cost Benchmark CPM', weight: 5, direction: 'lower', source: 'Magna Global' },
  { key: 'gdpPerCapita', label: 'GDP per Capita', weight: 5, direction: 'higher', source: 'IMF' },
  { key: 'flightSeats', label: 'Daily Flight Seating Capacity', weight: 0, direction: 'higher', source: 'Aviationstack' },
  { key: 'marketTier', label: 'Market Tier', weight: 50, direction: 'higher', source: 'Brief' },
];

// [name, audienceRatio, visitors2025, yoyGrowth, departuresToVisitors,
//  outboundSpends, mediaCost, gdpPerCapita, flightSeats, marketTier]
const rows: Array<[string, number, number, number, number, number, number | null, number, number, number]> = [
  ['Russia',         0.11, 2230000, 0.38, 0.1281609195, 38.9,  14,   18525, 3902,  10],
  ['Germany',        0.16, 1880000, 0.11, 0.0114267653, 120.3, 10,   65303, 5900,  50],
  ['Saudi Arabia',   0.20, 1180000, 0.00, 0.0369096027, 31.85, 6.5,  37811, 22461, 15],
  ['Poland',         0.19, 1140000, 0.35, 0.0263206501, 12.8,  4.5,  31336, 999,   10],
  ['Italy',          0.14, 1140000, 0.41, 0.0201463259, 35.7,  7.5,  46505, 2437,  10],
  ['UK',             0.12, 1070000, 0.17, 0.0117024301, 119.2, 11,   61056, 2484,  6],
  ['USA',            0.05, 526000,  0.19, 0.0086871789, 177.8, 16,   94430, 717,   4],
  ['France',         0.07, 507000,  0.31, 0.0100639167, 59.8,  8.5,  52083, 1898,  6],
  ['Czech Republic', 0.28, 495000,  0.03, 0.0657982187, 8.93,  null, 39795, 957,   6],
  ['China',          0.02, 372000,  0.13, 0.0025074143, 250,   7,    14874, 1036,  7],
  ['Jordan',         0.13, 269000,  0.10, 0.1605011933, 1.887, null, 5601,  1852,  3],
  ['Kazakhstan',     0.09, 250000,  0.06, 0.0325945241, 4.05,  null, 17503, 200,   3],
  ['Kuwait',         0.20, 246000,  0.02, 0.0928652321, 13,    5.2,  33164, 2678,  0.3],
  ['Spain',          0.06, 243000,  0.67, 0.0101102558, 106,   6.5,  41563, 1144,  1],
  ['India',          0.01, 163000,  0.20, 0.0052776428, 35,    3.5,  2813,  498,   1],
];

export const egyptMarkets: MarketInput[] = rows.map(
  ([name, audienceRatio, visitors2025, yoyGrowth, departuresToVisitors, outboundSpends, mediaCost, gdpPerCapita, flightSeats, marketTier]) => ({
    name,
    enabled: true,
    values: { audienceRatio, visitors2025, yoyGrowth, departuresToVisitors, outboundSpends, mediaCost, gdpPerCapita, flightSeats, marketTier },
  })
);

// Verified 2026-08-13 against the client workbook (weighted scores to ±0.001,
// splits to ±0.000001 of the recomputed model that matched the workbook's
// displayed values).
export const egyptExpected: Record<string, { score: number; split: number }> = {
  Russia: { score: 46.9906, split: 0.079064 },
  Germany: { score: 74.2067, split: 0.124856 },
  'Saudi Arabia': { score: 56.1815, split: 0.094528 },
  Poland: { score: 47.4059, split: 0.079762 },
  Italy: { score: 46.5121, split: 0.078258 },
  UK: { score: 40.112, split: 0.06749 },
  USA: { score: 32.5416, split: 0.054753 },
  France: { score: 34.582, split: 0.058186 },
  'Czech Republic': { score: 40.6965, split: 0.068473 },
  China: { score: 35.1772, split: 0.059187 },
  Jordan: { score: 31.8855, split: 0.053649 },
  Kazakhstan: { score: 28.5339, split: 0.048009 },
  Kuwait: { score: 29.8323, split: 0.050194 },
  Spain: { score: 27.0468, split: 0.045507 },
  India: { score: 22.6352, split: 0.038085 },
};
