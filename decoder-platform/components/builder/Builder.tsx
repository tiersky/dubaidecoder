'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tooltip } from 'react-tooltip';
import type { BuilderState } from '@/lib/builder/build';
import { CATALOG, metricFromCatalog } from '@/lib/builder/catalog';
import type { RecommendationSet } from '@/lib/config/types';
import type { Universe as UniversePayload } from '@/lib/recommend/universe';
import { saveGuidedAction } from '@/app/admin/build-actions';
import { StepBasics, StepBrief, StepData, StepMetrics, StepReview, StepSuggestions } from './steps';
import type { Universe } from './shared';

const STEPS = ['Countries', 'Brief', 'Suggestions', 'Metrics', 'Data', 'Review'] as const;

/** A brand-new session and each saved decoder keep separate local copies. */
const storageKey = (initialSlug: string) => (initialSlug ? `builder:${initialSlug}` : 'builder:new');

export default function Builder({ initial, resumeLocal }: { initial: BuilderState; resumeLocal: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<BuilderState>(() =>
    initial.mode === 'new' && initial.metrics.length === 0
      ? { ...initial, metrics: CATALOG.filter((c) => c.recommended).map((c) => metricFromCatalog(c)) }
      : initial
  );
  const [step, setStep] = useState(0);
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const key = storageKey(initial.slug);

  // Restore an unsaved session for a new decoder (after mount, so SSR matches).
  useEffect(() => {
    if (!resumeLocal) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw) as { state: BuilderState; step: number };
      if (saved?.state?.v === 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
        setState(saved.state);
        setStep(Math.min(Math.max(0, saved.step | 0), STEPS.length - 1));
      }
    } catch {
      /* a corrupt entry is ignored */
    }
  }, [key, resumeLocal]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ state, step }));
    } catch {
      /* storage full or disabled: the server draft is the real save */
    }
  }, [key, state, step]);

  useEffect(() => {
    let live = true;
    fetch('/admin/api/universe')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? 'Country data is unavailable.');
        return body as UniversePayload;
      })
      .then((u) => live && setUniverse(new Map(u.countries.map((c) => [c.iso2, c]))))
      .catch((e: Error) => live && setUniverseError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const update = useCallback((fn: (s: BuilderState) => BuilderState) => setState((s) => fn(s)), []);

  const seeds = state.markets.filter((m) => m.origin === 'seed' && m.iso2);
  const generate = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const excluded = state.recommendations?.items.filter((i) => i.status === 'excluded').map((i) => i.iso2) ?? [];
      const included = state.markets.filter((m) => m.origin === 'recommended' && m.iso2).map((m) => m.iso2!);
      const res = await fetch('/admin/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name,
          seeds: seeds.map((m) => m.iso2),
          exclude: [...excluded, ...included],
          destination: state.destination,
          industry: state.industry,
          objective: state.objective,
          brief: state.brief,
        }),
      });
      const body = (await res.json()) as { set?: RecommendationSet; error?: string; aiError?: string };
      if (!res.ok || !body.set) throw new Error(body.error ?? 'Suggestions failed.');
      const fresh = body.set;
      setState((s) => {
        // Keep earlier decisions: included and excluded items stay with their status.
        const kept = s.recommendations?.items.filter((i) => i.status !== 'suggested') ?? [];
        const keptIso = new Set(kept.map((i) => i.iso2));
        return { ...s, recommendations: { ...fresh, items: [...fresh.items.filter((i) => !keptIso.has(i.iso2)), ...kept] } };
      });
      if (body.aiError) setRecError(body.aiError === 'not-configured' ? null : 'The AI didn’t answer, so these are lookalikes only. Try again for a full reading.');
    } catch (e) {
      setRecError(e instanceof Error ? e.message : 'Suggestions failed.');
    } finally {
      setRecLoading(false);
    }
  }, [state, seeds]);

  const blockers = useMemo(() => {
    const b: string[] = [];
    if (!state.name.trim()) b.push('a name');
    if (!state.slug) b.push('an address');
    if (!state.markets.length) b.push('at least one country');
    if (!state.metrics.length) b.push('at least one metric');
    if (!(state.defaultBudget > 0)) b.push('a budget');
    return b;
  }, [state]);

  const save = (intent: 'draft' | 'publish') =>
    startSaving(async () => {
      setNotice(null);
      const r = await saveGuidedAction(JSON.stringify(state), intent);
      if (!r.ok) {
        setNotice({ tone: 'error', text: r.error ?? 'Saving failed.' });
        return;
      }
      if (intent === 'publish') {
        localStorage.removeItem(key);
        router.push(`/${r.slug}`);
        return;
      }
      setNotice({ tone: 'ok', text: 'Draft saved. Preview it or keep editing.' });
      if (!initial.slug) {
        localStorage.removeItem(key);
        router.replace(`/admin/${r.slug}/build`);
      }
    });

  const canNext = step === 0 ? state.markets.length > 0 && Boolean(state.name.trim() && state.slug) : true;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-8">
      <Tooltip id="metric-tooltip" className="tip" opacity={1} noArrow offset={8} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-[13px] font-medium text-accent">
            ← Admin
          </Link>
          <h1 className="display mt-1 text-[28px] font-semibold tracking-[-0.02em] text-ink">
            {state.mode === 'edit' ? `Edit ${state.name || state.slug}` : 'New decoder'}
          </h1>
        </div>
        {!initial.slug && (
          <button
            type="button"
            className="text-[12.5px] font-medium text-ink-2 hover:text-ink"
            onClick={() => {
              localStorage.removeItem(key);
              setState({ ...initial, metrics: CATALOG.filter((c) => c.recommended).map((c) => metricFromCatalog(c)) });
              setStep(0);
            }}
          >
            Start over
          </button>
        )}
      </header>

      <nav aria-label="Steps" className="mt-6">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(i)}
                disabled={i > 0 && !state.markets.length}
                aria-current={i === step ? 'step' : undefined}
                className={`press rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 ${
                  i === step ? 'bg-ink text-white' : 'bg-white/60 text-ink-2 hover:bg-white/90 hover:text-ink'
                }`}
              >
                <span className="num mr-1.5 opacity-60">{i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6">
        {!universe ? (
          <div className="glass-card p-6 text-[13px] text-ink-2">
            {universeError ?? 'Loading public data for every country (a few seconds the first time)…'}
          </div>
        ) : step === 0 ? (
          <StepBasics state={state} update={update} universe={universe} />
        ) : step === 1 ? (
          <StepBrief state={state} update={update} universe={universe} />
        ) : step === 2 ? (
          <StepSuggestions state={state} update={update} universe={universe} loading={recLoading} error={recError} onGenerate={generate} />
        ) : step === 3 ? (
          <StepMetrics state={state} update={update} universe={universe} />
        ) : step === 4 ? (
          <StepData state={state} update={update} universe={universe} />
        ) : (
          <StepReview state={state} update={update} universe={universe} />
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-3">
          <button type="button" className="btn-secondary px-4 py-2 text-[13px]" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          <div className="min-w-0 flex-1 text-[12.5px]" aria-live="polite">
            {notice ? (
              <span className={notice.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}>
                {notice.text}{' '}
                {notice.tone === 'ok' && (
                  <Link href={`/admin/${state.slug}/preview`} className="font-semibold underline underline-offset-2">
                    Preview
                  </Link>
                )}
              </span>
            ) : blockers.length ? (
              <span className="text-ink-3">Still needs {blockers.join(', ')}.</span>
            ) : null}
          </div>
          {step === STEPS.length - 1 ? (
            <>
              <button type="button" className="btn-secondary px-4 py-2 text-[13px]" disabled={saving || blockers.length > 0} onClick={() => save('draft')}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" className="btn-primary px-4 py-2 text-[13px]" disabled={saving || blockers.length > 0} onClick={() => save('publish')}>
                Publish
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary px-5 py-2 text-[13px]" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
