import type { MetricDef } from '../model/score';

export interface MarketRow {
  name: string;
  iso2: string | null;   // null = "no map pin" (explicitly allowed)
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
  /** How the market entered the decoder: a starting country or an AI suggestion. */
  origin?: 'seed' | 'recommended';
  /**
   * Set when the market is a city or resort rather than a country. `iso2` then
   * holds the parent country (flag, country context) and lat/lng the city.
   */
  place?: MarketPlace;
  /** Summer UHNW traffic evidence for the market (city decoders). */
  summer?: SummerTraffic;
}

export interface MarketPlace {
  kind: 'city';
  /** The parent country's name, e.g. "France" for Nice. */
  country: string;
}

/** One sample of a seasonal series: a fortnight's start date or a month label, and its value. */
export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Where ultra-high-net-worth audiences spend the summer, from flight and
 * vessel tracking. Every block is optional: a city may have jets but no sea.
 */
export interface SummerTraffic {
  jets?: {
    /** Airports counted, as "ICAO name". */
    airports: string[];
    /** Private-jet arrivals per two days, Jun–Sep average. */
    summerPer2Days: number;
    /** Same, off-season (Oct–May) average; null when not measured. */
    offPer2Days: number | null;
    /** summer ÷ off-season; null when not measured. */
    uplift: number | null;
    /** Estimated private-jet arrivals over Jun–Sep (122 days). */
    seasonArrivals: number;
    /** Fortnightly samples (label = fortnight start, ISO date). */
    series: SeriesPoint[];
    peak: string;
    /** OpenSky capture rate used for the correction; null = uncorrected. */
    captureRate: number | null;
    /** Share of private arrivals on GCC-registered aircraft (0–1). */
    gccShare: number | null;
  };
  yachts?: {
    /** Coastal hubs measured, e.g. "Porto Cervo". */
    sites: string[];
    /** Pleasure-craft hours per month in the hubs' waters, Jun–Sep average. */
    summerHoursPerMonth: number;
    offHoursPerMonth: number;
    uplift: number | null;
    /** Monthly series (label = month number 1–12 as text). */
    series: SeriesPoint[];
    peakMonth: number;
    year: number;
  };
  /** Plain-language notes and caveats shown under the card. */
  notes?: string[];
}

/** Overrides the score-based split: see lib/model/allocate.ts. Keyed by market name. */
export interface FixedAllocation {
  fixed: Record<string, number>;  // absolute amounts, taken off the top
  shares: Record<string, number>; // relative shares of the remainder
}

/** Version-level context for the AI market analysis. Admin-entered. */
export interface VersionContext {
  industry?: string; // "Real estate development", "Tourism & destination marketing"
  brief?: string;    // what is being marketed, to whom, and why
  objective?: string; // "Qualified investment leads", "Awareness", ...
  destination?: { iso2: string; name: string; lat: number; lng: number };
}

/** One AI market suggestion and what the admin decided about it. */
export interface RecommendationItem {
  iso2: string;
  name: string;
  fit: number; // 0–100, the AI's judgement of fit for the brief
  lookalike: number; // 0–100 percentile of similarity to the starting countries
  closestSeed: string | null;
  headline: string;
  reasons: string[];
  risks: string[];
  status: 'suggested' | 'included' | 'excluded';
}

export interface RecommendationSet {
  generatedAt: string;
  model: string; // the model that wrote it, or 'lookalike' when AI was unavailable
  summary: string;
  items: RecommendationItem[];
  seedNotes?: Array<{ iso2: string; note: string }>;
}

/** Which allocation model a version uses. See lib/model/allocation.ts. */
export type AllocationModel = 'workbook' | 'score' | 'optimised';

/** Human controls per market ("media expertise"), v2 models only. */
export interface MarketControl {
  priority?: number; // 0.5–2 multiplier, default 1
  reason?: string;
  lock?: number; // fixed amount, taken off the top
  min?: number;
  max?: number;
  setBy?: string;
  setAt?: string; // ISO date
}

/** Planning assumptions for the optimised model. */
export interface PlanningSettings {
  frequency?: number; // effective frequency κ, default 3
  perMarketFrequency?: Record<string, number>;
  /** Multiplies CPM values into the budget currency. Default 1. */
  cpmToBudgetRate?: number;
  /** Strength of Market Tier as priority: h = (tier / median tier)^γ. Fitted per version. */
  tierGamma?: number;
  /** Population snapshot (by market name) for audience = ratio × population. */
  population?: { values: Record<string, number>; year?: number };
}

export interface VersionConfig {
  name: string;          // "Qatar Decoder"
  slug: string;          // "qatar" — ^[a-z0-9-]+$
  currency: string;      // "USD", "AED", ...
  defaultBudget: number; // > 0
  metrics: MetricDef[];
  markets: MarketRow[];
  allocation?: FixedAllocation;
  context?: VersionContext;
  /** Default 'workbook' (exact Excel parity). */
  model?: AllocationModel;
  /** Allocation universe: the markets statistics are pegged to. Default: all markets. */
  universe?: string[];
  marketControls?: Record<string, MarketControl>;
  planning?: PlanningSettings;
  /** Concentration p for the score model: share ∝ (q·h)^p. Default 1. */
  concentration?: number;
  /** AI market suggestions made when the decoder was built. */
  recommendations?: RecommendationSet;
}
