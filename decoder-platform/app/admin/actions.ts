'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAccess } from '@/lib/auth/require';
import { serverClient } from '@/lib/supabase/server';
import { putDraftWorkbook, downloadDraftWorkbook, validateWorkbookFile } from '@/lib/storage/workbooks';
import { detectCandidates, buildDraft } from '@/lib/admin/upload-core';
import { saveDraft, deleteDraft, getPublishedConfig } from '@/lib/versions/store';

export interface AdminActionState {
  error?: string;
  nearMisses?: { sheetName: string; row: number; reason: string }[];
}

const SLUG_RE = /^[a-z0-9-]+$/;

async function requireAdmin(): Promise<{ userId: string }> {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');
  const supabase = await serverClient();
  const { data } = await supabase.auth.getClaims();
  return { userId: String(data?.claims?.sub ?? '') };
}

export async function uploadWorkbookAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();

  const target = String(formData.get('target') ?? 'new');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an .xlsx file.' };

  let slug: string;
  let name: string;
  let base: { currency?: string; defaultBudget?: number } = {};
  if (target === 'existing') {
    slug = String(formData.get('existingSlug') ?? '');
    const published = await getPublishedConfig(slug).catch(() => null);
    if (!published) return { error: `No published version "${slug}".` };
    name = published.name;
    base = { currency: published.currency, defaultBudget: published.defaultBudget };
  } else {
    slug = String(formData.get('slug') ?? '').trim();
    name = String(formData.get('name') ?? '').trim();
    if (!SLUG_RE.test(slug)) return { error: 'Slug must match a-z, 0-9, hyphens.' };
    if (!name) return { error: 'Name is required.' };
    if (await getPublishedConfig(slug).catch(() => null))
      return { error: `"${slug}" is already published — use "Update existing".` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Our own validation message is safe to surface verbatim; anything the
  // storage layer throws (raw Supabase error text) is not, so it collapses
  // to a fixed generic message below.
  const invalid = validateWorkbookFile(bytes);
  if (invalid) return { error: invalid };

  try {
    await putDraftWorkbook(slug, bytes);
  } catch {
    return { error: 'Upload failed — try again.' };
  }

  let candidates: ReturnType<typeof detectCandidates>['candidates'];
  let nearMisses: ReturnType<typeof detectCandidates>['nearMisses'];
  try {
    ({ candidates, nearMisses } = detectCandidates(bytes));
  } catch {
    // The zip signature checked out but the workbook is corrupt/unreadable.
    // The draft bytes are already written; leave the row/redirect alone and
    // just report a generic parse failure — no library internals leaked.
    return { error: 'Could not parse this file as an Excel workbook.' };
  }
  if (candidates.length === 0)
    return { error: 'No model block found in this workbook.', nearMisses };
  if (candidates.length > 1)
    redirect(`/admin/${slug}/choose?name=${encodeURIComponent(name)}`);

  const built = buildDraft(candidates, 0, { slug, name, ...base });
  if (!built.ok) return { error: `Workbook parsed but config invalid: ${built.errors.join('; ')}` };
  await saveDraft({
    slug,
    name,
    config: built.draft.config,
    workbookPath: `${slug}/draft.xlsx`,
    sourceSheet: built.draft.sourceSheet,
    sourceIndex: built.draft.sourceIndex,
    verify: built.draft.verify,
    createdBy: userId || null,
  });
  redirect(`/admin/${slug}/confirm`);
}

export async function pickCandidateAction(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '');
  const index = Number(formData.get('index') ?? 0);
  const bytes = await downloadDraftWorkbook(slug);
  let candidates: ReturnType<typeof detectCandidates>['candidates'];
  try {
    ({ candidates } = detectCandidates(bytes));
  } catch {
    throw new Error('Could not parse this file as an Excel workbook.');
  }
  const published = await getPublishedConfig(slug).catch(() => null);
  const built = buildDraft(candidates, index, {
    slug,
    name: name || published?.name || slug,
    currency: published?.currency,
    defaultBudget: published?.defaultBudget,
  });
  if (!built.ok) throw new Error(built.errors.join('; '));
  await saveDraft({
    slug,
    name: name || published?.name || slug,
    config: built.draft.config,
    workbookPath: `${slug}/draft.xlsx`,
    sourceSheet: built.draft.sourceSheet,
    sourceIndex: built.draft.sourceIndex,
    verify: built.draft.verify,
    createdBy: userId || null,
  });
  redirect(`/admin/${slug}/confirm`);
}

export async function deleteDraftAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteDraft(String(formData.get('slug') ?? ''));
  revalidatePath('/admin');
  redirect('/admin');
}
