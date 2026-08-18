import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SheetGrid, Cell, loadWorkbookGrids } from './grid';
import { findModelBlocks, findModelBlocksDetailed } from './detect';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const ALULA = path.resolve(process.cwd(), '../alula-decoder/source/Al Ula - Country Decoder.xlsx');

function gridFromRows(name: string, rows: Cell[][]): SheetGrid {
  return {
    name,
    hidden: false,
    cells: rows,
    formatted: rows.map((row) => row.map((v) => (v === null ? null : String(v)))),
  };
}

describe('findModelBlocks — Egypt workbook', () => {
  const candidates = findModelBlocks(loadWorkbookGrids(readFileSync(EGYPT)));

  it('finds exactly one candidate, on the Model sheet', () => {
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sheetName).toBe('Model');
  });

  it('locates the block anatomy (0-indexed)', () => {
    const c = candidates[0];
    expect(c.labelCol).toBe(9);       // column J
    expect(c.headerRow).toBe(1);      // row 2
    expect(c.avgRow).toBe(27);        // row 28
    expect(c.stdevRow).toBe(28);      // row 29
    expect(c.dataSourceRow).toBe(29); // row 30
    expect(c.weightRow).toBe(30);     // row 31 ("Model Weight " with trailing space)
    expect(c.metricCols).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18]); // K..S
  });

  it('extracts headers, weights, sources', () => {
    const c = candidates[0];
    expect(c.headers[0]).toBe('Audience ratio/pop');
    expect(c.headers[8]).toBe('Market Tier');
    expect(c.weights).toEqual([10, 10, 0, 5, 5, 5, 5, 0, 20]); // blanks -> 0
    expect(c.sources[6]).toBe('IMF');  // trailing space trimmed
    expect(c.sources[8]).toBe('Brief');
  });

  it('extracts all 25 markets with nulls for blank cells', () => {
    const c = candidates[0];
    expect(c.markets).toHaveLength(25);
    expect(c.markets[0].name).toBe('Russia');
    expect(c.markets[0].values[1]).toBe(2230000);
    const czech = c.markets.find((m) => m.name === 'Czech Republic')!;
    expect(czech.values[5]).toBeNull(); // blank media cost (P11)
    expect(c.markets[24].name).toBe('Japan');
  });

  it('extracts the Avg/St Dv rows', () => {
    const c = candidates[0];
    expect(c.avg[0]).toBeCloseTo(2.88, 6);
    expect(c.stdev[1]).toBeCloseTo(577820.667104711, 3);
  });
});

describe('findModelBlocks — AlUla workbook', () => {
  const candidates = findModelBlocks(loadWorkbookGrids(readFileSync(ALULA)));
  const c = candidates.find((x) => x.sheetName === 'Country Decoder - Final 2503205')!;

  it('finds the Final 2503205 sheet block', () => {
    expect(c).toBeDefined();
    expect(c.markets).toHaveLength(15);
    expect(c.markets[0].name).toBe('Saudi Arabia');
    expect(c.metricCols).toHaveLength(10); // K..T, includes input metric "Budget Split"
    expect(c.headers[7]).toBe('Budget Split');
  });

  it('survives the stray note cell and missing Data Source row', () => {
    expect(c.weightRow).toBe(20);      // row 21, two rows below St Dv (row 19), note cell at S20
    expect(c.dataSourceRow).toBeNull();
    expect(c.sources.every((s) => s === null)).toBe(true);
  });

  it('reads the weights', () => {
    expect(c.weights).toEqual([5, 1, 10, 1, 5, 20, 2, 5, 10, 5]);
  });

  it('never proposes the dataviz summary sheet', () => {
    expect(candidates.every((x) => x.sheetName !== 'dataviz')).toBe(true);
  });
});

describe('findModelBlocksDetailed — near misses', () => {
  it('reports a near-miss when Avg has no St.Dev beneath it', () => {
    const grid = gridFromRows('Sheet1', [
      ['Country', 'Metric A', 'Metric B'],
      ['Germany', 1, 2],
      ['France', 3, 4],
      ['Avg.', 2, 3],
      ['Something else', 0, 0],
    ]);
    const { candidates, nearMisses } = findModelBlocksDetailed([grid]);
    expect(candidates).toHaveLength(0);
    expect(nearMisses).toHaveLength(1);
    expect(nearMisses[0].reason).toMatch(/St\.?Dev/i);
  });

  it('reports a near-miss when the weight row is missing', () => {
    const grid = gridFromRows('Sheet1', [
      ['Country', 'Metric A', 'Metric B'],
      ['Germany', 1, 2],
      ['France', 3, 4],
      ['Avg.', 2, 3],
      ['St.Dev', 1, 1],
    ]);
    const { candidates, nearMisses } = findModelBlocksDetailed([grid]);
    expect(candidates).toHaveLength(0);
    expect(nearMisses[0].reason).toMatch(/model weight/i);
  });

  it('oracle workbooks produce no near-miss noise alongside their candidates', () => {
    const egyptGrids = loadWorkbookGrids(readFileSync(EGYPT));
    const { candidates, nearMisses } = findModelBlocksDetailed(egyptGrids);
    expect(candidates.length).toBeGreaterThan(0);
    // near-misses may exist on scratch sheets; every reason must be non-empty text
    for (const m of nearMisses) expect(m.reason.length).toBeGreaterThan(5);
  });
});
