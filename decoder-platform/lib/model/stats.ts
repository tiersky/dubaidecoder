export interface SampleStats {
  avg: number;
  stdev: number;
  n: number;
}

/** Excel AVERAGE / STDEV.S over non-null values. */
export function sampleStats(values: Array<number | null>): SampleStats {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return { avg: 0, stdev: 0, n: 0 };
  const avg = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { avg, stdev: 0, n };
  const ss = xs.reduce((a, b) => a + (b - avg) ** 2, 0);
  return { avg, stdev: Math.sqrt(ss / (n - 1)), n };
}
