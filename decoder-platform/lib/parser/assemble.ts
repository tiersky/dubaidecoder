import { MetricDef, Direction } from '../model/score';
import { normalCdf } from '../model/normal';
import { VersionConfig, MarketRow } from '../config/types';
import { validateConfig } from '../config/validate';
import { resolveCountry } from '../geo/resolve';
import { ModelBlockCandidate } from './detect';

export function metricKey(header: string): string {
  const words = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('');
}

export function inferDirections(candidate: ModelBlockCandidate): Direction[] {
  return candidate.metricCols.map((_, j) => {
    const byName: Direction = /cost|cpm/i.test(candidate.headers[j]) ? 'lower' : 'higher';
    const avg = candidate.avg[j];
    const sd = candidate.stdev[j];
    if (!candidate.indexTable || avg === null || sd === null || sd <= 0) return byName;
    let higherErr = 0;
    let lowerErr = 0;
    let n = 0;
    for (const idxRow of candidate.indexTable) {
      const market = candidate.markets.find(
        (m) => m.name.trim().toLowerCase() === idxRow.name.trim().toLowerCase()
      );
      const x = market?.values[j];
      const idx = idxRow.values[j];
      if (x == null || idx == null) continue;
      const phi = normalCdf(x, avg, sd);
      higherErr += Math.abs(phi - idx);
      lowerErr += Math.abs(1 - phi - idx);
      if (++n >= 5) break;
    }
    if (n === 0) return byName;
    if (higherErr === lowerErr) return byName;
    return higherErr < lowerErr ? 'higher' : 'lower';
  });
}

export interface AssembleOptions {
  name: string;
  slug: string;
  currency: string;
  defaultBudget: number;
}

export interface AssembleResult {
  config: VersionConfig | null;
  warnings: string[];
  errors: string[];
}

export function assembleConfig(
  candidate: ModelBlockCandidate,
  opts: AssembleOptions
): AssembleResult {
  const warnings: string[] = [];
  const directions = inferDirections(candidate);
  const keys = candidate.headers.map(metricKey);

  const metrics: MetricDef[] = candidate.headers.map((label, j) => ({
    key: keys[j],
    label: label.trim(),
    weight: candidate.weights[j],
    direction: directions[j],
    ...(candidate.sources[j] ? { source: candidate.sources[j]! } : {}),
  }));

  const markets: MarketRow[] = candidate.markets.map((m) => {
    const geo = resolveCountry(m.name);
    if (!geo) warnings.push(`unresolved country: "${m.name}" (no map pin)`);
    const values: Record<string, number | null> = {};
    keys.forEach((k, j) => {
      values[k] = m.values[j];
    });
    return {
      name: m.name,
      iso2: geo?.iso2 ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      enabled: true,
      values,
    };
  });

  const v = validateConfig({
    name: opts.name,
    slug: opts.slug,
    currency: opts.currency,
    defaultBudget: opts.defaultBudget,
    metrics,
    markets,
  });
  if (!v.ok) return { config: null, warnings, errors: v.errors };
  return { config: v.config, warnings, errors: [] };
}
