import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { detectCandidates, candidateSummaries, buildDraft, applyDraftEdits } from './upload-core';

// Reuse the exact workbook-path convention from lib/parser/assemble.test.ts (and
// its sibling parser tests): resolved from process.cwd(), not __dirname.
const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const egyptBytes = new Uint8Array(readFileSync(EGYPT));

describe('detectCandidates + buildDraft (Egypt oracle)', () => {
  it('detects at least one block and assembles a valid config', () => {
    const { candidates } = detectCandidates(egyptBytes);
    expect(candidates.length).toBeGreaterThan(0);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.draft.config.slug).toBe('egypt');
    expect(built.draft.config.markets.length).toBeGreaterThanOrEqual(15);
    expect(built.draft.verify.ok).toBe(true); // reproduces the workbook
    expect(built.draft.sourceIndex).toBe(0);
  });

  it('defaults budget/currency from the workbook when base omits them', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    expect(built.draft.config.defaultBudget).toBeGreaterThan(0);
    expect(built.draft.config.currency).toMatch(/^[A-Z]{3}$/);
  });
});

describe('candidateSummaries', () => {
  it('summarizes each candidate with index, sheet, counts, headers', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const summaries = candidateSummaries(candidates);
    expect(summaries).toHaveLength(candidates.length);
    expect(summaries[0]).toEqual({
      index: 0,
      sheetName: candidates[0].sheetName,
      marketCount: candidates[0].markets.length,
      metricCount: candidates[0].headers.length,
      headers: candidates[0].headers,
    });
  });
});

describe('buildDraft — invalid index', () => {
  it('reports an error rather than throwing when the index is out of range', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, candidates.length + 5, { slug: 'egypt', name: 'Egypt Decoder' });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.length).toBeGreaterThan(0);
  });
});

describe('detectCandidates on garbage', () => {
  it('yields no candidates and does not throw on a minimal non-model xlsx', async () => {
    // Build a real tiny xlsx in-memory with SheetJS so the zip signature is valid.
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['hello', 'world']]), 'S');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const { candidates, nearMisses } = detectCandidates(bytes);
    expect(candidates).toHaveLength(0);
    expect(Array.isArray(nearMisses)).toBe(true);
  });
});

describe('applyDraftEdits', () => {
  it('patches weight/direction/enabled and re-validates', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const key = built.draft.config.metrics[0].key;
    const marketName = built.draft.config.markets[0].name;
    const edited = applyDraftEdits(built.draft.config, {
      weights: { [key]: 42 },
      directions: { [key]: 'lower' },
      marketEnabled: { [marketName]: false },
      defaultBudget: 5_000_000,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.config.metrics[0].weight).toBe(42);
    expect(edited.config.metrics[0].direction).toBe('lower');
    expect(edited.config.markets[0].enabled).toBe(false);
    expect(edited.config.defaultBudget).toBe(5_000_000);
  });

  it('patches labels, name, and currency', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const key = built.draft.config.metrics[0].key;
    const edited = applyDraftEdits(built.draft.config, {
      name: 'Egypt Decoder v2',
      currency: 'AED',
      labels: { [key]: 'Renamed Label' },
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.config.name).toBe('Egypt Decoder v2');
    expect(edited.config.currency).toBe('AED');
    expect(edited.config.metrics[0].label).toBe('Renamed Label');
  });

  it('does not mutate the input config', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const key = built.draft.config.metrics[0].key;
    const originalWeight = built.draft.config.metrics[0].weight;
    applyDraftEdits(built.draft.config, { weights: { [key]: originalWeight + 999 } });
    expect(built.draft.config.metrics[0].weight).toBe(originalWeight);
  });

  it('rejects unknown weight keys', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const edited = applyDraftEdits(built.draft.config, { weights: { doesNotExist: 1 } });
    expect(edited.ok).toBe(false);
  });

  it('rejects unknown market names', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const edited = applyDraftEdits(built.draft.config, { marketEnabled: { Narnia: false } });
    expect(edited.ok).toBe(false);
  });
});
