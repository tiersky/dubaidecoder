import { computeModel } from '../model/score';
import { VersionConfig } from '../config/types';
import { ModelBlockCandidate } from './detect';

export interface VerificationCheck {
  market: string;
  kind: 'index' | 'score' | 'split';
  metricKey?: string;
  computed: number;
  workbook: number;
  delta: number;
}

export interface VerificationReport {
  checks: VerificationCheck[];
  maxIndexDelta: number;
  maxScoreDelta: number;
  maxSplitDelta: number;
  ok: boolean;
  reasons: string[];
}

export const TOLERANCES = { index: 0.002, score: 0.02, split: 0.001 };

export function verifyAgainstWorkbook(
  config: VersionConfig,
  candidate: ModelBlockCandidate
): VerificationReport {
  const result = computeModel(
    config.markets.map((m) => ({ name: m.name, enabled: m.enabled, values: m.values })),
    config.metrics
  );
  const byName = new Map(result.markets.map((m) => [m.name.trim().toLowerCase(), m]));
  const checks: VerificationCheck[] = [];

  if (candidate.indexTable) {
    for (const row of candidate.indexTable) {
      const computed = byName.get(row.name.trim().toLowerCase());
      if (!computed) continue;
      config.metrics.forEach((metric, j) => {
        const wb = row.values[j];
        if (wb === null) return;
        const c = computed.indices[metric.key];
        checks.push({
          market: row.name,
          kind: 'index',
          metricKey: metric.key,
          computed: c,
          workbook: wb,
          delta: Math.abs(c - wb),
        });
      });
    }
  }

  if (candidate.outputs) {
    for (const o of candidate.outputs) {
      const computed = byName.get(o.name.trim().toLowerCase());
      if (!computed) continue;
      if (o.score !== null)
        checks.push({
          market: o.name,
          kind: 'score',
          computed: computed.score,
          workbook: o.score,
          delta: Math.abs(computed.score - o.score),
        });
      if (o.split !== null)
        checks.push({
          market: o.name,
          kind: 'split',
          computed: computed.split,
          workbook: o.split,
          delta: Math.abs(computed.split - o.split),
        });
    }
  }

  const maxOf = (kind: VerificationCheck['kind']) =>
    Math.max(0, ...checks.filter((c) => c.kind === kind).map((c) => c.delta));
  const maxIndexDelta = maxOf('index');
  const maxScoreDelta = maxOf('score');
  const maxSplitDelta = maxOf('split');

  const reasons: string[] = [];
  if (checks.length === 0) {
    reasons.push('nothing to compare: workbook has no readable outputs or index table');
  }
  const worst = (kind: VerificationCheck['kind']) =>
    checks.filter((c) => c.kind === kind).sort((a, b) => b.delta - a.delta)[0];
  for (const [kind, tol, max] of [
    ['index', TOLERANCES.index, maxIndexDelta],
    ['score', TOLERANCES.score, maxScoreDelta],
    ['split', TOLERANCES.split, maxSplitDelta],
  ] as const) {
    if (max > tol) {
      const w = worst(kind)!;
      reasons.push(
        `${kind}: max delta ${max.toFixed(4)} exceeds tolerance ${tol}` +
          ` (${w.market}${w.metricKey ? ' · ' + w.metricKey : ''}:` +
          ` computed ${w.computed.toFixed(4)} vs workbook ${w.workbook.toFixed(4)})`
      );
    }
  }

  return {
    checks,
    maxIndexDelta,
    maxScoreDelta,
    maxSplitDelta,
    ok: reasons.length === 0,
    reasons,
  };
}
