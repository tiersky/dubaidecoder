import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from './grid';
import { findModelBlocks } from './detect';
import { assembleConfig } from './assemble';
import { verifyAgainstWorkbook } from './verify';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const ALULA = path.resolve(process.cwd(), '../alula-decoder/source/Al Ula - Country Decoder.xlsx');

function build(file: string, sheet?: string) {
  const candidates = findModelBlocks(loadWorkbookGrids(readFileSync(file)));
  const candidate = sheet ? candidates.find((c) => c.sheetName === sheet)! : candidates[0];
  const { config } = assembleConfig(candidate, {
    name: 'Test',
    slug: 'test',
    currency: 'USD',
    defaultBudget: 10000000,
  });
  return { candidate, config: config! };
}

describe('verifyAgainstWorkbook — Egypt', () => {
  const { candidate, config } = build(EGYPT);
  const report = verifyAgainstWorkbook(config, candidate);

  it('reproduces the workbook, all checks in tolerance', () => {
    expect(report.ok).toBe(true);
    expect(report.maxIndexDelta).toBeLessThan(0.001);
    expect(report.maxScoreDelta).toBeLessThan(0.01);
    expect(report.maxSplitDelta).toBeLessThan(0.0001);
  });

  it('checks every market: 25 x 9 indices + 25 scores + 25 splits', () => {
    expect(report.checks.filter((c) => c.kind === 'index')).toHaveLength(225);
    expect(report.checks.filter((c) => c.kind === 'score')).toHaveLength(25);
    expect(report.checks.filter((c) => c.kind === 'split')).toHaveLength(25);
  });
});

describe('verifyAgainstWorkbook — AlUla', () => {
  const { candidate, config } = build(ALULA, 'Country Decoder - Final 2503205');
  const report = verifyAgainstWorkbook(config, candidate);

  it('reproduces the AlUla workbook', () => {
    expect(report.ok).toBe(true);
    expect(report.maxScoreDelta).toBeLessThan(0.02);
  });
});

describe('verifyAgainstWorkbook — detects tampering', () => {
  it('fails loudly when a weight is wrong', () => {
    const { candidate, config } = build(EGYPT);
    const tampered = {
      ...config,
      metrics: config.metrics.map((m, i) => (i === 0 ? { ...m, weight: 99 } : m)),
    };
    const report = verifyAgainstWorkbook(tampered, candidate);
    expect(report.ok).toBe(false);
    expect(report.maxScoreDelta).toBeGreaterThan(1);
  });
});

describe('verifyAgainstWorkbook — reasons', () => {
  it('explains failures in reasons', () => {
    const { candidate: egyptCandidate, config: egyptConfig } = build(EGYPT);
    // Take the existing passing Egypt config/candidate fixture and corrupt
    // one weight so scores drift past tolerance.
    const bad = structuredClone(egyptConfig);
    bad.metrics[0].weight += 25;
    const report = verifyAgainstWorkbook(bad, egyptCandidate);
    expect(report.ok).toBe(false);
    expect(report.reasons.length).toBeGreaterThan(0);
    expect(report.reasons.join(' ')).toMatch(/exceeds/);
  });

  it('reports empty-comparison as a reason', () => {
    const { candidate: egyptCandidate, config: egyptConfig } = build(EGYPT);
    const noOutputs = { ...egyptCandidate, outputs: null, indexTable: null };
    const report = verifyAgainstWorkbook(egyptConfig, noOutputs);
    expect(report.ok).toBe(false);
    expect(report.reasons[0]).toMatch(/nothing to compare/i);
  });
});
