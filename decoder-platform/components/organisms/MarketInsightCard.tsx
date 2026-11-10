'use client';

import { useEffect, useState } from 'react';
import type { MarketInsight, InsightPoint } from '@/lib/ai/insight';

interface InsightResponse {
  insight: MarketInsight;
  model: string;
  generatedAt: string;
  cached: boolean;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: InsightResponse }
  | { status: 'error'; message: string };

async function fetchInsight(
  slug: string,
  market: string,
  regenerate: boolean,
  signal?: AbortSignal
): Promise<InsightResponse> {
  const res = await fetch(`/${encodeURIComponent(slug)}/insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ market, regenerate }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not load the analysis.');
  return body as InsightResponse;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Could not load the analysis.');

/** Session cache: revisiting a market in the same visit is instant. */
const sessionCache = new Map<string, InsightResponse>();

interface MarketInsightCardProps {
  slug: string;
  market: string;
  industry?: string | null;
  canRegenerate: boolean;
}

export default function MarketInsightCard({ slug, market, industry, canRegenerate }: MarketInsightCardProps) {
  const cacheKey = `${slug}\u0000${market}`;
  const [state, setState] = useState<State>(() => {
    const hit = sessionCache.get(cacheKey);
    return hit ? { status: 'ready', data: hit } : { status: 'loading' };
  });
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (sessionCache.has(cacheKey)) return;
    const ctrl = new AbortController();
    fetchInsight(slug, market, false, ctrl.signal)
      .then((data) => {
        sessionCache.set(cacheKey, data);
        setState({ status: 'ready', data });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setState({ status: 'error', message: errorText(err) });
      });
    return () => ctrl.abort();
  }, [slug, market, cacheKey]);

  const run = async (regenerate: boolean) => {
    try {
      const data = await fetchInsight(slug, market, regenerate);
      sessionCache.set(cacheKey, data);
      setState({ status: 'ready', data });
    } catch (err) {
      setState({ status: 'error', message: errorText(err) });
    }
  };

  const retry = () => {
    setState({ status: 'loading' });
    void run(false);
  };

  const regenerate = async () => {
    setRegenerating(true);
    await run(true);
    setRegenerating(false);
  };

  return (
    <section aria-label={`AI analysis of ${market}`} aria-busy={state.status === 'loading' || regenerating} className="glass-card overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <h2 className="text-[15px] font-semibold text-ink">AI market analysis</h2>
        </div>
        {state.status === 'ready' && (
          <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-medium text-ink-2">
            {state.data.model}
          </span>
        )}
      </div>

      {state.status === 'loading' && <Loading market={market} industry={industry} />}

      {state.status === 'error' && (
        <div className="well mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-[13.5px] text-ink">{state.message}</p>
          <button type="button" onClick={retry} className="btn-secondary px-4 py-1.5 text-[13px]">
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className={`transition-[opacity,filter] duration-300 ${regenerating ? 'opacity-50 blur-[1px]' : ''}`}>
          <InsightBody key={state.data.generatedAt} insight={state.data.insight} />
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
            <p className="text-[11.5px] leading-relaxed text-ink-2">
              AI-generated from this decoder&apos;s data and the model&apos;s general knowledge
              {' · '}
              {new Date(state.data.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              . Check before sharing externally.
            </p>
            {canRegenerate && (
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="press rounded-full px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/[0.08] disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}

function InsightBody({ insight }: { insight: MarketInsight }) {
  return (
    <div className="mt-4">
      <p className="display materialize text-[21px] font-semibold text-ink sm:text-[23px]">{insight.headline}</p>
      <p className="materialize mt-2 max-w-[75ch] text-[14.5px] leading-relaxed text-ink" style={{ ['--i' as string]: 1 }}>
        {insight.overview}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <PointList title="Strengths" points={insight.strengths} tone="positive" index={2} />
        <PointList title="Weaknesses" points={insight.weaknesses} tone="negative" index={3} />
      </div>

      <div className="well materialize mt-5 px-4 py-3.5" style={{ ['--i' as string]: 4 }}>
        <h3 className="text-[12px] font-semibold text-ink-2">Why this allocation fits</h3>
        <p className="mt-1 text-[14px] leading-relaxed text-ink">{insight.allocationFit}</p>
      </div>

      {insight.watch && (
        <p className="materialize mt-3 flex items-start gap-2 text-[13.5px] leading-relaxed text-ink-2" style={{ ['--i' as string]: 5 }}>
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="2.75" />
          </svg>
          <span>
            <span className="font-semibold text-ink">Watch: </span>
            {insight.watch}
          </span>
        </p>
      )}
    </div>
  );
}

function PointList({
  title,
  points,
  tone,
  index,
}: {
  title: string;
  points: InsightPoint[];
  tone: 'positive' | 'negative';
  index: number;
}) {
  const color = tone === 'positive' ? 'text-[#248a3d]' : 'text-[#c93400]';
  return (
    <div className="materialize" style={{ ['--i' as string]: index }}>
      <h3 className="text-[12px] font-semibold text-ink-2">{title}</h3>
      <ul className="mt-2 space-y-2.5">
        {points.map((p) => (
          <li key={p.title} className="flex gap-2.5">
            <span className={`mt-[3px] flex-shrink-0 ${color}`} aria-hidden>
              {tone === 'positive' ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />
                </svg>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-ink">{p.title}</span>
              <span className="block text-[13.5px] leading-relaxed text-ink-2">{p.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Loading({ market, industry }: { market: string; industry?: string | null }) {
  return (
    <div className="mt-4" role="status">
      <p className="text-[13.5px] text-ink-2">
        Analyzing {market}
        {industry ? ` for ${industry.toLowerCase()}` : ''}… the first analysis takes about 20 seconds.
      </p>
      <div className="mt-4 space-y-2.5" aria-hidden>
        <div className="shimmer h-6 w-3/5 rounded-[8px]" />
        <div className="shimmer h-3.5 w-full rounded-full" />
        <div className="shimmer h-3.5 w-11/12 rounded-full" />
        <div className="grid grid-cols-1 gap-5 pt-3 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-2.5">
              <div className="shimmer h-3 w-20 rounded-full" />
              <div className="shimmer h-3.5 w-full rounded-full" />
              <div className="shimmer h-3.5 w-4/5 rounded-full" />
              <div className="shimmer h-3.5 w-11/12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="h-[18px] w-[18px] text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.1 3.6c.3-.8 1.5-.8 1.8 0l1.3 3.6a4 4 0 002.4 2.4l3.6 1.3c.8.3.8 1.5 0 1.8l-3.6 1.3a4 4 0 00-2.4 2.4l-1.3 3.6c-.3.8-1.5.8-1.8 0l-1.3-3.6a4 4 0 00-2.4-2.4l-3.6-1.3c-.8-.3-.8-1.5 0-1.8l3.6-1.3a4 4 0 002.4-2.4l1.3-3.6z" />
      <path d="M19 2.2c.1-.3.6-.3.7 0l.4 1.1c.1.4.4.6.7.7l1.1.4c.3.1.3.6 0 .7l-1.1.4c-.4.1-.6.4-.7.7l-.4 1.1c-.1.3-.6.3-.7 0l-.4-1.1a1.1 1.1 0 00-.7-.7l-1.1-.4c-.3-.1-.3-.6 0-.7l1.1-.4c.4-.1.6-.4.7-.7l.4-1.1z" opacity=".55" />
    </svg>
  );
}
