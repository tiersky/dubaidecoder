import { createHash } from 'node:crypto';
import type { VersionConfig } from '../config/types';
import { deriveDashboard } from '../dashboard/derive';
import { gwiMarketView, waveSpan } from '../gwi/view';

/**
 * Everything the AI is allowed to know about one market, computed
 * deterministically from the published config. The prompt is built from
 * this object and nothing else, so its fingerprint is the cache key: any
 * change to weights, budget, markets or industry produces a new analysis.
 */
export interface MarketContext {
  version: {
    name: string;
    industry: string | null;
    brief: string | null;
    currency: string;
    totalBudget: number;
    marketCount: number;
    activeMarketCount: number;
    fixedSplit: boolean;
    /** Optional: older contexts (and their cache fingerprints) don't carry these. */
    objective?: string | null;
    destination?: string | null;
  };
  market: {
    name: string;
    funded: boolean;
    sharePct: number;
    budget: number;
    budgetRank: number | null;
    weightedScore: number;
    scoreRank: number | null;
    /** Set for city or resort markets: country-level data describes this country. */
    country?: string;
  };
  metrics: Array<{
    label: string;
    description: string | null;
    source: string | null;
    betterWhen: 'higher' | 'lower';
    weightPct: number;
    value: number | null;
    rank: number | null; // 1 = best among active markets, in the metric's own direction
    of: number;
    peerMedian: number | null;
    index: number; // 0–1, direction-adjusted: higher always favours this market
    contribution: number; // share of this market's score from this metric, 0–1
  }>;
  drivers: { strengths: string[]; weaknesses: string[] };
  peers: Array<{ name: string; sharePct: number }>;
  /** Summer UHNW traffic (flight and vessel tracking), city decoders only. */
  summer?: SummerContext;
  /** GWI survey audience for the market's country. */
  audience?: AudienceContext;
}

export interface SummerContext {
  privateJets?: {
    airports: string[];
    arrivalsPer2DaysSummer: number;
    arrivalsPer2DaysOffSeason: number | null;
    summerUplift: number | null;
    estimatedArrivalsJunSep: number;
    peakFortnightStarting: string;
    gccRegisteredShare: number | null;
    /** 1 = most summer private-jet arrivals among the decoder's markets with jet data. */
    rank: number;
    of: number;
  };
  yachts?: {
    hubs: string[];
    pleasureCraftHoursPerMonthSummer: number;
    summerUplift: number | null;
    peakMonth: string;
    year: number;
    rank: number;
    of: number;
  };
  notes?: string[];
}

export interface AudienceContext {
  source: string;
  country: string;
  readsCountryOf?: string;
  audience: string;
  definition: string | null;
  people: number | null;
  shareOfInternetUsers: number | null;
  respondents: number | null;
  indicative: boolean;
  otherAudiences: Array<{ name: string; people: number; shareOfInternetUsers: number }>;
  sameAudienceIn: Array<{ country: string; people: number; shareOfInternetUsers: number }>;
  panels: Array<{
    title: string;
    respondents: number;
    indicative: boolean;
    answers: Array<{ answer: string; pct: number; decoderAverage: number | null; index: number }>;
  }>;
  notSurveyedHere: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rankBy<T>(all: T[], value: (t: T) => number | undefined, mine: number): { rank: number; of: number } {
  const vals = all.map(value).filter((v): v is number => typeof v === 'number');
  return { rank: vals.filter((v) => v > mine).length + 1, of: vals.length };
}

function summerContext(config: VersionConfig, marketName: string): SummerContext | undefined {
  const market = config.markets.find((m) => m.name === marketName);
  const s = market?.summer;
  if (!s) return undefined;
  const active = config.markets.filter((m) => m.enabled);
  const out: SummerContext = {};
  if (s.jets) {
    out.privateJets = {
      airports: s.jets.airports,
      arrivalsPer2DaysSummer: round(s.jets.summerPer2Days, 1),
      arrivalsPer2DaysOffSeason: s.jets.offPer2Days === null ? null : round(s.jets.offPer2Days, 1),
      summerUplift: s.jets.uplift === null ? null : round(s.jets.uplift, 2),
      estimatedArrivalsJunSep: Math.round(s.jets.seasonArrivals),
      peakFortnightStarting: s.jets.peak,
      gccRegisteredShare: s.jets.gccShare === null ? null : round(s.jets.gccShare * 100, 1),
      ...rankBy(active, (m) => m.summer?.jets?.summerPer2Days, s.jets.summerPer2Days),
    };
  }
  if (s.yachts) {
    out.yachts = {
      hubs: s.yachts.sites,
      pleasureCraftHoursPerMonthSummer: Math.round(s.yachts.summerHoursPerMonth),
      summerUplift: s.yachts.uplift === null ? null : round(s.yachts.uplift, 2),
      peakMonth: MONTHS[s.yachts.peakMonth - 1],
      year: s.yachts.year,
      ...rankBy(active, (m) => m.summer?.yachts?.summerHoursPerMonth, s.yachts.summerHoursPerMonth),
    };
  }
  if (s.notes?.length) out.notes = s.notes;
  return out;
}

function audienceContext(config: VersionConfig, iso2: string | null): AudienceContext | undefined {
  const v = gwiMarketView(config.gwi, iso2, config.markets.map((m) => m.iso2));
  if (!v) return undefined;
  const size = v.audience.size;
  return {
    source: `GWI Core survey, internet users 16–64, ${waveSpan(v.waves)}. Shares are of the audience in ${v.country.name}; index compares with all internet users across the ${v.baseCountries} countries fetched (100 = average).`,
    country: v.country.name,
    ...(v.proxyOf && { readsCountryOf: v.proxyOf.toUpperCase() }),
    audience: v.audience.name,
    definition: v.audience.description ?? null,
    people: size ? size.size : null,
    shareOfInternetUsers: size ? size.share : null,
    respondents: size ? size.sample : null,
    indicative: v.audience.low,
    otherAudiences: v.others.map((o) => ({ name: o.name, people: o.size.size, shareOfInternetUsers: o.size.share })),
    sameAudienceIn: v.reference.map((r) => ({ country: r.name, people: r.size.size, shareOfInternetUsers: r.size.share })),
    panels: v.panels.map((p) => ({
      title: p.title,
      respondents: p.sample,
      indicative: p.low,
      answers: p.bars.map((b) => ({ answer: b.label, pct: b.pct, decoderAverage: b.avg === null ? null : round(b.avg, 1), index: Math.round(b.index) })),
    })),
    notSurveyedHere: v.missing,
  };
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildMarketContext(config: VersionConfig, marketName: string): MarketContext | null {
  const vm = deriveDashboard(config);
  const market = vm.markets.find((m) => m.name === marketName);
  if (!market) return null;

  const active = vm.markets.filter((m) => m.enabled);
  const funded = active
    .map((m) => ({ name: m.name, split: m.split }))
    .filter((m) => m.split > 0)
    .sort((a, b) => b.split - a.split);
  const totalWeight = config.metrics.reduce((sum, m) => sum + m.weight, 0) || 1;
  const byScore = [...active].sort((a, b) => b.score - a.score);

  const metrics = config.metrics.map((metric) => {
    const value = market.values[metric.key] ?? null;
    const peerValues = active
      .map((m) => m.values[metric.key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const better = (v: number) =>
      metric.direction === 'lower' ? v < (value as number) : v > (value as number);
    const rank = value === null || !market.enabled ? null : peerValues.filter(better).length + 1;
    const index = market.indices[metric.key] ?? 0;
    const contribution = market.score > 0 ? (metric.weight * index) / market.score : 0;
    return {
      label: metric.label,
      description: metric.description ?? null,
      source: metric.source ?? null,
      betterWhen: metric.direction,
      weightPct: round((metric.weight / totalWeight) * 100, 1),
      value,
      rank,
      of: peerValues.length,
      peerMedian: median(peerValues),
      index: round(index, 3),
      contribution: round(contribution, 3),
    };
  });

  // Weighted metrics only: a 0-weight metric cannot move the allocation.
  const weighted = metrics.filter((m) => m.weightPct > 0);
  const strengths = weighted
    .filter((m) => m.index >= 0.55)
    .sort((a, b) => b.weightPct * b.index - a.weightPct * a.index)
    .map((m) => m.label);
  const weaknesses = weighted
    .filter((m) => m.index < 0.45)
    .sort((a, b) => b.weightPct * (1 - b.index) - a.weightPct * (1 - a.index))
    .map((m) => m.label);

  const isFunded = market.enabled && market.split > 0;
  const budgetRank = isFunded ? funded.findIndex((m) => m.name === market.name) + 1 : null;
  const scoreRank = market.enabled ? byScore.findIndex((m) => m.name === market.name) + 1 : null;

  const summer = summerContext(config, market.name);
  const audience = audienceContext(config, market.iso2);

  return {
    version: {
      name: config.name,
      industry: config.context?.industry ?? null,
      brief: config.context?.brief ?? null,
      currency: config.currency,
      totalBudget: config.defaultBudget,
      marketCount: config.markets.length,
      activeMarketCount: active.length,
      fixedSplit: Boolean(config.allocation),
      ...(config.context?.objective && { objective: config.context.objective }),
      ...(config.context?.destination && { destination: config.context.destination.name }),
    },
    market: {
      name: market.name,
      funded: isFunded,
      sharePct: isFunded ? round(market.split * 100, 2) : 0,
      budget: isFunded ? Math.round(market.split * config.defaultBudget) : 0,
      budgetRank,
      weightedScore: round(market.score, 2),
      scoreRank,
      ...(market.place && { country: market.place.country }),
    },
    metrics,
    drivers: { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4) },
    peers: funded.slice(0, 5).map((m) => ({ name: m.name, sharePct: round(m.split * 100, 2) })),
    ...(summer && { summer }),
    ...(audience && { audience }),
  };
}

/** Bump when the prompt or output shape changes, so stale analyses regenerate. */
export const PROMPT_VERSION = 2;

export function contextFingerprint(ctx: MarketContext): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: PROMPT_VERSION, ctx }))
    .digest('hex');
}
