import { SheetGrid, Cell, norm } from './grid';

export interface MarketLine {
  row: number;
  name: string;
  values: (number | null)[];
}

export interface OutputLine {
  name: string;
  score: number | null;
  split: number | null;
}

export interface IndexLine {
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
  outputs: OutputLine[] | null;
  indexTable: IndexLine[] | null;
  budget: { amount: number; currency: string | null } | null;
}

const AVG_RE = /^(avg|average)\.?$/;
const STDEV_RE = /^st\.? ?d\.?e?v\.?$/;
const WEIGHT_RE = /^model weight/;
const SOURCE_RE = /^data source$/;
const INDEX_RE = /^index table$/;

function num(v: Cell | undefined): number | null {
  return typeof v === 'number' ? v : null;
}

function text(v: Cell | undefined): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

export function findModelBlocks(grids: SheetGrid[]): ModelBlockCandidate[] {
  const out: ModelBlockCandidate[] = [];
  for (const grid of grids) {
    if (grid.hidden) continue; // hidden sheets hold deprecated/alternate model copies, not the live one
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
          const values = metricCols.map((c) => num(cells[r]?.[c]));
          if (!values.some((v) => v !== null)) continue;
          indexTable.push({ name, values });
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
    outputs,
    indexTable,
    budget,
  };
}
