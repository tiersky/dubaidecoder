import { NextResponse, type NextRequest } from 'next/server';
import { getAccess } from '@/lib/auth/require';
import { authorize } from '@/lib/auth/access';
import { getPublishedConfig } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import { DIMENSIONS, cultureProfile, type Scores } from '@/lib/insights/hofstede';
import { buildCulturePrompt, parseCultureReading, type CultureReading, type CultureSubject } from '@/lib/ai/culture';
import { generate } from '@/lib/ai/generate';
import { AllAgentsFailedError, InteractConfigError } from '@/lib/ai/interact';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_SUBJECTS = 3;
const CACHE_LIMIT = 200;

/** Per-instance cache: the same comparison is only interpreted once. */
const cache = new Map<string, CultureReading>();
const inFlight = new Map<string, Promise<CultureReading>>();

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * POST /[slug]/culture-insight  { iso2s: string[], target?: Scores }
 * An AI reading of a Hofstede comparison. Scores are looked up server-side
 * from the ISO codes; nothing numeric from the client reaches the prompt
 * except the 0–100 target sliders.
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/[slug]/culture-insight'>) {
  const { slug } = await ctx.params;
  const access = await getAccess();
  const decision = authorize(`/${slug}`, access);
  if (decision !== 'allow' || !access) return json({ error: 'Not allowed.' }, decision === 'login' ? 401 : 403);

  let body: { iso2s?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  const iso2s = Array.isArray(body.iso2s)
    ? [...new Set(body.iso2s.filter((c): c is string => typeof c === 'string' && /^[a-z]{2}$/i.test(c)).map((c) => c.toLowerCase()))]
    : [];
  if (iso2s.length < 1 || iso2s.length > MAX_SUBJECTS) return json({ error: 'Pick one to three countries.' }, 400);

  let target: Scores | null = null;
  if (body.target && typeof body.target === 'object') {
    const t = {} as Scores;
    for (const d of DIMENSIONS) {
      const v = (body.target as Record<string, unknown>)[d.key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) return json({ error: 'Invalid target.' }, 400);
      t[d.key] = Math.round(v);
    }
    target = t;
  }

  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) return json({ error: 'No published decoder here.' }, 404);
  const marketNames = new Map(deriveDashboard(config).markets.filter((m) => m.iso2).map((m) => [m.iso2!.toLowerCase(), m.name]));

  const subjects: CultureSubject[] = [];
  for (const iso2 of iso2s) {
    const profile = cultureProfile(iso2);
    if (!profile) return json({ error: 'No culture data for one of these countries.' }, 400);
    subjects.push({ name: marketNames.get(iso2) ?? profile.name, profile });
  }

  const key = `${slug}\u0000${[...iso2s].sort().join(',')}\u0000${target ? DIMENSIONS.map((d) => target![d.key]).join(',') : ''}`;
  const hit = cache.get(key);
  if (hit) return json({ reading: hit, cached: true });

  try {
    let pending = inFlight.get(key);
    if (!pending) {
      const prompt = buildCulturePrompt({
        subjects,
        target,
        industry: config.context?.industry ?? null,
        brief: config.context?.brief ?? null,
        decoderName: config.name,
      });
      pending = generate(prompt, parseCultureReading)
        .then(({ result }) => {
          if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
          cache.set(key, result);
          return result;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return json({ reading: await pending, cached: false });
  } catch (err) {
    if (err instanceof InteractConfigError) return json({ error: 'AI is not configured yet.' }, 503);
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[culture-insight]', detail);
    return json(
      {
        error: err instanceof AllAgentsFailedError ? 'The AI service is busy right now. Try again in a minute.' : 'Could not interpret this comparison. Try again.',
        ...(access.role === 'admin' && { detail: detail.slice(0, 300) }),
      },
      502
    );
  }
}
