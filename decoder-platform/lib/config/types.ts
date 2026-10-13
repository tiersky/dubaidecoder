import type { MetricDef } from '../model/score';

export interface MarketRow {
  name: string;
  iso2: string | null;   // null = "no map pin" (explicitly allowed)
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
}

/** Overrides the score-based split: see lib/model/allocate.ts. Keyed by market name. */
export interface FixedAllocation {
  fixed: Record<string, number>;  // absolute amounts, taken off the top
  shares: Record<string, number>; // relative shares of the remainder
}

export interface VersionConfig {
  name: string;          // "Qatar Decoder"
  slug: string;          // "qatar" — ^[a-z0-9-]+$
  currency: string;      // "USD", "AED", ...
  defaultBudget: number; // > 0
  metrics: MetricDef[];
  markets: MarketRow[];
  allocation?: FixedAllocation;
}
