import { describe, it, expect, vi, beforeEach } from 'vitest';

const storageApi = {
  upload: vi.fn().mockResolvedValue({ error: null }),
  download: vi.fn(),
  copy: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
};
vi.mock('../supabase/admin', () => ({
  serviceClient: () => ({ storage: { from: () => storageApi } }),
}));

import {
  validateWorkbookFile, putDraftWorkbook, copyDraftToRevision, MAX_WORKBOOK_BYTES,
} from './workbooks';

const XLSX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

describe('validateWorkbookFile', () => {
  it('accepts zip-magic bytes', () => expect(validateWorkbookFile(XLSX_BYTES)).toBeNull());
  it('rejects wrong magic', () =>
    expect(validateWorkbookFile(new Uint8Array([1, 2, 3, 4]))).toMatch(/not an \.xlsx/i));
  it('rejects oversize', () => {
    const big = new Uint8Array(MAX_WORKBOOK_BYTES + 1);
    big.set(XLSX_BYTES);
    expect(validateWorkbookFile(big)).toMatch(/10 ?MB/i);
  });
});

describe('putDraftWorkbook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uploads to <slug>/draft.xlsx with upsert', async () => {
    const path = await putDraftWorkbook('egypt', XLSX_BYTES);
    expect(path).toBe('egypt/draft.xlsx');
    expect(storageApi.upload).toHaveBeenCalledWith('egypt/draft.xlsx', XLSX_BYTES, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });
  });
  it('throws on invalid bytes before touching storage', async () => {
    await expect(putDraftWorkbook('egypt', new Uint8Array([9]))).rejects.toThrow(/not an \.xlsx/i);
    expect(storageApi.upload).not.toHaveBeenCalled();
  });
});

describe('copyDraftToRevision', () => {
  it('removes any stale target then copies', async () => {
    const path = await copyDraftToRevision('egypt', 3);
    expect(path).toBe('egypt/rev-3.xlsx');
    expect(storageApi.remove).toHaveBeenCalledWith(['egypt/rev-3.xlsx']);
    expect(storageApi.copy).toHaveBeenCalledWith('egypt/draft.xlsx', 'egypt/rev-3.xlsx');
  });
});
