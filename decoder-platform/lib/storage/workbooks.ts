import { serviceClient } from '../supabase/admin';

export const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const BUCKET = 'workbooks';
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function validateWorkbookFile(bytes: Uint8Array): string | null {
  // xlsx is a zip: PK\x03\x04
  const [a, b, c, d] = bytes;
  if (a !== 0x50 || b !== 0x4b || c !== 0x03 || d !== 0x04)
    return 'not an .xlsx file (bad file signature)';
  if (bytes.length > MAX_WORKBOOK_BYTES) return 'file exceeds the 10 MB limit';
  return null;
}

export function draftWorkbookPath(slug: string): string {
  return `${slug}/draft.xlsx`;
}

function bucket() {
  return serviceClient().storage.from(BUCKET);
}

export async function putDraftWorkbook(slug: string, bytes: Uint8Array): Promise<string> {
  const invalid = validateWorkbookFile(bytes);
  if (invalid) throw new Error(invalid);
  const path = draftWorkbookPath(slug);
  const { error } = await bucket().upload(path, bytes, {
    contentType: XLSX_CONTENT_TYPE,
    upsert: true,
  });
  if (error) throw new Error(`workbook upload failed: ${error.message}`);
  return path;
}

export async function downloadDraftWorkbook(slug: string): Promise<Uint8Array> {
  const { data, error } = await bucket().download(draftWorkbookPath(slug));
  if (error || !data) throw new Error(`workbook download failed: ${error?.message ?? 'no data'}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function copyDraftToRevision(slug: string, revision: number): Promise<string> {
  const target = `${slug}/rev-${revision}.xlsx`;
  await bucket().remove([target]); // stale target from a failed prior attempt; ignore result
  const { error } = await bucket().copy(draftWorkbookPath(slug), target);
  if (error) throw new Error(`workbook promote failed: ${error.message}`);
  return target;
}

export async function removeDraftWorkbook(slug: string): Promise<void> {
  await bucket().remove([draftWorkbookPath(slug)]); // best-effort cleanup
}
