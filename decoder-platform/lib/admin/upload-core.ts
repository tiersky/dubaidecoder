// Pure upload-core: no supabase, no next imports. Everything here is testable
// in isolation and is what the (thin) server actions call into.
import { loadWorkbookGrids } from '../parser/grid';
import { findModelBlocksDetailed, ModelBlockCandidate, NearMiss } from '../parser/detect';
import { assembleConfig } from '../parser/assemble';
import { verifyAgainstWorkbook, VerificationReport } from '../parser/verify';
import { validateConfig } from '../config/validate';
import { VersionConfig } from '../config/types';

export interface CandidateSummary {
  index: number;
  sheetName: string;
  marketCount: number;
  metricCount: number;
  headers: string[];
}

export interface DraftBase {
  slug: string;
  name: string;
  currency?: string;
  defaultBudget?: number;
}

export interface BuiltDraft {
  config: VersionConfig;
  warnings: string[];
  verify: VerificationReport;
  sourceSheet: string;
  sourceIndex: number;
}

export interface DraftEdits {
  name?: string;
  currency?: string;
  defaultBudget?: number;
  weights?: Record<string, number>;
  directions?: Record<string, 'higher' | 'lower'>;
  labels?: Record<string, string>;
  marketEnabled?: Record<string, boolean>;
}

export function detectCandidates(
  bytes: Uint8Array
): { candidates: ModelBlockCandidate[]; nearMisses: NearMiss[] } {
  return findModelBlocksDetailed(loadWorkbookGrids(bytes));
}

export function candidateSummaries(candidates: ModelBlockCandidate[]): CandidateSummary[] {
  return candidates.map((c, index) => ({
    index,
    sheetName: c.sheetName,
    marketCount: c.markets.length,
    metricCount: c.headers.length,
    headers: c.headers,
  }));
}

export function buildDraft(
  candidates: ModelBlockCandidate[],
  index: number,
  base: DraftBase
): { ok: true; draft: BuiltDraft } | { ok: false; errors: string[] } {
  const candidate = candidates[index];
  if (!candidate) return { ok: false, errors: [`no candidate at index ${index}`] };
  const result = assembleConfig(candidate, {
    slug: base.slug,
    name: base.name,
    currency: base.currency ?? candidate.budget?.currency ?? 'USD',
    defaultBudget: base.defaultBudget ?? candidate.budget?.amount ?? 1_000_000,
  });
  if (!result.config) return { ok: false, errors: result.errors };
  return {
    ok: true,
    draft: {
      config: result.config,
      warnings: result.warnings,
      verify: verifyAgainstWorkbook(result.config, candidate),
      sourceSheet: candidate.sheetName,
      sourceIndex: index,
    },
  };
}

export function applyDraftEdits(
  config: VersionConfig,
  edits: DraftEdits
): { ok: true; config: VersionConfig } | { ok: false; errors: string[] } {
  const next: VersionConfig = structuredClone(config);
  if (edits.name !== undefined) next.name = edits.name;
  if (edits.currency !== undefined) next.currency = edits.currency;
  if (edits.defaultBudget !== undefined) next.defaultBudget = edits.defaultBudget;

  for (const [key, patch] of [
    ['weights', (m: (typeof next.metrics)[number], v: number) => (m.weight = v)],
    ['directions', (m: (typeof next.metrics)[number], v: 'higher' | 'lower') => (m.direction = v)],
    ['labels', (m: (typeof next.metrics)[number], v: string) => (m.label = v)],
  ] as const) {
    for (const [k, v] of Object.entries(edits[key] ?? {})) {
      const metric = next.metrics.find((m) => m.key === k);
      if (!metric) return { ok: false, errors: [`unknown metric key: ${k}`] };
      patch(metric, v as never);
    }
  }

  for (const [name, enabled] of Object.entries(edits.marketEnabled ?? {})) {
    const market = next.markets.find((m) => m.name === name);
    if (!market) return { ok: false, errors: [`unknown market: ${name}`] };
    market.enabled = enabled;
  }

  const v = validateConfig(next);
  return v.ok ? { ok: true, config: v.config } : { ok: false, errors: v.errors };
}
