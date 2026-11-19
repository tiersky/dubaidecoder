'use client';

import { useState } from 'react';
import type { CultureReading } from '@/lib/ai/culture';
import type { Scores } from '@/lib/insights/hofstede';

interface CultureReadingBoxProps {
  slug: string;
  subjects: Array<{ name: string; iso2: string }>;
  target: Scores | null;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; reading: CultureReading }
  | { status: 'error'; message: string };

/** Session cache: going back to a comparison already read is instant. */
const readings = new Map<string, CultureReading>();

const keyOf = (subjects: CultureReadingBoxProps['subjects'], target: Scores | null) =>
  `${subjects.map((s) => s.iso2).sort().join(',')}|${target ? Object.values(target).join(',') : ''}`;

/**
 * AI interpretation of the radar comparison. It runs only when asked, and
 * each distinct comparison is read once per session (and once per server).
 */
export default function CultureReadingBox({ slug, subjects, target }: CultureReadingBoxProps) {
  const key = keyOf(subjects, target);
  const [byKey, setByKey] = useState<Record<string, State>>({});
  const cached = readings.get(key);
  const state: State = cached ? { status: 'ready', reading: cached } : (byKey[key] ?? { status: 'idle' });
  const names = subjects.map((s) => s.name);
  const label = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];

  const run = async () => {
    setByKey((s) => ({ ...s, [key]: { status: 'loading' } }));
    try {
      const res = await fetch(`/${encodeURIComponent(slug)}/culture-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iso2s: subjects.map((s) => s.iso2), target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([body.error || 'Could not interpret this comparison.', body.detail].filter(Boolean).join(' — '));
      readings.set(key, body.reading);
      setByKey((s) => ({ ...s, [key]: { status: 'ready', reading: body.reading } }));
    } catch (err) {
      setByKey((s) => ({ ...s, [key]: { status: 'error', message: err instanceof Error ? err.message : 'Could not interpret this comparison.' } }));
    }
  };

  return (
    <div className="well flex h-full min-h-[260px] flex-col p-5" aria-live="polite" aria-busy={state.status === 'loading'}>
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5zM18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
        </svg>
        <h3 className="text-[14px] font-semibold text-ink">What this means</h3>
      </div>

      {subjects.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-2">Pick at least one country to interpret.</p>
      ) : state.status === 'idle' ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 py-4">
          <p className="max-w-[52ch] text-[13.5px] leading-relaxed text-ink-2">
            Get a short reading of how {label} differ{subjects.length === 1 ? 's' : ''}
            {target ? ' from your target profile' : ''}, and what that means for messaging and creative.
          </p>
          <button type="button" onClick={run} className="btn-primary px-4 py-2 text-[13px]">
            Interpret with AI
          </button>
        </div>
      ) : state.status === 'loading' ? (
        <div className="mt-4 space-y-2.5" aria-label="Interpreting">
          {[92, 100, 84, 96, 70].map((w, i) => (
            <span key={i} className="block h-3 animate-pulse rounded-full bg-black/[0.07]" style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
          ))}
          <p className="pt-1 text-[12px] text-ink-2">Reading the comparison…</p>
        </div>
      ) : state.status === 'error' ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink">{state.message}</p>
          <button type="button" onClick={run} className="btn-secondary px-4 py-1.5 text-[13px]">
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="display materialize text-[18px] font-semibold leading-snug text-ink">{state.reading.headline}</p>
          <p className="materialize mt-1.5 text-[13.5px] leading-relaxed text-ink" style={{ ['--i' as string]: 1 }}>
            {state.reading.summary}
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-2.5 xl:grid-cols-2">
            {state.reading.points.map((p, i) => (
              <li key={p.title} className="materialize" style={{ ['--i' as string]: i + 2 }}>
                <p className="text-[13px] font-semibold text-ink">{p.title}</p>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{p.detail}</p>
              </li>
            ))}
          </ul>
          <p className="materialize mt-3 border-t border-black/[0.06] pt-3 text-[13px] leading-relaxed text-ink" style={{ ['--i' as string]: 6 }}>
            <span className="font-semibold">For creative: </span>
            {state.reading.implication}
          </p>
          <p className="mt-3 text-[11px] text-ink-2">AI-generated from Hofstede scores and the decoder brief. Check before sharing externally.</p>
        </div>
      )}
    </div>
  );
}
