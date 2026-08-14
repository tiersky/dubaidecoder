import { VersionConfig } from '../config/types';
import { validateConfig } from '../config/validate';
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
  opts: { workbookPath?: string | null; createdBy?: string | null } = {}
): Promise<{ id: number; revision: number }> {
  const db = serviceClient();
  const { data: version, error } = await db
    .from('versions')
    .upsert(versionRowFromConfig(config), { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`publish failed: ${error.message}`);

  const { data: last, error: lastErr } = await db
    .from('version_revisions')
    .select('revision')
    .eq('version_id', version.id)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`revision lookup failed: ${lastErr.message}`);

  const revision = (last?.revision ?? 0) + 1;
  const { error: revErr } = await db.from('version_revisions').insert({
    version_id: version.id,
    revision,
    config,
    workbook_path: opts.workbookPath ?? null,
    created_by: opts.createdBy ?? null,
  });
  if (revErr) throw new Error(`revision insert failed: ${revErr.message}`);
  return { id: version.id as number, revision };
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
