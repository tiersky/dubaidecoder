/**
 * Geometry for the 3D culture views: Kogut–Singh cultural distance and the
 * orbit layout built on it. Pure functions so the scene stays a thin renderer.
 */
import { DIMENSIONS, allProfiles, type DimensionKey, type Scores } from './hofstede';

let cachedVariance: Scores | null = null;

/** Variance of each dimension across every country with a full profile. */
export function dimensionVariance(): Scores {
  if (cachedVariance) return cachedVariance;
  const profiles = allProfiles();
  const v = {} as Scores;
  for (const { key } of DIMENSIONS) {
    const xs = profiles.map((p) => p.scores[key]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    v[key] = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
  }
  cachedVariance = v;
  return v;
}

/**
 * Kogut–Singh (1988) index: mean variance-scaled squared gap across the six
 * dimensions. 0 = identical; UK–USA is about 0.3, UK–China about 3.4.
 */
export function culturalDistance(a: Scores, b: Scores, variance: Scores = dimensionVariance()): number {
  let sum = 0;
  for (const { key } of DIMENSIONS) sum += (a[key] - b[key]) ** 2 / variance[key];
  return sum / DIMENSIONS.length;
}

export type OrbitMode = 'distance' | DimensionKey;

export interface OrbitBody {
  id: string;
  scores: Scores;
}

export interface OrbitPlacement {
  id: string;
  /** 0–1, fraction of the outermost ring. */
  radius: number;
  /** Radians. Fixed per body so a mode change moves planets only along their spoke. */
  angle: number;
  /** What the radius stands for, for labels: the distance index or the 0–100 score. */
  value: number;
}

/** The ring the outermost planet sits on in distance mode, rounded up to a 0.5 step. */
export function distanceScaleMax(distances: number[]): number {
  const max = Math.max(0, ...distances);
  return Math.max(0.5, Math.ceil(max * 2) / 2);
}

/**
 * Where each planet sits. Angles spread bodies evenly in the order given
 * (callers sort by name so the layout is stable). In distance mode the
 * radius is Kogut–Singh distance to `center` over the scale max; in a
 * dimension mode it is the body's own 0–100 score.
 */
export function orbitLayout(bodies: OrbitBody[], center: Scores, mode: OrbitMode): { placements: OrbitPlacement[]; scaleMax: number } {
  const n = Math.max(1, bodies.length);
  const angleOf = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  if (mode === 'distance') {
    const d = bodies.map((b) => culturalDistance(b.scores, center));
    const scaleMax = distanceScaleMax(d);
    return {
      scaleMax,
      placements: bodies.map((b, i) => ({ id: b.id, radius: d[i] / scaleMax, angle: angleOf(i), value: d[i] })),
    };
  }
  return {
    scaleMax: 100,
    placements: bodies.map((b, i) => ({ id: b.id, radius: b.scores[mode] / 100, angle: angleOf(i), value: b.scores[mode] })),
  };
}
