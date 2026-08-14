import type { MetricDef } from '../model/score';

export interface MarketRow {
  name: string;
  iso2: string | null;   // null = "no map pin" (explicitly allowed)
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
}

export interface VersionConfig {
  name: string;          // "Qatar Decoder"
  slug: string;          // "qatar" — ^[a-z0-9-]+$
  currency: string;      // "USD", "AED", ...
  defaultBudget: number; // > 0
  metrics: MetricDef[];
  markets: MarketRow[];
}
