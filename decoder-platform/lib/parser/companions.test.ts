import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from './grid';
import { findModelBlocks } from './detect';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const ALULA = path.resolve(process.cwd(), '../alula-decoder/source/Al Ula - Country Decoder.xlsx');

describe('companions — Egypt', () => {
  const c = findModelBlocks(loadWorkbookGrids(readFileSync(EGYPT)))[0];

  it('extracts the output block', () => {
    expect(c.outputs).toHaveLength(25);
    expect(c.outputs![0].name).toBe('Russia');
    expect(c.outputs![0].score).toBeCloseTo(41.231890052598956, 6);
    expect(c.outputs![0].split).toBeCloseTo(0.0571942106003571, 8);
  });

  it('extracts the index table by absolute column position', () => {
    expect(c.indexTable).toHaveLength(25);
    expect(c.indexTable![0].name).toBe('Russia');
    expect(c.indexTable![0].values[0]).toBeCloseTo(0.3917981368523249, 8);
    expect(c.indexTable![0].values[8]).toBeCloseTo(0.951254701898896, 8);
  });

  it('finds the budget cell with currency from number format', () => {
    expect(c.budget).toEqual({ amount: 10000000, currency: 'AED' });
  });
});

describe('companions — AlUla', () => {
  const c = findModelBlocks(loadWorkbookGrids(readFileSync(ALULA))).find(
    (x) => x.sheetName === 'Country Decoder - Final 2503205'
  )!;

  it('extracts outputs', () => {
    expect(c.outputs).toHaveLength(15);
    expect(c.outputs![0].name).toBe('Saudi Arabia');
    expect(c.outputs![0].score).toBeCloseTo(36.8931651650509, 6);
  });

  it('extracts the index table', () => {
    expect(c.indexTable).not.toBeNull();
    expect(c.indexTable).toHaveLength(15);
    const saudi = c.indexTable!.find((r) => r.name === 'Saudi Arabia')!;
    expect(saudi.values[0]).toBeCloseTo(0.722990074066, 6);
  });

  it('finds the budget amount', () => {
    expect(c.budget?.amount).toBe(10000000);
  });
});
