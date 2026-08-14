import { z } from 'zod';
import type { VersionConfig } from './types';

const metricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  direction: z.enum(['higher', 'lower']),
  source: z.string().optional(),
  description: z.string().optional(),
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

  if (cfg.markets.filter((m) => m.enabled).length < 2)
    errors.push('markets: at least 2 markets must be enabled');

  for (const market of cfg.markets) {
    for (const key of keys) {
      if (!(key in market.values))
        errors.push(`markets.${market.name}: missing value entry for metric "${key}"`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: cfg as VersionConfig };
}
