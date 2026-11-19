/**
 * Lookalike ranking: how closely each country resembles the decoder's
 * starting countries on public data. Pure and deterministic. This is the
 * shortlist the AI chooses from; it never sees a country outside it.
 */
import { DIMENSIONS, type Scores } from '@/lib/insights/hofstede';
import type { FactKey, FactValue } from '@/lib/insights/facts';
import { median } from '@/lib/model/quality';

export interface LookalikeCountry {
  iso2: string;
  name: string;
  lat: number;
  lng: number;
  facts: Partial<Record<FactKey, FactValue>>;
  culture: Scores | null;
}

export interface FeatureDef {
  key: string;
  label: string;
  weight: number;
  /** Raw value for a country, or null when missing. */
  get: (c: LookalikeCountry, ctx: { distanceKm: number | null }) => number | null;
  log?: boolean;
}

const fact = (k: FactKey) => (c: LookalikeCountry) => c.facts[k]?.value ?? null;

export const FEATURES: FeatureDef[] = [
  { key: 'gdpPppPerHead', label: 'income per head (PPP)', weight: 1.5, get: fact('gdpPppPerHead'), log: true },
  { key: 'spendPerHead', label: 'household spend per head', weight: 1.5, get: fact('spendPerHead'), log: true },
  { key: 'population', label: 'population size', weight: 0.75, get: fact('population'), log: true },
  { key: 'internet', label: 'online population', weight: 0.75, get: fact('internet') },
  { key: 'urban', label: 'urbanisation', weight: 0.5, get: fact('urban') },
  { key: 'over65', label: 'age profile', weight: 0.5, get: fact('over65') },
  { key: 'hdi', label: 'human development', weight: 0.75, get: fact('hdi') },
  { key: 'lifeSatisfaction', label: 'life satisfaction', weight: 0.5, get: fact('lifeSatisfaction') },
  { key: 'gdpGrowth', label: 'economic growth', weight: 0.5, get: fact('gdpGrowth') },
  { key: 'distance', label: 'distance to the destination', weight: 1, get: (_c, ctx) => ctx.distanceKm, log: true },
  ...DIMENSIONS.map((d) => ({
    key: `culture:${d.key}`,
    label: d.label.toLowerCase(),
    weight: 0.35,
    get: (c: LookalikeCountry) => c.culture?.[d.key] ?? null,
  })),
];

export interface LookalikeOptions {
  seeds: string[];
  destination?: { lat: number; lng: number } | null;
  exclude?: string[];
  /** Drops microstates; default 1,000,000 people. */
  minPopulation?: number;
  limit?: number;
}

export interface LookalikeResult {
  iso2: string;
  name: string;
  /** 0–100: more similar to the starting countries than this % of other countries. */
  fit: number;
  coverage: number;
  closestSeed: string | null;
  /** Features where it sits inside the starting countries' range. */
  matches: string[];
  /** Features where it sits outside that range, with the direction. */
  gaps: Array<{ label: string; direction: 'higher' | 'lower' }>;
  distanceKm: number | null;
}

interface Scaled {
  c: LookalikeCountry;
  z: Array<number | null>;
  distanceKm: number | null;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Robust z-scores (median / MAD over the whole universe) for every feature. */
function scale(universe: LookalikeCountry[], destination: LookalikeOptions['destination']): Scaled[] {
  const raw = universe.map((c) => {
    const distanceKm = destination ? haversine(c, destination) : null;
    return {
      c,
      distanceKm,
      x: FEATURES.map((f) => {
        const v = f.get(c, { distanceKm });
        if (v === null || !Number.isFinite(v)) return null;
        if (f.log) return v > 0 ? Math.log(v) : null;
        return v;
      }),
    };
  });
  const stats = FEATURES.map((_, i) => {
    const xs = raw.map((r) => r.x[i]).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const med = median(xs);
    const mad = median(xs.map((v) => Math.abs(v - med)).sort((a, b) => a - b)) * 1.4826;
    return { med, spread: mad > 0 ? mad : 1 };
  });
  return raw.map((r) => ({
    c: r.c,
    distanceKm: r.distanceKm,
    z: r.x.map((v, i) => (v === null ? null : (v - stats[i].med) / stats[i].spread)),
  }));
}

/**
 * Ranks every non-seed country by resemblance to the seeds; fit is the
 * percentile of that resemblance among all candidates. A feature inside
 * the seeds' own range costs nothing beyond a small pull to their median;
 * outside it, the distance to the range counts in full.
 */
export function rankLookalikes(universe: LookalikeCountry[], opts: LookalikeOptions): LookalikeResult[] {
  const seeds = new Set(opts.seeds.map((s) => s.toLowerCase()));
  const exclude = new Set((opts.exclude ?? []).map((s) => s.toLowerCase()));
  const scaled = scale(universe, opts.destination ?? null);
  const seedRows = scaled.filter((s) => seeds.has(s.c.iso2));
  if (!seedRows.length) return [];

  const profile = FEATURES.map((_, i) => {
    const zs = seedRows.map((s) => s.z[i]).filter((v): v is number => v !== null).sort((a, b) => a - b);
    return zs.length ? { med: median(zs), lo: zs[0], hi: zs[zs.length - 1] } : null;
  });
  const totalWeight = FEATURES.reduce((a, f, i) => a + (profile[i] && (f.key !== 'distance' || opts.destination) ? f.weight : 0), 0);

  const featureCost = (i: number, z: number) => {
    const p = profile[i]!;
    const outside = z < p.lo ? p.lo - z : z > p.hi ? z - p.hi : 0;
    return outside + 0.25 * Math.abs(z - p.med);
  };

  const minPop = opts.minPopulation ?? 1_000_000;
  const out: Array<LookalikeResult & { score: number }> = [];
  for (const s of scaled) {
    if (seeds.has(s.c.iso2) || exclude.has(s.c.iso2)) continue;
    const pop = s.c.facts.population?.value;
    if (pop !== undefined && pop < minPop) continue;

    let acc = 0;
    let used = 0;
    const per: Array<{ i: number; cost: number; z: number }> = [];
    FEATURES.forEach((f, i) => {
      const z = s.z[i];
      if (z === null || !profile[i] || (f.key === 'distance' && !opts.destination)) return;
      const cost = featureCost(i, z);
      acc += f.weight * cost * cost;
      used += f.weight;
      per.push({ i, cost, z });
    });
    if (used === 0) continue;
    const d = Math.sqrt(acc / used);
    const coverage = used / totalWeight;

    // Closest seed by plain z-distance over the features both have.
    let closestSeed: string | null = null;
    let best = Infinity;
    for (const seed of seedRows) {
      let sum = 0;
      let w = 0;
      FEATURES.forEach((f, i) => {
        const a = s.z[i];
        const b = seed.z[i];
        if (a === null || b === null) return;
        sum += f.weight * (a - b) ** 2;
        w += f.weight;
      });
      const dist = w ? Math.sqrt(sum / w) : Infinity;
      if (dist < best || (dist === best && closestSeed !== null && seed.c.name < closestSeed)) {
        best = dist;
        closestSeed = seed.c.name;
      }
    }

    const inside = per.filter((p) => p.z >= profile[p.i]!.lo && p.z <= profile[p.i]!.hi);
    const outsideRange = per
      .filter((p) => p.z < profile[p.i]!.lo || p.z > profile[p.i]!.hi)
      .sort((a, b) => b.cost - a.cost || a.i - b.i);
    out.push({
      // Sort key: the unrounded fit (log scale keeps very poor fits ordered).
      score: -(d * d) / 2 + Math.log(0.6 + 0.4 * coverage),
      iso2: s.c.iso2,
      name: s.c.name,
      fit: 0, // set from the rank below
      coverage,
      closestSeed,
      matches: inside.sort((a, b) => a.cost - b.cost || FEATURES[b.i].weight - FEATURES[a.i].weight || a.i - b.i).slice(0, 4).map((p) => FEATURES[p.i].label),
      gaps: outsideRange.slice(0, 3).map((p) => ({
        label: FEATURES[p.i].label,
        direction: p.z > profile[p.i]!.hi ? 'higher' : 'lower',
      })),
      distanceKm: s.distanceKm,
    });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const n = out.length;
  out.forEach((r, i) => (r.fit = n > 1 ? Math.round((100 * (n - 1 - i)) / (n - 1)) : 100));
  return out.slice(0, opts.limit ?? 40).map((r) => {
    const { score, ...rest } = r;
    void score;
    return rest;
  });
}
