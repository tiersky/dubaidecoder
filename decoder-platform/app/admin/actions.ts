'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAccess } from '@/lib/auth/require';
import { serverClient } from '@/lib/supabase/server';
import { putDraftWorkbook, downloadDraftWorkbook, validateWorkbookFile } from '@/lib/storage/workbooks';
import { detectCandidates, buildDraft, applyDraftEdits, DraftEdits } from '@/lib/admin/upload-core';
import {
  getDraft,
  saveDraft,
  deleteDraft,
  publishDraft,
  getPublishedConfig,
  applyTweaks,
  DraftRecord,
  TweakInput,
} from '@/lib/versions/store';
import { verifyAgainstWorkbook } from '@/lib/parser/verify';
import { VersionConfig } from '@/lib/config/types';
import {
  listUsers,
  createViewer,
  createAdmin,
  resetPassword as resetUserPassword,
  setSlugs as setUserSlugs,
  setActive as setUserActive,
  generatePassword,
} from '@/lib/users/admin';

export interface AdminActionState {
  error?: string;
  nearMisses?: { sheetName: string; row: number; reason: string }[];
}

export interface UserActionState {
  error?: string;
  createdPassword?: string;
  forEmail?: string;
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

function editsFromForm(formData: FormData, config: VersionConfig): DraftEdits {
  const edits: DraftEdits = {
    name: String(formData.get('name') ?? '') || undefined,
    currency: String(formData.get('currency') ?? '') || undefined,
    defaultBudget: Number(formData.get('defaultBudget')) || undefined,
    weights: {},
    directions: {},
    labels: {},
    marketEnabled: {},
  };
  for (const m of config.metrics) {
    // '' is not null/undefined, so a plain `?? m.weight` fallback never
    // fires for a cleared field — Number('') === 0 would silently zero the
    // weight. Treat empty-string the same as absent.
    const rawWeight = formData.get(`weight:${m.key}`);
    edits.weights![m.key] = rawWeight === null || rawWeight === '' ? m.weight : Number(rawWeight);
    const dir = String(formData.get(`direction:${m.key}`) ?? m.direction);
    edits.directions![m.key] = dir === 'lower' ? 'lower' : 'higher';
    edits.labels![m.key] = String(formData.get(`label:${m.key}`) ?? m.label);
  }
  for (const mk of config.markets) {
    // checkboxes: present in formData only when checked
    edits.marketEnabled![mk.name] = formData.get(`market:${mk.name}`) === 'on';
  }
  return edits;
}

/**
 * Applies the confirm form's edits to the stored draft, recomputes verify
 * against the original workbook, and saves. Shared by save-draft and
 * publish so unsaved edits are never dropped on publish.
 */
async function applyAndSaveDraft(
  slug: string,
  formData: FormData,
  userId: string
): Promise<{ error: string } | { draft: DraftRecord }> {
  const draft = await getDraft(slug);
  if (!draft) return { error: `No draft for "${slug}" — it may have been published or deleted.` };

  const edited = applyDraftEdits(draft.config, editsFromForm(formData, draft.config));
  if (!edited.ok) return { error: `Edits invalid: ${edited.errors.join('; ')}` };

  // Storage/parse failures here are raw library text (e.g. Supabase "Object
  // not found") — never surface that verbatim, and never let it throw past
  // this action: an uncaught throw would hit the confirm page's error
  // boundary and wipe out every edited field the admin just typed.
  let verify;
  try {
    const bytes = await downloadDraftWorkbook(slug);
    const { candidates } = detectCandidates(bytes);
    const candidate = candidates[draft.sourceIndex];
    verify = candidate ? verifyAgainstWorkbook(edited.config, candidate) : null;
  } catch {
    return { error: 'Could not re-read the stored workbook. Try re-uploading.' };
  }

  try {
    await saveDraft({
      slug,
      name: edited.config.name,
      config: edited.config,
      workbookPath: draft.workbookPath,
      sourceSheet: draft.sourceSheet,
      sourceIndex: draft.sourceIndex,
      verify,
      createdBy: userId || null,
    });
  } catch {
    return { error: 'Saving the draft failed — try again.' };
  }

  return { draft };
}

export async function saveDraftEditsAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');

  const result = await applyAndSaveDraft(slug, formData, userId);
  if ('error' in result) return { error: result.error };

  redirect('/admin');
}

export async function publishDraftAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');

  const result = await applyAndSaveDraft(slug, formData, userId);
  if ('error' in result) return { error: result.error };

  try {
    await publishDraft(slug, { createdBy: userId || null });
  } catch (e) {
    // Draft row is intact by construction (publishDraft cleans up only after success).
    return { error: e instanceof Error ? e.message : 'Publish failed.' };
  }

  revalidatePath('/' + slug);
  revalidatePath('/admin');
  redirect('/' + slug);
}

export async function applyTweaksAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');
  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) return { error: `No published version "${slug}".` };

  const tweaks: TweakInput = {
    defaultBudget: Number(formData.get('defaultBudget')) || undefined,
    currency: String(formData.get('currency') ?? '') || undefined,
    weights: Object.fromEntries(
      config.metrics.map((m) => {
        // '' is not null/undefined, so a plain `?? m.weight` fallback never
        // fires for a cleared field — Number('') === 0 would silently zero
        // the weight. Treat empty-string the same as absent.
        const raw = formData.get(`weight:${m.key}`);
        return [m.key, raw === null || raw === '' ? m.weight : Number(raw)];
      })
    ),
    marketEnabled: Object.fromEntries(
      config.markets.map((m) => [m.name, formData.get(`market:${m.name}`) === 'on'])
    ),
  };

  try {
    await applyTweaks(slug, tweaks, { createdBy: userId || null });
  } catch (e) {
    // applyTweaks throws its own labelled validation messages (unknown
    // metric/market, invalid tweaked config) which are safe to surface —
    // anything else (Supabase error text, etc.) collapses to a generic
    // message, matching the convention used elsewhere in this file.
    const message = e instanceof Error ? e.message : '';
    const safe =
      message.startsWith('unknown metric key') ||
      message.startsWith('unknown market') ||
      message.startsWith('tweaked config invalid');
    return { error: safe ? message : 'Tweak failed — try again.' };
  }

  revalidatePath('/' + slug);
  redirect('/' + slug);
}

/**
 * Server-side guard shared by every action that targets an existing user by
 * id: confirms the user exists and is not role 'admin'. Admins are managed
 * by script only — the UI never renders these forms for admin rows, but a
 * hand-crafted POST could otherwise still reset an admin's password or
 * rewrite their slugs, so this must be enforced here regardless of what the
 * client sends.
 */
async function assertViewerTarget(userId: string): Promise<string | null> {
  const users = await listUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return 'User not found.';
  if (target.role === 'admin') return 'Admins are managed via script only.';
  return null;
}

export async function createViewerAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email is required.' };

  const slugs = formData.getAll('slugs').map(String);
  if (slugs.length === 0 && formData.get('confirmNoSlugs') !== 'on') {
    return {
      error:
        'No projects selected — the viewer could sign in but see nothing. Tick the confirmation to create anyway.',
    };
  }

  const submittedPassword = String(formData.get('password') ?? '');
  const password = submittedPassword !== '' ? submittedPassword : generatePassword();

  try {
    await createViewer({ email, password, slugs });
  } catch (e) {
    // createViewer's own "invalid slug" message is safe to surface verbatim;
    // anything else (raw Supabase error text, e.g. duplicate email) collapses
    // to a generic message, matching the convention used elsewhere here.
    const message = e instanceof Error ? e.message : '';
    const safe = message.startsWith('invalid slug');
    return { error: safe ? message : 'Create failed — try again.' };
  }

  revalidatePath('/admin/users');
  // Shown once on this response only — never persisted or queryable again.
  return { createdPassword: password, forEmail: email };
}

export async function createAdminAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email is required.' };
  if (formData.get('confirmAdmin') !== 'on') {
    return {
      error:
        'Admins get full access to every project and this admin area. Tick the confirmation to create one.',
    };
  }

  const submittedPassword = String(formData.get('password') ?? '');
  const password = submittedPassword !== '' ? submittedPassword : generatePassword();

  try {
    await createAdmin({ email, password });
  } catch {
    // Raw Supabase error text (e.g. duplicate email) never reaches the browser.
    return { error: 'Create failed — try again.' };
  }

  revalidatePath('/admin/users');
  // Shown once on this response only — never persisted or queryable again.
  return { createdPassword: password, forEmail: email };
}

export async function resetPasswordAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  const email = String(formData.get('email') ?? '');
  if (!userId) return { error: 'Missing user.' };

  const guardError = await assertViewerTarget(userId);
  if (guardError) return { error: guardError };

  // Always generated — no manual entry, which keeps weak/reused passwords
  // out of the loop.
  const password = generatePassword();

  try {
    await resetUserPassword(userId, password);
  } catch {
    return { error: 'Password reset failed — try again.' };
  }

  revalidatePath('/admin/users');
  return { createdPassword: password, forEmail: email };
}

export async function setUserSlugsAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { error: 'Missing user.' };

  const guardError = await assertViewerTarget(userId);
  if (guardError) return { error: guardError };

  const slugs = formData.getAll('slugs').map(String);

  try {
    await setUserSlugs(userId, slugs);
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    const safe = message.startsWith('invalid slug');
    return { error: safe ? message : 'Updating projects failed — try again.' };
  }

  revalidatePath('/admin/users');
  return {};
}

export async function setUserActiveAction(
  _prev: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  await requireAdmin();

  const userId = String(formData.get('userId') ?? '');
  if (!userId) return { error: 'Missing user.' };
  const active = formData.get('active') === 'true';

  if (!active && formData.get('confirm') !== 'on') {
    return { error: 'Tick the confirmation to deactivate this user.' };
  }

  const guardError = await assertViewerTarget(userId);
  if (guardError) return { error: guardError };

  try {
    await setUserActive(userId, active);
  } catch {
    return { error: `${active ? 'Reactivation' : 'Deactivation'} failed — try again.` };
  }

  revalidatePath('/admin/users');
  return {};
}
