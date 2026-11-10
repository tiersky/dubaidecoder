import { serviceClient } from '../supabase/admin';
import type { MarketInsight } from './insight';

export interface StoredInsight {
  insight: MarketInsight;
  model: string;
  generatedAt: string;
}

export async function getCachedInsight(
  slug: string,
  market: string,
  fingerprint: string
): Promise<StoredInsight | null> {
  const { data, error } = await serviceClient()
    .from('market_insights')
    .select('content, model, created_at')
    .eq('slug', slug)
    .eq('market', market)
    .eq('fingerprint', fingerprint)
    .maybeSingle();
  if (error) throw new Error(`insight lookup failed: ${error.message}`);
  if (!data) return null;
  return { insight: data.content as MarketInsight, model: data.model, generatedAt: data.created_at };
}

export async function saveInsight(row: {
  slug: string;
  market: string;
  fingerprint: string;
  model: string;
  insight: MarketInsight;
  createdBy: string | null;
}): Promise<StoredInsight> {
  const generatedAt = new Date().toISOString();
  const { error } = await serviceClient()
    .from('market_insights')
    .upsert(
      {
        slug: row.slug,
        market: row.market,
        fingerprint: row.fingerprint,
        model: row.model,
        content: row.insight,
        created_by: row.createdBy,
        created_at: generatedAt,
      },
      { onConflict: 'slug,market,fingerprint' }
    );
  if (error) throw new Error(`insight save failed: ${error.message}`);
  return { insight: row.insight, model: row.model, generatedAt };
}
