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
