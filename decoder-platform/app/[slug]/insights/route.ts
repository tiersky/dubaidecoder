import { NextResponse, type NextRequest } from 'next/server';
import { getAccess } from '@/lib/auth/require';
import { authorize } from '@/lib/auth/access';
import { getPublishedConfig } from '@/lib/versions/store';
import { buildMarketContext, contextFingerprint } from '@/lib/ai/market-context';
import { buildInsightPrompt, parseInsight } from '@/lib/ai/insight';
import { generateWithFallback, AllAgentsFailedError, InteractConfigError } from '@/lib/ai/interact';
import { getCachedInsight, saveInsight, type StoredInsight } from '@/lib/ai/insights-store';

export const dynamic = 'force-dynamic';
// Up to three agents in sequence; each typically answers in 10–25s.
export const maxDuration = 120;

/** Concurrent requests for the same analysis share one generation per instance. */
const inFlight = new Map<string, Promise<StoredInsight>>();

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * POST /[slug]/insights  { market: string, regenerate?: boolean }
 * Returns the cached analysis for the market's current data, or generates it.
 * Access follows the dashboard's own rule (proxy + this check); only admins
 * may force a regeneration.
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/[slug]/insights'>) {
  const { slug } = await ctx.params;
  const access = await getAccess();
  const decision = authorize(`/${slug}`, access);
  if (decision !== 'allow' || !access) {
    return json({ error: 'Not allowed.' }, decision === 'login' ? 401 : 403);
  }

  let body: { market?: unknown; regenerate?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const market = typeof body.market === 'string' ? body.market : '';
  const regenerate = body.regenerate === true;
  if (!market) return json({ error: 'market is required.' }, 400);
  if (regenerate && access.role !== 'admin') return json({ error: 'Only admins can regenerate.' }, 403);

  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) return json({ error: 'No published decoder here.' }, 404);
  const marketCtx = buildMarketContext(config, market);
  if (!marketCtx) return json({ error: 'Unknown market.' }, 404);
  const fingerprint = contextFingerprint(marketCtx);

  try {
    if (!regenerate) {
      // The cache is best-effort: a storage failure must not block the analysis.
      const cached = await getCachedInsight(slug, market, fingerprint).catch((err) => {
        console.error('[insights] cache read failed:', err instanceof Error ? err.message : err);
        return null;
      });
      if (cached) return json({ ...cached, cached: true });
    }

    const key = `${slug}\u0000${market}\u0000${fingerprint}\u0000${regenerate}`;
    let pending = inFlight.get(key);
    if (!pending) {
      pending = (async () => {
        // No client abort signal: a generation the viewer walks away from
        // still completes and is cached for the next visit.
        const { result, agent } = await generateWithFallback(buildInsightPrompt(marketCtx), parseInsight);
        return saveInsight({ slug, market, fingerprint, model: agent, insight: result, createdBy: null }).catch(
          (err): StoredInsight => {
            console.error('[insights] cache write failed:', err instanceof Error ? err.message : err);
            return { insight: result, model: agent, generatedAt: new Date().toISOString() };
          }
        );
      })().finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return json({ ...(await pending), cached: false });
  } catch (err) {
    if (err instanceof InteractConfigError) {
      console.error('[insights] Interact credentials missing');
      return json({ error: 'AI analysis is not configured yet.', code: 'not_configured' }, 503);
    }
    if (err instanceof AllAgentsFailedError) {
      console.error('[insights]', err.message);
      return json({ error: 'The AI service is busy right now. Try again in a minute.', code: 'unavailable' }, 502);
    }
    console.error('[insights] failed:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not produce the analysis. Try again.', code: 'failed' }, 500);
  }
}
