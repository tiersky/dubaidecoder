import { z } from 'zod';
import type { VersionConfig } from './types';

const metricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  direction: z.enum(['higher', 'lower']),
  source: z.string().optional(),
  description: z.string().optional(),
  kind: z.enum(['measure', 'ratio', 'score']).optional(),
  transform: z.enum(['none', 'log']).optional(),
  scale: z.object({ min: z.number(), max: z.number() }).optional(),
  role: z.enum(['audienceSize', 'audienceRatio', 'cpm', 'priority']).optional(),
});

const controlSchema = z.object({
  priority: z.number().min(0.1).max(10).optional(),
  reason: z.string().max(300).optional(),
  lock: z.number().min(0).optional(),
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
  setBy: z.string().max(200).optional(),
  setAt: z.string().max(40).optional(),
});

const marketSchema = z.object({
  name: z.string().min(1),
  iso2: z.string().length(2).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  enabled: z.boolean(),
  values: z.record(z.string(), z.number().nullable()),
});

const configSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, hyphens'),
  currency: z.string().min(1),
  defaultBudget: z.number().positive(),
  metrics: z.array(metricSchema).min(1),
  markets: z.array(marketSchema).min(2),
  allocation: z
    .object({
      fixed: z.record(z.string(), z.number().min(0)),
      shares: z.record(z.string(), z.number().min(0)),
    })
    .optional(),
  context: z
    .object({
      industry: z.string().max(120).optional(),
      brief: z.string().max(2000).optional(),
    })
    .optional(),
  model: z.enum(['workbook', 'score', 'optimised']).optional(),
  universe: z.array(z.string().min(1)).optional(),
  marketControls: z.record(z.string(), controlSchema).optional(),
  planning: z
    .object({
      frequency: z.number().positive().max(50).optional(),
      perMarketFrequency: z.record(z.string(), z.number().positive().max(50)).optional(),
      cpmToBudgetRate: z.number().positive().optional(),
      tierGamma: z.number().min(0).max(3).optional(),
    })
    .optional(),
  concentration: z.number().min(0.25).max(4).optional(),
});

export function validateConfig(
  input: unknown
): { ok: true; config: VersionConfig } | { ok: false; errors: string[] } {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const cfg = parsed.data;
  const errors: string[] = [];

  const keys = cfg.metrics.map((m) => m.key);
  if (new Set(keys).size !== keys.length) errors.push('metrics: duplicate metric keys');

  const reservedKeys = new Set(['score', 'split', 'budget']);
  for (const key of keys) {
    if (reservedKeys.has(key))
      errors.push(`metrics: reserved metric key "${key}" (rename the workbook column)`);
  }

  const marketNames = cfg.markets.map((m) => m.name);
  if (new Set(marketNames).size !== marketNames.length)
    errors.push('markets: duplicate market names');

  if (cfg.markets.filter((m) => m.enabled).length < 2)
    errors.push('markets: at least 2 markets must be enabled');

  for (const market of cfg.markets) {
    for (const key of keys) {
      if (!(key in market.values))
        errors.push(`markets.${market.name}: missing value entry for metric "${key}"`);
    }
  }

  if (cfg.allocation) {
    const names = new Set(marketNames);
    const listed = [...Object.keys(cfg.allocation.fixed), ...Object.keys(cfg.allocation.shares)];
    for (const n of listed)
      if (!names.has(n)) errors.push(`allocation: unknown market "${n}"`);
    if (new Set(listed).size !== listed.length)
      errors.push('allocation: a market is listed in both fixed and shares');
    for (const n of marketNames)
      if (!listed.includes(n)) errors.push(`allocation: market "${n}" has no fixed amount or share`);
  }

  for (const m of cfg.metrics) {
    if (m.kind === 'score' && !m.scale) errors.push(`metrics.${m.key}: a judgment score needs a declared scale`);
    if (m.scale && !(m.scale.max > m.scale.min)) errors.push(`metrics.${m.key}: scale max must be above min`);
  }
  for (const role of ['audienceSize', 'audienceRatio', 'cpm', 'priority'] as const) {
    if (cfg.metrics.filter((m) => m.role === role).length > 1) errors.push(`metrics: more than one "${role}" metric`);
  }
  const names = new Set(marketNames);
  for (const n of cfg.universe ?? []) if (!names.has(n)) errors.push(`universe: unknown market "${n}"`);
  for (const [n, c] of Object.entries(cfg.marketControls ?? {})) {
    if (!names.has(n)) errors.push(`marketControls: unknown market "${n}"`);
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) errors.push(`marketControls.${n}: min is above max`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: cfg as VersionConfig };
}
