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

/** Version-level context for the AI market analysis. Admin-entered. */
export interface VersionContext {
  industry?: string; // "Real estate development", "Tourism & destination marketing"
  brief?: string;    // what is being marketed, to whom, and why
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
}
