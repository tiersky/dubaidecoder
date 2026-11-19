'use server';

import { revalidatePath } from 'next/cache';
import { getAccess } from '@/lib/auth/require';
import { serverClient } from '@/lib/supabase/server';
import { buildConfig, type BuilderState } from '@/lib/builder/build';
import { universeLookup } from '@/lib/recommend/server';
import { validateConfig } from '@/lib/config/validate';
import { getDraft, getPublishedConfig, publishDraft, saveDraft } from '@/lib/versions/store';

const SLUG_RE = /^[a-z0-9-]+$/;
/** Path segments the app already uses; a decoder can't take them. */
const RESERVED = new Set(['admin', 'api', 'new', 'login', 'select', 'auth', 'build']);

export interface GuidedSaveResult {
  ok: boolean;
  error?: string;
  slug?: string;
  published?: boolean;
}

/**
 * Saves the guided builder as a draft (no workbook), and optionally
 * publishes it. Publishing needs every typed-in field filled.
 */
export async function saveGuidedAction(stateJson: string, intent: 'draft' | 'publish'): Promise<GuidedSaveResult> {
  const access = await getAccess();
  if (!access || access.role !== 'admin') return { ok: false, error: 'Not allowed.' };
  const supabase = await serverClient();
  const { data } = await supabase.auth.getClaims();
  const userId = String(data?.claims?.sub ?? '') || null;

  let state: BuilderState;
  try {
    state = JSON.parse(stateJson) as BuilderState;
  } catch {
    return { ok: false, error: 'Could not read the builder state.' };
  }
  if (state?.v !== 1 || !Array.isArray(state.markets) || !Array.isArray(state.metrics)) {
    return { ok: false, error: 'Could not read the builder state.' };
  }
  const slug = String(state.slug ?? '').trim();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return { ok: false, error: 'Pick a URL name of lowercase letters, digits and hyphens.' };
  if (!String(state.name ?? '').trim()) return { ok: false, error: 'Give the decoder a name.' };

  if (state.mode === 'new') {
    if (await getPublishedConfig(slug).catch(() => null)) return { ok: false, error: `"${slug}" is already published. Open it from the admin page to edit it.` };
  }
  const existingDraft = await getDraft(slug).catch(() => null);
  if (existingDraft?.workbookPath) {
    return { ok: false, error: `"${slug}" has a workbook draft in progress. Finish or delete it first.` };
  }

  let lookup;
  try {
    ({ lookup } = await universeLookup());
  } catch {
    return { ok: false, error: 'Country data is unavailable right now, so public values can’t be filled. Try again shortly.' };
  }
  const { config, missing } = buildConfig({ ...state, slug }, lookup);
  const v = validateConfig(config);
  if (!v.ok) return { ok: false, error: `Not ready to save: ${v.errors.slice(0, 3).join('; ')}` };

  if (intent === 'publish') {
    const typedMissing = missing.filter((m) => config.metrics.find((x) => x.label === m.metric)?.provider === 'manual');
    if (typedMissing.length) {
      return {
        ok: false,
        error: `Fill the remaining ${typedMissing.length} typed-in value${typedMissing.length === 1 ? '' : 's'} before publishing (first: ${typedMissing[0].market}, ${typedMissing[0].metric}).`,
      };
    }
  }

  try {
    await saveDraft({
      slug,
      name: v.config.name,
      config: v.config,
      workbookPath: '',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
      createdBy: userId,
    });
  } catch {
    return { ok: false, error: 'Saving the draft failed. Try again.' };
  }

  if (intent === 'publish') {
    try {
      await publishDraft(slug, { createdBy: userId });
    } catch {
      return { ok: false, error: 'The draft is saved, but publishing failed. Try again.' };
    }
    revalidatePath('/' + slug);
  }
  revalidatePath('/admin');
  return { ok: true, slug, published: intent === 'publish' };
}
