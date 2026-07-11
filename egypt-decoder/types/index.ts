export interface Country {
  name: string;
  code: string;
  population: number;
  lat: number;
  lng: number;
  // Raw model inputs (see Egypt_decoder.xlsx sheet "Model")
  audienceRatio: number; // Audience ratio / population (GWI)
  visitors2025: number; // 2025 visitors to Egypt (Brief)
  yoyGrowth: number; // YoY visitor growth, decimal (Brief)
  departuresToVisitors: number; // Tourist departures to 2025 visitors ratio (Statbase)
  outboundSpends: number; // Outbound trip spends, USD billion (Statista)
  mediaCost: number | null; // Media cost benchmark CPM, USD (Magna Global); null = no benchmark
  gdpPerCapita: number; // USD (IMF)
  flightSeats: number; // Avg daily flight seating capacity to Egypt (Aviationstack)
  touristDepartures: number; // Total outbound tourist departures
  marketTier: number; // 10 / 6 / 3 / 1 (Brief)
  // Model outputs (workbook values at default weights)
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
  'audienceRatio',
  'visitors2025',
  'yoyGrowth',
  'departuresToVisitors',
  'outboundSpends',
  'mediaCost',
  'gdpPerCapita',
  'flightSeats',
  'marketTier',
] as const;

export type IndexKey = typeof INDEX_KEYS[number];

export const INDEX_LABELS: Record<string, string> = {
  audienceRatio: 'Audience Ratio / Pop.',
  visitors2025: '2025 Visitors',
  yoyGrowth: 'YoY Visitor Growth',
  departuresToVisitors: 'Departures to 2025 Visitors Ratio',
  outboundSpends: 'Outbound Trip Spends (USD B)',
  mediaCost: 'Media Cost Benchmark CPM',
  gdpPerCapita: 'GDP per Capita',
  flightSeats: 'Daily Flight Seating Capacity',
  marketTier: 'Market Tier',
};

// Per-metric data sources (workbook "Data Source" row)
export const INDEX_SOURCES: Record<string, string> = {
  population: 'World Bank / national statistics',
  touristDepartures: 'Statbase',
  audienceRatio: 'GWI',
  visitors2025: 'Brief',
  yoyGrowth: 'Brief',
  departuresToVisitors: 'Statbase',
  outboundSpends: 'Statista',
  mediaCost: 'Magna Global',
  gdpPerCapita: 'IMF',
  flightSeats: 'Aviationstack',
  marketTier: 'Brief',
};

// Plain-language explanation per metric, shown in UI tooltips
export const INDEX_DESCRIPTIONS: Record<string, string> = {
  population:
    'Total population of the market.',
  touristDepartures:
    'Total outbound tourist departures from this market (all destinations).',
  audienceRatio:
    'Share of the market’s population matching the Egypt travel audience profile, relative to population.',
  visitors2025:
    'Total visitors from this market to Egypt in 2025.',
  yoyGrowth:
    'Year-on-year growth of 2025 visitors vs. 2024.',
  departuresToVisitors:
    'Outbound tourist departures from this market divided by its 2025 visitors to Egypt — headroom to convert existing travellers.',
  outboundSpends:
    'Total outbound travel spend of this market, in USD billion.',
  mediaCost:
    'Average media cost benchmark (CPM, USD). Cheaper media scores higher in the model.',
  gdpPerCapita:
    'GDP per capita in USD — proxy for spending power.',
  flightSeats:
    'Average daily airline seating capacity into Egypt (Fri 3–Sat 4 Jul 2026 average).',
  marketTier:
    'Strategic priority tier from the brief: 10 / 6 / 3 / 1.',
};

// Model weights from the Egypt workbook (row "Model Weight").
// YoY growth and flight seats are indexed but carry no weight by default —
// they can be dialled up in the Model Weights panel.
export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  audienceRatio: 10,
  visitors2025: 10,
  yoyGrowth: 0,
  departuresToVisitors: 5,
  outboundSpends: 5,
  mediaCost: 5,
  gdpPerCapita: 5,
  flightSeats: 0,
  marketTier: 20,
};
