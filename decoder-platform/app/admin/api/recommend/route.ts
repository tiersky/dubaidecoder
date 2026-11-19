import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin, universeLookup } from '@/lib/recommend/server';
import { distanceKm } from '@/lib/recommend/universe';
import { rankLookalikes } from '@/lib/recommend/lookalike';
import { buildRecommendPrompt, parseRecommendReply, RECOMMEND_SCHEMA } from '@/lib/ai/recommend';
import { callClaudeStructured, claudeConfigured, RECOMMEND_MODEL } from '@/lib/ai/claude';
import type { RecommendationItem, RecommendationSet } from '@/lib/config/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  name: z.string().max(120).default(''),
  seeds: z.array(z.string().regex(/^[a-z]{2}$/i)).min(1).max(60),
  exclude: z.array(z.string().regex(/^[a-z]{2}$/i)).max(200).default([]),
  destination: z.object({ iso2: z.string(), name: z.string().max(120), lat: z.number(), lng: z.number() }).nullable().default(null),
  industry: z.string().max(120).default(''),
  objective: z.string().max(300).default(''),
  brief: z.string().max(2000).default(''),
});

/**
 * POST /admin/api/recommend: lookalike shortlist over every country, then
 * Opus picks and explains from that shortlist only. Falls back to the
 * lookalike ranking if the AI is unavailable, so the builder never dead-ends.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Add at least one starting country.' }, { status: 400 });
  const b = parsed.data;
  const seeds = [...new Set(b.seeds.map((s) => s.toLowerCase()))];

  let byIso;
  try {
    ({ byIso } = await universeLookup());
  } catch {
    return NextResponse.json({ error: 'Country data is unavailable right now. Try again shortly.' }, { status: 502 });
  }
  const universe = [...byIso.values()];
  const shortlist = rankLookalikes(universe, {
    seeds,
    destination: b.destination,
    exclude: b.exclude,
    limit: 40,
  });
  if (!shortlist.length) return NextResponse.json({ error: 'None of the starting countries has public data to compare with.' }, { status: 400 });

  const dist = (iso2: string) => {
    const c = byIso.get(iso2);
    return c && b.destination ? distanceKm(c, b.destination) : null;
  };
  const byShort = new Map(shortlist.map((s) => [s.iso2, s]));
  const fallback = (note: string): RecommendationSet => ({
    generatedAt: new Date().toISOString(),
    model: 'lookalike',
    summary: note,
    items: shortlist.slice(0, 10).map((s) => ({
      iso2: s.iso2,
      name: s.name,
      fit: s.fit,
      lookalike: s.fit,
      closestSeed: s.closestSeed,
      headline: `Most like ${s.closestSeed ?? 'your markets'} on public data`,
      reasons: s.matches.length ? [`Close on ${s.matches.slice(0, 3).join(', ')}`] : ['Similar overall profile'],
      risks: s.gaps.map((g) => `${g.direction === 'higher' ? 'Higher' : 'Lower'} ${g.label} than your markets`).slice(0, 2),
      status: 'suggested' as const,
    })),
  });

  if (!claudeConfigured()) {
    return NextResponse.json({ set: fallback('AI is not configured, so these are the closest lookalikes on public data.'), aiError: 'not-configured' });
  }

  const prompt = buildRecommendPrompt({
    decoderName: b.name || 'a new decoder',
    industry: b.industry || null,
    objective: b.objective || null,
    brief: b.brief || null,
    destination: b.destination?.name ?? null,
    seeds: seeds.flatMap((s) => {
      const c = byIso.get(s);
      return c ? [{ iso2: s, name: c.name, facts: c.facts, distanceKm: dist(s) }] : [];
    }),
    candidates: shortlist.map((s) => ({ ...s, facts: byIso.get(s.iso2)?.facts ?? {}, distanceKm: s.distanceKm })),
  });

  try {
    const { text, model } = await callClaudeStructured({ prompt, schema: RECOMMEND_SCHEMA, model: RECOMMEND_MODEL, effort: 'high' });
    const reply = parseRecommendReply(text, new Set(byShort.keys()), new Set(seeds));
    if (!reply) throw new Error('unusable reply');
    const items: RecommendationItem[] = reply.recommendations.map((r) => {
      const s = byShort.get(r.iso2)!;
      return {
        iso2: r.iso2,
        name: s.name,
        fit: r.fit,
        lookalike: s.fit,
        closestSeed: s.closestSeed,
        headline: r.headline,
        reasons: r.reasons,
        risks: r.risks,
        status: 'suggested',
      };
    });
    const set: RecommendationSet = {
      generatedAt: new Date().toISOString(),
      model,
      summary: reply.summary,
      items,
      ...(reply.seedNotes.length && { seedNotes: reply.seedNotes }),
    };
    return NextResponse.json({ set });
  } catch (err) {
    console.error('[recommend]', err instanceof Error ? err.message : err);
    return NextResponse.json({
      set: fallback('The AI could not answer just now, so these are the closest lookalikes on public data. Try again for a full recommendation.'),
      aiError: 'failed',
    });
  }
}
