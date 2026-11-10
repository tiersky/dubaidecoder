import { createHash } from 'node:crypto';
import type { VersionConfig } from '../config/types';
import { deriveDashboard } from '../dashboard/derive';

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
  };
  market: {
    name: string;
    funded: boolean;
    sharePct: number;
    budget: number;
    budgetRank: number | null;
    weightedScore: number;
    scoreRank: number | null;
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
    },
    market: {
      name: market.name,
      funded: isFunded,
      sharePct: isFunded ? round(market.split * 100, 2) : 0,
      budget: isFunded ? Math.round(market.split * config.defaultBudget) : 0,
      budgetRank,
      weightedScore: round(market.score, 2),
      scoreRank,
    },
    metrics,
    drivers: { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4) },
    peers: funded.slice(0, 5).map((m) => ({ name: m.name, sharePct: round(m.split * 100, 2) })),
  };
}

/** Bump when the prompt or output shape changes, so stale analyses regenerate. */
export const PROMPT_VERSION = 1;

export function contextFingerprint(ctx: MarketContext): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: PROMPT_VERSION, ctx }))
    .digest('hex');
}
