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
