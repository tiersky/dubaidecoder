import { VersionConfig } from '../config/types';
import { validateConfig } from '../config/validate';
import { VerificationReport } from '../parser/verify';
import { copyDraftToRevision, removeDraftWorkbook } from '../storage/workbooks';
import { serviceClient } from '../supabase/admin';

/** Scalar columns are always re-derived from config — config jsonb is authoritative. */
export function versionRowFromConfig(config: VersionConfig) {
  return {
    slug: config.slug,
    name: config.name,
    currency: config.currency,
    default_budget: config.defaultBudget,
    status: 'published' as const,
    config,
  };
}

export async function publishVersion(
  config: VersionConfig,
  opts: {
    workbookPath?: string | null;
    createdBy?: string | null;
    workbookPathFor?: (revision: number) => Promise<string | null>;
  } = {}
): Promise<{ id: number; revision: number }> {
  const db = serviceClient();
  const { data: version, error } = await db
    .from('versions')
    .upsert(versionRowFromConfig(config), { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`publish failed: ${error.message}`);

  // Retry once on a revision-number race: another publish for the same
  // version landed the same next-revision number between our lookup and
  // insert. Recompute the revision (and re-derive the workbook path) and
  // try again; a second collision is treated as a real failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: last, error: lastErr } = await db
      .from('version_revisions')
      .select('revision')
      .eq('version_id', version.id)
      .order('revision', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw new Error(`revision lookup failed: ${lastErr.message}`);

    const revision = (last?.revision ?? 0) + 1;
    const workbookPath = opts.workbookPathFor
      ? await opts.workbookPathFor(revision)
      : opts.workbookPath ?? null;
    const { error: revErr } = await db.from('version_revisions').insert({
      version_id: version.id,
      revision,
      config,
      workbook_path: workbookPath,
      created_by: opts.createdBy ?? null,
    });
    if (!revErr) return { id: version.id as number, revision };
    if (revErr.code !== '23505' || attempt === 1)
      throw new Error(`revision insert failed: ${revErr.message}`);
    // 23505: another publish landed this revision number first — retry once.
  }
  // Unreachable: the loop above always returns or throws.
  throw new Error('revision insert failed: exhausted retries');
}

export async function getPublishedConfig(slug: string): Promise<VersionConfig | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('config')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw new Error(`load failed: ${error.message}`);
  if (!data) return null;
  const v = validateConfig(data.config);
  if (!v.ok) throw new Error(`stored config for "${slug}" is invalid: ${v.errors.join('; ')}`);
  return v.config;
}

export interface DraftRecord {
  slug: string;
  name: string;
  config: VersionConfig;
  workbookPath: string;
  sourceSheet: string | null;
  sourceIndex: number;
  verify: VerificationReport | null;
  updatedAt: string;
}

export interface VersionSummary {
  slug: string;
  name: string;
  currency: string;
  status: string;
  updatedAt: string;
}

export interface TweakInput {
  defaultBudget?: number;
  currency?: string;
  marketEnabled?: Record<string, boolean>; // by market name
  weights?: Record<string, number>; // by metric key
}

function draftFromRow(row: Record<string, unknown>): DraftRecord {
  const v = validateConfig(row.config);
  if (!v.ok) throw new Error(`stored draft config for "${row.slug}" is invalid: ${v.errors.join('; ')}`);
  return {
    slug: row.slug as string,
    name: row.name as string,
    config: v.config,
    workbookPath: row.workbook_path as string,
    sourceSheet: (row.source_sheet as string) ?? null,
    sourceIndex: (row.source_index as number) ?? 0,
    verify: (row.verify as VerificationReport) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export async function saveDraft(
  d: Omit<DraftRecord, 'updatedAt'> & { createdBy?: string | null }
): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from('version_drafts').upsert(
    {
      slug: d.slug,
      name: d.name,
      config: d.config,
      workbook_path: d.workbookPath,
      source_sheet: d.sourceSheet,
      source_index: d.sourceIndex,
      verify: d.verify,
      created_by: d.createdBy ?? null,
    },
    { onConflict: 'slug' }
  );
  if (error) throw new Error(`draft save failed: ${error.message}`);
}

export async function getDraft(slug: string): Promise<DraftRecord | null> {
  const db = serviceClient();
  const { data, error } = await db.from('version_drafts').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`draft load failed: ${error.message}`);
  if (!data) return null;
  return draftFromRow(data);
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const db = serviceClient();
  const { data, error } = await db
    .from('version_drafts')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`drafts load failed: ${error.message}`);
  return (data ?? []).map(draftFromRow);
}

async function deleteDraftRow(slug: string): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from('version_drafts').delete().eq('slug', slug);
  if (error) throw new Error(`draft delete failed: ${error.message}`);
}

export async function deleteDraft(slug: string): Promise<void> {
  await removeDraftWorkbook(slug);
  await deleteDraftRow(slug);
}

export async function listVersions(): Promise<VersionSummary[]> {
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('slug, name, currency, status, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`versions load failed: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    slug: row.slug as string,
    name: row.name as string,
    currency: row.currency as string,
    status: row.status as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function publishDraft(
  slug: string,
  opts: { createdBy?: string | null } = {}
): Promise<{ revision: number }> {
  const draft = await getDraft(slug);
  if (!draft) throw new Error(`no draft for "${slug}"`);
  const { revision } = await publishVersion(draft.config, {
    createdBy: opts.createdBy,
    workbookPathFor: (rev) => copyDraftToRevision(slug, rev),
  });
  // Only after the publish fully succeeded: clean up. Failures above leave
  // the draft untouched for retry.
  await removeDraftWorkbook(slug);
  await deleteDraftRow(slug);
  return { revision };
}

export async function applyTweaks(
  slug: string,
  tweaks: TweakInput,
  opts: { createdBy?: string | null } = {}
): Promise<{ revision: number }> {
  const config = await getPublishedConfig(slug);
  if (!config) throw new Error(`no published version for "${slug}"`);
  const next: VersionConfig = structuredClone(config);
  if (tweaks.defaultBudget !== undefined) next.defaultBudget = tweaks.defaultBudget;
  if (tweaks.currency !== undefined) next.currency = tweaks.currency;
  for (const [key, w] of Object.entries(tweaks.weights ?? {})) {
    const m = next.metrics.find((m) => m.key === key);
    if (!m) throw new Error(`unknown metric key: ${key}`);
    m.weight = w;
  }
  for (const [name, enabled] of Object.entries(tweaks.marketEnabled ?? {})) {
    const mk = next.markets.find((m) => m.name === name);
    if (!mk) throw new Error(`unknown market: ${name}`);
    mk.enabled = enabled;
  }
  const v = validateConfig(next);
  if (!v.ok) throw new Error(`tweaked config invalid: ${v.errors.join('; ')}`);

  // Carry the last revision's workbook forward — tweaks have no new file.
  const db = serviceClient();
  const { data: verRow } = await db.from('versions').select('id').eq('slug', slug).single();
  const { data: lastRev } = await db
    .from('version_revisions')
    .select('workbook_path')
    .eq('version_id', verRow!.id)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { revision } = await publishVersion(v.config, {
    createdBy: opts.createdBy,
    workbookPath: lastRev?.workbook_path ?? null,
  });
  return { revision };
}
