import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from './grid';
import { findModelBlocks } from './detect';
import { metricKey, inferDirections, assembleConfig } from './assemble';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const egyptCandidate = findModelBlocks(loadWorkbookGrids(readFileSync(EGYPT)))[0];
const OPTS = { name: 'Egypt Decoder', slug: 'egypt', currency: 'USD', defaultBudget: 10000000 };

describe('metricKey', () => {
  it('camel-cases headers', () => {
    expect(metricKey('Audience ratio/pop')).toBe('audienceRatioPop');
    expect(metricKey('Media Cost Benchmark CPM')).toBe('mediaCostBenchmarkCpm');
    expect(metricKey('Market Tier')).toBe('marketTier');
  });
});

describe('inferDirections — Egypt', () => {
  it('derives lower-is-better for media cost from the index table', () => {
    const directions = inferDirections(egyptCandidate);
    expect(directions[5]).toBe('lower');   // Media Cost Benchmark CPM
    expect(directions[0]).toBe('higher');  // Audience ratio/pop
    expect(directions[8]).toBe('higher');  // Market Tier
  });
});

describe('assembleConfig — Egypt', () => {
  const result = assembleConfig(egyptCandidate, OPTS);

  it('produces a valid config with all 25 markets resolved', () => {
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]); // every Egypt market name resolves (incl. "Khazakhstan")
    expect(result.config).not.toBeNull();
    expect(result.config!.markets).toHaveLength(25);
    expect(result.config!.metrics).toHaveLength(9);
  });

  it('resolves the workbook misspelling Khazakhstan to kz', () => {
    const kz = result.config!.markets.find((m) => m.name === 'Khazakhstan')!;
    expect(kz.iso2).toBe('kz');
    expect(kz.lat).not.toBeNull();
  });

  it('carries weights, sources, and values through', () => {
    const media = result.config!.metrics.find((m) => m.key === 'mediaCostBenchmarkCpm')!;
    expect(media.weight).toBe(5);
    expect(media.direction).toBe('lower');
    expect(media.source).toBe('Magna Global');
    const czech = result.config!.markets.find((m) => m.name === 'Czech Republic')!;
    expect(czech.values.mediaCostBenchmarkCpm).toBeNull();
    expect(czech.values.visitors2025 ?? czech.values['2025Visitors']).toBeDefined();
  });

  it('flags unresolvable countries as warnings, not errors', () => {
    const tampered = {
      ...egyptCandidate,
      markets: egyptCandidate.markets.map((m, i) =>
        i === 0 ? { ...m, name: 'Atlantis' } : m
      ),
    };
    const r = assembleConfig(tampered, OPTS);
    expect(r.config).not.toBeNull();
    expect(r.warnings.some((w) => w.includes('Atlantis'))).toBe(true);
    expect(r.config!.markets[0].iso2).toBeNull();
  });
});
