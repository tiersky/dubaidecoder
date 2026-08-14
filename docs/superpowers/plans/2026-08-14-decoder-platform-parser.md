# Decoder Platform — Plan 2: Workbook Parser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse the country-decoder Excel template into a `VersionConfig`: detect model blocks across sheets, extract markets/metrics/weights/outputs, infer metric directions, and verify the recomputed model against the workbook's own numbers.

**Architecture:** Pure library `decoder-platform/lib/parser/` (grid loader → block detector → companion extraction → config assembly → verification). No UI, no DB — the admin plan wires it up later. Tested end-to-end against the two real client workbooks already in the repo.

**Tech Stack:** SheetJS (`xlsx` npm package), plus the existing `lib/model`, `lib/config`, `lib/geo`.

**Spec:** `docs/superpowers/specs/2026-08-14-decoder-platform-design.md` (section "Workbook pipeline"). Plan 1 (foundation) is merged; the suite is 21 tests green.

## Global Constraints

- All fixture ground-truth values in this plan were measured directly from the two workbooks with openpyxl on 2026-08-14 — never adjust an expected value to make a test pass. If a test fails, the bug is in the implementation. If you become convinced a ground-truth value itself is wrong, STOP and report BLOCKED with evidence.
- Fixture files (read-only, never modify): `../egypt-decoder/source/Egypt_decoder.xlsx` (sheet `Model`) and `../alula-decoder/source/Al Ula - Country Decoder.xlsx` (sheet `Country Decoder - Final 2503205`), paths relative to `decoder-platform/`.
- Real-workbook quirks the code must survive (all present in the fixtures): trailing spaces in marker labels (`"Model Weight "`, `"IMF "`), a missing Data Source row (AlUla), a stray note cell between St Dv and Model Weight rows (AlUla `S20`), an *input* metric literally named "Budget Split" (AlUla) alongside an *output* column of the same name, and blank metric cells (missing CPMs).
- Only new dependency in this plan: `xlsx`.
- Grid coordinates are 0-indexed everywhere in code and tests (Excel row 2 = index 1, column K = index 10).
- Commit after every task.

---

### Task 1: xlsx dependency + sheet grid loader

**Files:**
- Create: `decoder-platform/lib/parser/grid.ts`
- Test: `decoder-platform/lib/parser/grid.test.ts`

**Interfaces:**
- Produces (later tasks import from `./grid`):

```ts
export type Cell = string | number | null;
export interface SheetGrid {
  name: string;
  cells: Cell[][];                 // row-major, 0-indexed, rectangular per row range
  formatted: (string | null)[][];  // Excel-rendered text (cell.w) or null
}
export function loadWorkbookGrids(data: Buffer | Uint8Array): SheetGrid[];
export function norm(v: Cell): string; // trim, lowercase, collapse inner whitespace
```

- [ ] **Step 1: Install**

```bash
cd decoder-platform && npm install xlsx
```

- [ ] **Step 2: Write the failing test** — `decoder-platform/lib/parser/grid.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure** — `npm test` — Expected: FAIL, `grid.ts` missing.

- [ ] **Step 4: Implement** — `decoder-platform/lib/parser/grid.ts`:

```ts
import * as XLSX from 'xlsx';

export type Cell = string | number | null;

export interface SheetGrid {
  name: string;
  cells: Cell[][];
  formatted: (string | null)[][];
}

export function loadWorkbookGrids(data: Buffer | Uint8Array): SheetGrid[] {
  const wb = XLSX.read(data, { type: 'buffer', cellText: true });
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const ref = sheet['!ref'];
    if (!ref) return { name, cells: [], formatted: [] };
    const range = XLSX.utils.decode_range(ref);
    const cells: Cell[][] = [];
    const formatted: (string | null)[][] = [];
    for (let r = 0; r <= range.e.r; r++) {
      const row: Cell[] = [];
      const frow: (string | null)[] = [];
      for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (!cell || cell.v === undefined || cell.v === null) {
          row.push(null);
          frow.push(null);
          continue;
        }
        row.push(typeof cell.v === 'number' ? cell.v : String(cell.v));
        frow.push(typeof cell.w === 'string' ? cell.w : null);
      }
      cells.push(row);
      formatted.push(frow);
    }
    return { name, cells, formatted };
  });
}

export function norm(v: Cell): string {
  return v === null ? '' : String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}
```

- [ ] **Step 5: Run tests** — Expected: PASS (25 total). If the formatted-text test fails with null, check that `cellText: true` is set on `XLSX.read`.

- [ ] **Step 6: Commit**

```bash
git add decoder-platform/lib/parser decoder-platform/package.json decoder-platform/package-lock.json
git commit -m "Add workbook grid loader on SheetJS"
```

---

### Task 2: Model-block detection

**Files:**
- Create: `decoder-platform/lib/parser/detect.ts`
- Test: `decoder-platform/lib/parser/detect.test.ts`

**Interfaces:**
- Consumes: `SheetGrid`, `Cell`, `norm` from `./grid` (Task 1).
- Produces (Tasks 3-5 extend/consume):

```ts
export interface MarketLine { row: number; name: string; values: (number | null)[] }
export interface ModelBlockCandidate {
  sheetName: string;
  labelCol: number;
  headerRow: number;
  avgRow: number;
  stdevRow: number;
  weightRow: number;
  dataSourceRow: number | null;
  metricCols: number[];
  headers: string[];
  markets: MarketLine[];
  weights: number[];               // blank weight cell -> 0
  sources: (string | null)[];
  avg: (number | null)[];
  stdev: (number | null)[];
}
export function findModelBlocks(grids: SheetGrid[]): ModelBlockCandidate[]; // sorted by market count desc
```

**Fingerprint:** a cell whose norm is `avg`/`average`, the cell directly below it norming to a St Dv variant, and a row within the next 6 rows whose cell in the same column starts with `model weight`. The header row is found by walking up from the Avg row through contiguous non-empty text label cells; the top of that run is the header. Metric columns run right from the label column while header cells are non-empty, stopping at the first empty header (this is what separates inputs from the Weighted Score / % Split output block, and keeps AlUla's *input* metric named "Budget Split").

- [ ] **Step 1: Write the failing test** — `decoder-platform/lib/parser/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from './grid';
import { findModelBlocks } from './detect';

const EGYPT = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
const ALULA = path.resolve(process.cwd(), '../alula-decoder/source/Al Ula - Country Decoder.xlsx');

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
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `detect.ts` missing.

- [ ] **Step 3: Implement** — `decoder-platform/lib/parser/detect.ts`:

```ts
import { SheetGrid, Cell, norm } from './grid';

export interface MarketLine {
  row: number;
  name: string;
  values: (number | null)[];
}

export interface ModelBlockCandidate {
  sheetName: string;
  labelCol: number;
  headerRow: number;
  avgRow: number;
  stdevRow: number;
  weightRow: number;
  dataSourceRow: number | null;
  metricCols: number[];
  headers: string[];
  markets: MarketLine[];
  weights: number[];
  sources: (string | null)[];
  avg: (number | null)[];
  stdev: (number | null)[];
}

const AVG_RE = /^(avg|average)\.?$/;
const STDEV_RE = /^st\.? ?d\.?e?v\.?$/;
const WEIGHT_RE = /^model weight/;
const SOURCE_RE = /^data source$/;

function num(v: Cell | undefined): number | null {
  return typeof v === 'number' ? v : null;
}

function text(v: Cell | undefined): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export function findModelBlocks(grids: SheetGrid[]): ModelBlockCandidate[] {
  const out: ModelBlockCandidate[] = [];
  for (const grid of grids) {
    const { cells } = grid;
    for (let r = 0; r < cells.length; r++) {
      const row = cells[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (!AVG_RE.test(norm(row[c]))) continue;
        if (!STDEV_RE.test(norm(cells[r + 1]?.[c] ?? null))) continue;
        let weightRow = -1;
        for (let w = r + 2; w <= r + 6 && w < cells.length; w++) {
          if (WEIGHT_RE.test(norm(cells[w]?.[c] ?? null))) {
            weightRow = w;
            break;
          }
        }
        if (weightRow === -1) continue;
        const candidate = buildCandidate(grid, r, c, weightRow);
        if (candidate) out.push(candidate);
      }
    }
  }
  return out.sort((a, b) => b.markets.length - a.markets.length);
}

function buildCandidate(
  grid: SheetGrid,
  avgRow: number,
  labelCol: number,
  weightRow: number
): ModelBlockCandidate | null {
  const { cells } = grid;

  // Walk up from Avg through the contiguous run of text label cells;
  // the topmost is the header row.
  let top = avgRow;
  while (top - 1 >= 0 && text(cells[top - 1]?.[labelCol]) !== null) top--;
  const headerRow = top;
  if (headerRow >= avgRow - 1) return null; // need header + at least 2 market rows

  // Metric columns: contiguous non-empty headers right of the label column.
  const metricCols: number[] = [];
  const headers: string[] = [];
  for (let c = labelCol + 1; c < (cells[headerRow]?.length ?? 0); c++) {
    const h = text(cells[headerRow]?.[c]);
    if (h === null) break;
    metricCols.push(c);
    headers.push(h);
  }
  if (metricCols.length < 2) return null;

  const markets: MarketLine[] = [];
  for (let r = headerRow + 1; r < avgRow; r++) {
    const name = text(cells[r]?.[labelCol]);
    if (name === null) continue;
    const values = metricCols.map((c) => num(cells[r]?.[c]));
    if (!values.some((v) => v !== null)) continue;
    markets.push({ row: r, name, values });
  }
  if (markets.length < 2) return null;

  const stdevRow = avgRow + 1;
  let dataSourceRow: number | null = null;
  for (let r = stdevRow + 1; r <= weightRow + 3 && r < cells.length; r++) {
    if (r === weightRow) continue;
    if (SOURCE_RE.test(norm(cells[r]?.[labelCol] ?? null))) {
      dataSourceRow = r;
      break;
    }
  }

  return {
    sheetName: grid.name,
    labelCol,
    headerRow,
    avgRow,
    stdevRow,
    weightRow,
    dataSourceRow,
    metricCols,
    headers,
    markets,
    weights: metricCols.map((c) => num(cells[weightRow]?.[c]) ?? 0),
    sources: metricCols.map((c) =>
      dataSourceRow === null ? null : text(cells[dataSourceRow]?.[c])
    ),
    avg: metricCols.map((c) => num(cells[avgRow]?.[c])),
    stdev: metricCols.map((c) => num(cells[stdevRow]?.[c])),
  };
}
```

- [ ] **Step 4: Run tests** — Expected: PASS. If an Egypt anatomy assertion fails, print the candidate (`console.dir` in a scratch run, not committed) and fix the walk/scan logic — the expected coordinates are measured ground truth. If the Egypt suite finds MORE than one candidate, inspect what else matched and tighten only with evidence (e.g. require ≥2 markets — already present).

- [ ] **Step 5: Commit**

```bash
git add decoder-platform/lib/parser && git commit -m "Add model-block detection over sheet grids"
```

---

### Task 3: Companion extraction — outputs, index table, budget

**Files:**
- Modify: `decoder-platform/lib/parser/detect.ts`
- Test: `decoder-platform/lib/parser/companions.test.ts`

**Interfaces:**
- Extends `ModelBlockCandidate` with three fields (consumed by Tasks 4-5):

```ts
export interface OutputLine { name: string; score: number | null; split: number | null }
export interface IndexLine { name: string; values: (number | null)[] }
// added to ModelBlockCandidate:
//   outputs: OutputLine[] | null;
//   indexTable: IndexLine[] | null;
//   budget: { amount: number; currency: string | null } | null;
```

**Rules:** Outputs — scan the header row right of the last metric column for cells norming to `weighted score` and `% split`; per market, read those columns on the market's own row. Index table — scan up to 8 rows below the weight row, columns `labelCol ± 2`, for a cell norming to `index table`; the table's own header row is within the next 3 rows (label-column cell norming to `country` or `city`); its data rows use the SAME absolute metric columns as the block (the Egypt index table omits some header labels, so match by position, not header text). Budget — scan the rows above the header row, columns ≥ labelCol, for the first numeric ≥ 100000; currency is the first `/[A-Z]{3}/` match in that cell's `formatted` text, else null.

- [ ] **Step 1: Write the failing test** — `decoder-platform/lib/parser/companions.test.ts`:

```ts
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
    const saudi = c.indexTable!.find((r) => r.name === 'Saudi Arabia')!;
    expect(saudi.values[0]).toBeCloseTo(0.722990074066, 6);
  });

  it('finds the budget amount', () => {
    expect(c.budget?.amount).toBe(10000000);
  });
});
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (fields missing / undefined).

- [ ] **Step 3: Implement** — add to `buildCandidate` in `detect.ts` (before the return, and add the three fields to the returned object and the interface):

```ts
const INDEX_RE = /^index table$/;

// --- outputs ---
let outputs: OutputLine[] | null = null;
{
  const headerCells = cells[headerRow] ?? [];
  let scoreCol = -1;
  let splitCol = -1;
  for (let c = metricCols[metricCols.length - 1] + 1; c < headerCells.length; c++) {
    const n = norm(headerCells[c]);
    if (n === 'weighted score') scoreCol = c;
    if (n === '% split') splitCol = c;
  }
  if (scoreCol !== -1) {
    outputs = markets.map((m) => ({
      name: m.name,
      score: num(cells[m.row]?.[scoreCol]),
      split: splitCol === -1 ? null : num(cells[m.row]?.[splitCol]),
    }));
  }
}

// --- index table ---
let indexTable: IndexLine[] | null = null;
{
  let titleRow = -1;
  for (let r = weightRow + 1; r <= weightRow + 8 && r < cells.length; r++) {
    for (let c = Math.max(0, labelCol - 2); c <= labelCol + 2; c++) {
      if (INDEX_RE.test(norm(cells[r]?.[c] ?? null))) {
        titleRow = r;
        break;
      }
    }
    if (titleRow !== -1) break;
  }
  if (titleRow !== -1) {
    let tableHeaderRow = -1;
    for (let r = titleRow + 1; r <= titleRow + 3 && r < cells.length; r++) {
      const n = norm(cells[r]?.[labelCol] ?? null);
      if (n === 'country' || n === 'city') {
        tableHeaderRow = r;
        break;
      }
    }
    if (tableHeaderRow !== -1) {
      indexTable = [];
      for (let r = tableHeaderRow + 1; r < cells.length; r++) {
        const name = text(cells[r]?.[labelCol]);
        if (name === null) break;
        indexTable.push({ name, values: metricCols.map((c) => num(cells[r]?.[c])) });
      }
      if (indexTable.length === 0) indexTable = null;
    }
  }
}

// --- budget ---
let budget: { amount: number; currency: string | null } | null = null;
for (let r = 0; r < headerRow && budget === null; r++) {
  for (let c = labelCol; c < (cells[r]?.length ?? 0); c++) {
    const v = num(cells[r]?.[c]);
    if (v !== null && v >= 100000) {
      const fmt = grid.formatted[r]?.[c] ?? '';
      const m = fmt.match(/[A-Z]{3}/);
      budget = { amount: v, currency: m ? m[0] : null };
      break;
    }
  }
}
```

Export `OutputLine` and `IndexLine`, add the three fields to `ModelBlockCandidate`.

- [ ] **Step 4: Run tests** — Expected: PASS (all suites). If the Egypt currency test fails with null, the formatted text isn't rendering the `[$AED]` prefix — check `cellText: true` in `grid.ts` and inspect `grid.formatted[0][23]` in a scratch run before changing any expected value.

- [ ] **Step 5: Commit**

```bash
git add decoder-platform/lib/parser && git commit -m "Extract outputs, index table, and budget from model blocks"
```

---

### Task 4: Config assembly with direction inference

**Files:**
- Create: `decoder-platform/lib/parser/assemble.ts`
- Test: `decoder-platform/lib/parser/assemble.test.ts`

**Interfaces:**
- Consumes: `ModelBlockCandidate` (Tasks 2-3), `resolveCountry` (`../geo/resolve`), `normalCdf` (`../model/normal`), `validateConfig` (`../config/validate`), `MetricDef`/`Direction` (`../model/score`), `VersionConfig`/`MarketRow` (`../config/types`).
- Produces (admin plan + Task 5 consume):

```ts
export function metricKey(header: string): string; // "Audience ratio/pop" -> "audienceRatioPop"
export function inferDirections(candidate: ModelBlockCandidate): Direction[];
export interface AssembleOptions { name: string; slug: string; currency: string; defaultBudget: number }
export interface AssembleResult { config: VersionConfig | null; warnings: string[]; errors: string[] }
export function assembleConfig(candidate: ModelBlockCandidate, opts: AssembleOptions): AssembleResult;
```

**Direction inference:** when the workbook has an index table, derive each metric's direction from it — compute Φ(x, avg, stdev) with the workbook's own Avg/St Dv rows for up to 5 markets and pick whichever of Φ / 1−Φ better matches the workbook's index values. Fall back to the name heuristic (`/cost|cpm/i` → `lower`, else `higher`) when no index table or no usable rows. This makes direction data-derived, not guessed, for every real workbook.

- [ ] **Step 1: Write the failing test** — `decoder-platform/lib/parser/assemble.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `assemble.ts` missing.

- [ ] **Step 3: Implement** — `decoder-platform/lib/parser/assemble.ts`:

```ts
import { MetricDef, Direction } from '../model/score';
import { normalCdf } from '../model/normal';
import { VersionConfig, MarketRow } from '../config/types';
import { validateConfig } from '../config/validate';
import { resolveCountry } from '../geo/resolve';
import { ModelBlockCandidate } from './detect';

export function metricKey(header: string): string {
  const words = header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('');
}

export function inferDirections(candidate: ModelBlockCandidate): Direction[] {
  return candidate.metricCols.map((_, j) => {
    const byName: Direction = /cost|cpm/i.test(candidate.headers[j]) ? 'lower' : 'higher';
    const avg = candidate.avg[j];
    const sd = candidate.stdev[j];
    if (!candidate.indexTable || avg === null || sd === null || sd <= 0) return byName;
    let higherErr = 0;
    let lowerErr = 0;
    let n = 0;
    for (const idxRow of candidate.indexTable) {
      const market = candidate.markets.find(
        (m) => m.name.trim().toLowerCase() === idxRow.name.trim().toLowerCase()
      );
      const x = market?.values[j];
      const idx = idxRow.values[j];
      if (x == null || idx == null) continue;
      const phi = normalCdf(x, avg, sd);
      higherErr += Math.abs(phi - idx);
      lowerErr += Math.abs(1 - phi - idx);
      if (++n >= 5) break;
    }
    if (n === 0) return byName;
    return higherErr <= lowerErr ? 'higher' : 'lower';
  });
}

export interface AssembleOptions {
  name: string;
  slug: string;
  currency: string;
  defaultBudget: number;
}

export interface AssembleResult {
  config: VersionConfig | null;
  warnings: string[];
  errors: string[];
}

export function assembleConfig(
  candidate: ModelBlockCandidate,
  opts: AssembleOptions
): AssembleResult {
  const warnings: string[] = [];
  const directions = inferDirections(candidate);
  const keys = candidate.headers.map(metricKey);

  const metrics: MetricDef[] = candidate.headers.map((label, j) => ({
    key: keys[j],
    label: label.trim(),
    weight: candidate.weights[j],
    direction: directions[j],
    ...(candidate.sources[j] ? { source: candidate.sources[j]! } : {}),
  }));

  const markets: MarketRow[] = candidate.markets.map((m) => {
    const geo = resolveCountry(m.name);
    if (!geo) warnings.push(`unresolved country: "${m.name}" (no map pin)`);
    const values: Record<string, number | null> = {};
    keys.forEach((k, j) => {
      values[k] = m.values[j];
    });
    return {
      name: m.name,
      iso2: geo?.iso2 ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      enabled: true,
      values,
    };
  });

  const v = validateConfig({
    name: opts.name,
    slug: opts.slug,
    currency: opts.currency,
    defaultBudget: opts.defaultBudget,
    metrics,
    markets,
  });
  if (!v.ok) return { config: null, warnings, errors: v.errors };
  return { config: v.config, warnings, errors: [] };
}
```

Note: metric keys are derived from the workbook headers (`audienceRatioPop`, `visitors2025` becomes `2025Visitors` → key `2025Visitors` is invalid camelCase starting with digits — the `metricKey` function as written produces `2025Visitors`. That is acceptable as a `Record` key and zod passes it; do NOT special-case digits. The test asserts via the `??` fallback accordingly.)

- [ ] **Step 4: Run tests** — Expected: PASS. If the Egypt direction test yields 'higher' for media cost, debug `inferDirections` against the workbook's own numbers (Russia media index 0.0429 with raw 14, avg 8.025, sd 3.478 → Φ≈0.957, 1−Φ≈0.043 → 'lower' must win).

- [ ] **Step 5: Commit**

```bash
git add decoder-platform/lib/parser && git commit -m "Assemble VersionConfig from model blocks with inferred directions"
```

---

### Task 5: Verification against workbook outputs

**Files:**
- Create: `decoder-platform/lib/parser/verify.ts`
- Test: `decoder-platform/lib/parser/verify.test.ts`

**Interfaces:**
- Consumes: `computeModel` (`../model/score`), `VersionConfig`, `ModelBlockCandidate`.
- Produces (admin plan consumes for the confirm screen):

```ts
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
  ok: boolean; // false when the workbook offers nothing to check against
}
export const TOLERANCES = { index: 0.002, score: 0.02, split: 0.001 };
export function verifyAgainstWorkbook(config: VersionConfig, candidate: ModelBlockCandidate): VerificationReport;
```

- [ ] **Step 1: Write the failing test** — `decoder-platform/lib/parser/verify.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `verify.ts` missing.

- [ ] **Step 3: Implement** — `decoder-platform/lib/parser/verify.ts`:

```ts
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
  return {
    checks,
    maxIndexDelta,
    maxScoreDelta,
    maxSplitDelta,
    ok:
      checks.length > 0 &&
      maxIndexDelta <= TOLERANCES.index &&
      maxScoreDelta <= TOLERANCES.score &&
      maxSplitDelta <= TOLERANCES.split,
  };
}
```

- [ ] **Step 4: Run tests** — Expected: PASS. **If the AlUla verification genuinely exceeds tolerance after your implementation matches this plan:** do NOT loosen tolerances or fudge — report DONE_WITH_CONCERNS with the top-10 worst checks (market, metric, computed, workbook) from the report; that data decides whether the workbook has a quirk worth handling or the tolerance needs a justified change.

- [ ] **Step 5: Commit**

```bash
git add decoder-platform/lib/parser && git commit -m "Verify recomputed model against workbook outputs"
```

---

## Self-review notes

- Spec coverage (this plan's slice): detect across sheets ✓ (Task 2), companions incl. budget/currency cell ✓ (Task 3), direction inference (spec's auto-guess, upgraded to index-table-derived) ✓ (Task 4), verification with per-cell diffs ✓ (Task 5). Confirm-screen UI, candidate picker UI, malformed-cell UX: admin plan.
- Type consistency: `ModelBlockCandidate` defined in Task 2, extended in Task 3 (three fields), consumed in Tasks 4-5 by those exact names. `AssembleResult.config` nullable; Task 5's tests use the non-null path after Egypt assembly (errors [] proven in Task 4).
- All ground-truth values measured via openpyxl on 2026-08-14, including the trailing-space labels and 0-indexed coordinates.
