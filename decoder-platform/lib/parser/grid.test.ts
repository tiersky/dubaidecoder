import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids, norm } from './grid';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');

describe('loadWorkbookGrids', () => {
  const grids = loadWorkbookGrids(readFileSync(EGYPT));

  it('loads all sheets by name', () => {
    const model = grids.find((g) => g.name === 'Model');
    expect(model).toBeDefined();
    expect(grids.length).toBeGreaterThan(5);
  });

  it('exposes cell values at 0-indexed coordinates', () => {
    const model = grids.find((g) => g.name === 'Model')!;
    expect(model.cells[1][9]).toBe('City');          // J2
    expect(model.cells[2][9]).toBe('Russia');        // J3
    expect(model.cells[2][11]).toBe(2230000);        // L3
    expect(model.cells[0][23]).toBe(10000000);       // X1 (budget)
  });

  it('exposes Excel-formatted text where available', () => {
    const model = grids.find((g) => g.name === 'Model')!;
    // X1 is formatted "[$AED] #,##0" — rendered text contains the currency
    expect(model.formatted[0][23]).toMatch(/AED/);
  });

  it('normalizes labels', () => {
    expect(norm(' Model Weight ')).toBe('model weight');
    expect(norm('St  Dv')).toBe('st dv');
    expect(norm(null)).toBe('');
    expect(norm(42)).toBe('42');
  });
});
