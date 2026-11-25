/**
 * GWI (globalwebindex.com) audience data attached to a decoder. The admin
 * defines audiences and chart panels; the numbers are fetched once (at
 * publish, or with the builder's refresh button) and stored in the version,
 * so a dashboard view never calls GWI. Every GWI number is country level:
 * city markets read their parent country.
 */

/** One condition: respondents who answered any of `datapoints` to `question`. */
export interface GwiCondition {
  question: string;
  datapoints: string[];
  suffixes?: string[];
  not?: boolean;
}

/** GWI audience expression: conditions joined with and / or, nestable. */
export type GwiExpression = { and: GwiNode[] } | { or: GwiNode[] };
export type GwiNode = GwiCondition | GwiExpression;

export interface GwiAudience {
  /** Stable key inside the decoder, ^[a-z0-9-]+$. */
  key: string;
  name: string;
  /** Plain-language definition shown under the chart. */
  description?: string;
  expression: GwiExpression;
  /** The saved audience's id in the GWI account, once synced. */
  gwiId?: string;
}

export interface GwiDatapointRef {
  code: string;
  label: string;
  /** For destination datapoints: the country it names (iso2), hidden for that country's own residents. */
  home?: string;
}

/** A chart: the share of an audience answering each datapoint of one question, per country. */
export interface GwiPanel {
  key: string;
  title: string;
  /** Namespaced question code, e.g. "q32203" (core) or "gwi-travel.q4425". */
  question: string;
  datapoints: GwiDatapointRef[];
  /** Frequency variant of the question, when it has them. */
  suffix?: string;
  /** Audience key; the panel describes this audience in each country. */
  audience: string;
}

export interface GwiConfig {
  /** Quarterly waves pooled for every number, e.g. ["q4_2025", …, "q3_2026"]. */
  waves: string[];
  audiences: GwiAudience[];
  /** The audience sized per country on the dashboard. */
  primaryAudience: string;
  panels: GwiPanel[];
  /**
   * Extra countries fetched for comparison but not decoder markets, by iso2:
   * e.g. the UAE and Saudi Arabia as source markets for a Dubai developer.
   */
  reference?: string[];
  results?: GwiResults;
}

/** Audience size in one country. */
export interface GwiSize {
  /** People in the audience (GWI's weighted universe estimate). */
  size: number;
  /** Respondents behind the estimate. */
  sample: number;
  /** All internet users 16–64 in the country, per GWI. */
  universe: number;
  /** size ÷ universe, 0–100. */
  share: number;
}

/** One datapoint for the audience in one country. */
export interface GwiCell {
  /** Share of the audience answering this datapoint, 0–100. */
  pct: number;
  /** Against all internet users across the decoder's countries (100 = average). */
  index: number;
  /** Respondents in the audience in that country (the base of `pct`). */
  sample: number;
}

export interface GwiResults {
  fetchedAt: string;
  /** GWI calls the fetch used (each counts against the contract allowance). */
  calls: number;
  waves: string[];
  /** Countries fetched, by lower-case iso2. */
  locations: Record<string, { code: string; name: string }>;
  /** iso2 of markets GWI doesn't survey. */
  unsupported: string[];
  /** Audience key → iso2 → size. */
  sizes: Record<string, Record<string, GwiSize>>;
  /** Panel key → iso2 → datapoint code → cell. */
  panels: Record<string, Record<string, Record<string, GwiCell>>>;
  /** Panels whose fetch failed, with the reason (the rest still publish). */
  errors?: Record<string, string>;
}

/** Below this many respondents a number isn't shown. */
export const GWI_MIN_SAMPLE = 30;
/** Below this many respondents a number is shown as indicative. */
export const GWI_LOW_SAMPLE = 100;
