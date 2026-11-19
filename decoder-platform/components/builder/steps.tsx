'use client';

import { useMemo, useState } from 'react';
import Flag from '@/components/atoms/Flag';
import Switch from '@/components/atoms/Switch';
import MetricInfo from '@/components/atoms/MetricInfo';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import CountryPicker from './CountryPicker';
import { Field, Pill, Section, inputCls, formatMoney, formatValue, isPercent, type Universe } from './shared';
import { buildConfig, effectiveModel, marketKey, previewAllocation, resolveValue, type BuilderMarket, type BuilderState } from '@/lib/builder/build';
import { CATALOG, canOptimise, catalogById, metricFromCatalog, type CatalogGroup } from '@/lib/builder/catalog';
import type { RecommendationItem, RecommendationSet } from '@/lib/config/types';
import type { MetricDef } from '@/lib/model/score';
import { EXPLAIN, modelSummary } from '@/lib/model/explain';

export interface StepProps {
  state: BuilderState;
  update: (fn: (s: BuilderState) => BuilderState) => void;
  universe: Universe;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

function marketFromUniverse(universe: Universe, iso2: string, origin: BuilderMarket['origin']): BuilderMarket | null {
  const c = universe.get(iso2);
  if (!c) return null;
  return { key: iso2, name: c.name, iso2, lat: c.lat, lng: c.lng, origin };
}

/* ── 1. Basics and starting countries ─────────────────────────────────── */

export function StepBasics({ state, update, universe }: StepProps) {
  const selected = new Set(state.markets.map((m) => m.key));
  return (
    <div className="space-y-5">
      <Section title="Decoder" hint="The name clients see, and the address the decoder lives at.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputCls}
              value={state.name}
              placeholder="Palm Jebel Ali Decoder"
              onChange={(e) => {
                const name = e.target.value;
                update((s) => ({ ...s, name, slug: s.mode === 'new' && (!s.slug || s.slug === slugify(s.name)) ? slugify(name) : s.slug }));
              }}
            />
          </Field>
          <Field label="Address" hint={state.mode === 'edit' ? 'Fixed for a published decoder.' : 'Lowercase letters, digits and hyphens.'}>
            <div className="flex items-center gap-1 text-[14px] text-ink-2">
              <span>/</span>
              <input
                className={inputCls}
                value={state.slug}
                disabled={state.mode === 'edit'}
                onChange={(e) => update((s) => ({ ...s, slug: slugify(e.target.value) }))}
              />
            </div>
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={state.currency} onChange={(e) => update((s) => ({ ...s, currency: e.target.value }))}>
              {['USD', 'AED', 'EUR', 'GBP', 'SAR', 'EGP'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Default budget">
            <input
              className={`${inputCls} num`}
              inputMode="numeric"
              value={state.defaultBudget ? state.defaultBudget.toLocaleString('en-US') : ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^0-9.]/g, ''));
                update((s) => ({ ...s, defaultBudget: Number.isFinite(n) ? n : 0 }));
              }}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Starting countries"
        hint="The markets you already plan to target. Suggestions are benchmarked against them, and every statistic is measured within the final list."
        aside={<Pill>{state.markets.length} selected</Pill>}
      >
        <CountryPicker
          universe={universe}
          selected={selected}
          onPick={(iso2) =>
            update((s) => {
              const m = marketFromUniverse(universe, iso2, 'seed');
              return m ? { ...s, markets: [...s.markets, m] } : s;
            })
          }
          placeholder="Add a country"
        />
        {state.markets.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {state.markets.map((m) => (
              <li key={m.key} className="flex items-center gap-2 rounded-full bg-white/70 py-1 pl-1.5 pr-1 text-[13px] text-ink shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
                <Flag iso2={m.iso2} name={m.name} />
                {m.name}
                {m.origin === 'recommended' && <Pill tone="accent">AI</Pill>}
                {m.enabled === false && <Pill>off</Pill>}
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      markets: s.markets.filter((x) => x.key !== m.key),
                      recommendations: s.recommendations && {
                        ...s.recommendations,
                        items: s.recommendations.items.map((i) => (i.iso2 === m.iso2 ? { ...i, status: 'excluded' as const } : i)),
                      },
                    }))
                  }
                  className="press flex h-5 w-5 items-center justify-center rounded-full text-ink-3 hover:bg-black/[0.06] hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-ink-3">Add at least one country to get suggestions.</p>
        )}
      </Section>
    </div>
  );
}

/* ── 2. Brief ─────────────────────────────────────────────────────────── */

export function StepBrief({ state, update, universe }: StepProps) {
  const destination = state.destination;
  return (
    <Section
      title="Brief"
      hint="What is being marketed, to whom and why. The AI reads this to judge which countries fit, so specifics (price point, audience, timing) make the suggestions sharper."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination" hint="Used for distance and to frame the suggestions.">
          {destination ? (
            <div className="flex items-center gap-2 rounded-[10px] bg-white/70 px-3 py-2 text-[14px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
              <Flag iso2={destination.iso2} name={destination.name} />
              <span className="flex-1">{destination.name}</span>
              <button type="button" className="text-[12px] font-medium text-accent" onClick={() => update((s) => ({ ...s, destination: null }))}>
                Change
              </button>
            </div>
          ) : (
            <CountryPicker
              universe={universe}
              selected={new Set()}
              placeholder="Destination country"
              onPick={(iso2) => {
                const c = universe.get(iso2);
                if (c) update((s) => ({ ...s, destination: { iso2, name: c.name, lat: c.lat, lng: c.lng } }));
              }}
            />
          )}
        </Field>
        <Field label="Industry">
          <input className={inputCls} value={state.industry} placeholder="Luxury residential real estate" onChange={(e) => update((s) => ({ ...s, industry: e.target.value }))} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Objective" hint="The outcome the budget is judged on.">
            <input
              className={inputCls}
              value={state.objective}
              placeholder="Qualified investment leads for off-plan villas"
              onChange={(e) => update((s) => ({ ...s, objective: e.target.value }))}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Brief">
            <textarea
              className={`${inputCls} min-h-[140px] resize-y leading-relaxed`}
              value={state.brief}
              maxLength={2000}
              placeholder="Waterfront villas on Palm Jebel Ali for high-net-worth international buyers seeking second homes and investment…"
              onChange={(e) => update((s) => ({ ...s, brief: e.target.value }))}
            />
          </Field>
        </div>
      </div>
    </Section>
  );
}

/* ── 3. Suggestions ───────────────────────────────────────────────────── */

export function StepSuggestions({
  state,
  update,
  universe,
  loading,
  error,
  onGenerate,
}: StepProps & { loading: boolean; error: string | null; onGenerate: () => void }) {
  const set = state.recommendations;
  const setStatus = (item: RecommendationItem, status: RecommendationItem['status']) =>
    update((s) => {
      const recs = s.recommendations!;
      let markets = s.markets;
      if (status === 'included' && !markets.some((m) => m.iso2 === item.iso2)) {
        const m = marketFromUniverse(universe, item.iso2, 'recommended');
        if (m) markets = [...markets, m];
      }
      if (status !== 'included') markets = markets.filter((m) => !(m.iso2 === item.iso2 && m.origin === 'recommended'));
      return { ...s, markets, recommendations: { ...recs, items: recs.items.map((i) => (i.iso2 === item.iso2 ? { ...i, status } : i)) } };
    });

  const seeds = state.markets.filter((m) => m.origin === 'seed');
  return (
    <div className="space-y-5">
      <Section
        title="Suggested markets"
        hint={
          <>
            Every country is ranked by how closely it resembles your {seeds.length} starting {seeds.length === 1 ? 'country' : 'countries'} on income,
            spending, scale, online access, development, distance and culture. Claude Opus then picks the best fits for the brief from that shortlist and
            explains why. Include the ones you want; excluded ones won’t be suggested again.
          </>
        }
        aside={
          <button type="button" className="btn-primary shrink-0 px-4 py-2 text-[13px]" disabled={loading || !seeds.length} onClick={onGenerate}>
            {loading ? 'Thinking…' : set ? 'Suggest again' : 'Suggest markets'}
          </button>
        }
      >
        {loading && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-[13px] text-ink-2">Ranking about 170 countries, then asking Opus to weigh them against the brief. This takes 20–60 seconds.</p>
            <div className="h-1 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full w-1/3 animate-[builder-progress_1.4s_var(--ease-in-out)_infinite] rounded-full bg-accent" />
            </div>
          </div>
        )}
        {error && !loading && <p className="text-[13px] text-red-700">{error}</p>}
        {!set && !loading && !error && <p className="text-[13px] text-ink-3">No suggestions yet.</p>}
        {set && !loading && <Suggestions set={set} onStatus={setStatus} />}
      </Section>
    </div>
  );
}

function Suggestions({ set, onStatus }: { set: RecommendationSet; onStatus: (i: RecommendationItem, s: RecommendationItem['status']) => void }) {
  const ai = set.model !== 'lookalike';
  return (
    <div>
      <div className="well rounded-[12px] p-4 text-[13px] leading-relaxed text-ink-2">
        <div className="mb-1 flex items-center gap-2">
          <Pill tone={ai ? 'accent' : 'neutral'}>{ai ? 'AI reading' : 'Lookalikes only'}</Pill>
          <span className="text-[11px] text-ink-3">{new Date(set.generatedAt).toLocaleString()}</span>
        </div>
        {set.summary}
      </div>
      {set.seedNotes && set.seedNotes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px] text-ink-2">
          {set.seedNotes.map((n) => (
            <li key={n.iso2}>
              <span className="font-semibold uppercase">{n.iso2}</span>: {n.note}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {set.items.map((item) => (
          <li
            key={item.iso2}
            className={`rounded-[14px] bg-white/70 p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] transition-opacity duration-200 ${item.status === 'excluded' ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start gap-3">
              <Flag iso2={item.iso2} name={item.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-semibold text-ink">{item.name}</h3>
                  <span className="num text-[12px] text-ink-2" title="Fit for the brief (AI) · similarity percentile to your markets">
                    {ai && <span className="font-semibold text-ink">{item.fit}</span>}
                    {ai && ' fit · '}
                    {item.lookalike}th pct
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-ink-2">{item.headline}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-[12.5px] leading-snug text-ink">
              {item.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-emerald-600">+</span>
                  {r}
                </li>
              ))}
              {item.risks.map((r, i) => (
                <li key={`r${i}`} className="flex gap-1.5 text-ink-2">
                  <span className="text-amber-600">!</span>
                  {r}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={`press rounded-full px-3 py-1 text-[12px] font-semibold ${item.status === 'included' ? 'bg-accent text-white' : 'bg-black/[0.05] text-ink'}`}
                onClick={() => onStatus(item, item.status === 'included' ? 'suggested' : 'included')}
                aria-pressed={item.status === 'included'}
              >
                {item.status === 'included' ? 'Included ✓' : 'Include'}
              </button>
              <button
                type="button"
                className="press rounded-full px-3 py-1 text-[12px] font-medium text-ink-2 hover:bg-black/[0.05]"
                onClick={() => onStatus(item, item.status === 'excluded' ? 'suggested' : 'excluded')}
                aria-pressed={item.status === 'excluded'}
              >
                {item.status === 'excluded' ? 'Undo exclude' : 'Exclude'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 4. Metrics ───────────────────────────────────────────────────────── */

const GROUPS: CatalogGroup[] = ['Audience', 'Media', 'Travel', 'Economy', 'Society'];

export function StepMetrics({ state, update }: StepProps) {
  const active = new Map(state.metrics.map((m) => [m.key, m]));
  const toggle = (id: string) =>
    update((s) => {
      if (s.metrics.some((m) => m.key === id)) return { ...s, metrics: s.metrics.filter((m) => m.key !== id) };
      const c = catalogById.get(id);
      return c ? { ...s, metrics: [...s.metrics, metricFromCatalog(c)] } : s;
    });
  const setMetric = (key: string, patch: Partial<MetricDef>) =>
    update((s) => ({ ...s, metrics: s.metrics.map((m) => (m.key === key ? { ...m, ...patch } : m)) }));
  const custom = state.metrics.filter((m) => !catalogById.has(m.key));
  const optimisable = canOptimise(state.metrics);

  return (
    <div className="space-y-5">
      <Section
        title="What the allocation weighs"
        hint="Pick the metrics that matter for this brief and how much each counts. Public data fills in by itself; the rest you type in on the next step. GWI and Aviationstack figures are typed in until those integrations are connected."
        aside={<Pill tone={optimisable ? 'good' : 'warn'}>{optimisable ? 'Can optimise for reach' : 'Needs audience + CPM to optimise'}</Pill>}
      >
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <div key={g}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g}</h3>
              <ul className="divide-y divide-black/[0.06]">
                {CATALOG.filter((c) => c.group === g).map((c) => {
                  const m = active.get(c.id);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <Switch checked={Boolean(m)} onChange={() => toggle(c.id)} label={c.label} size="sm" />
                      <div className="min-w-[180px] flex-1">
                        <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                          {c.label}
                          <MetricInfo metric={{ label: c.label, description: c.about, source: c.source }} />
                        </div>
                        <div className="text-[12px] text-ink-3">
                          {c.provider === 'manual' ? `Typed in · ${c.source}` : `Automatic · ${c.source}`} · {c.direction === 'higher' ? 'higher is better' : 'lower is better'}
                        </div>
                      </div>
                      {m && <WeightSlider value={m.weight} onChange={(weight) => setMetric(m.key, { weight })} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Custom metrics" hint="Anything else the client tracks, typed in per market: sales leads, CRM counts, search interest, an agency score.">
        {custom.length > 0 && (
          <ul className="mb-4 divide-y divide-black/[0.06]">
            {custom.map((m) => (
              <li key={m.key} className="flex flex-wrap items-center gap-3 py-2.5">
                <input className={`${inputCls} max-w-[240px]`} value={m.label} onChange={(e) => setMetric(m.key, { label: e.target.value })} aria-label="Metric name" />
                <select
                  className={`${inputCls} max-w-[170px]`}
                  value={m.direction}
                  onChange={(e) => setMetric(m.key, { direction: e.target.value as 'higher' | 'lower' })}
                  aria-label="Direction"
                >
                  <option value="higher">Higher is better</option>
                  <option value="lower">Lower is better</option>
                </select>
                <WeightSlider value={m.weight} onChange={(weight) => setMetric(m.key, { weight })} />
                <button
                  type="button"
                  className="text-[12px] font-medium text-red-700"
                  onClick={() => update((s) => ({ ...s, metrics: s.metrics.filter((x) => x.key !== m.key) }))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddCustom
          taken={new Set(state.metrics.map((m) => m.key))}
          onAdd={(label, direction) =>
            update((s) => {
              const base = `custom-${slugify(label) || 'metric'}`;
              let key = base;
              for (let i = 2; s.metrics.some((m) => m.key === key); i++) key = `${base}-${i}`;
              const metric: MetricDef = { key, label, weight: 3, direction, source: 'Custom', kind: 'measure', transform: 'none', provider: 'manual' };
              return { ...s, metrics: [...s.metrics, metric] };
            })
          }
        />
      </Section>
    </div>
  );
}

function WeightSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-ink-2">
      Weight
      <input type="range" min={0} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range w-28" aria-label="Weight" />
      <span className="num w-5 text-right font-semibold text-ink">{value}</span>
    </label>
  );
}

function AddCustom({ onAdd, taken }: { onAdd: (label: string, direction: 'higher' | 'lower') => void; taken: Set<string> }) {
  const [label, setLabel] = useState('');
  const [direction, setDirection] = useState<'higher' | 'lower'>('higher');
  void taken;
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAdd(label.trim(), direction);
        setLabel('');
      }}
    >
      <input className={`${inputCls} max-w-[260px]`} placeholder="Metric name, e.g. Sales leads" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
      <select className={`${inputCls} max-w-[170px]`} value={direction} onChange={(e) => setDirection(e.target.value as 'higher' | 'lower')} aria-label="Direction">
        <option value="higher">Higher is better</option>
        <option value="lower">Lower is better</option>
      </select>
      <button type="submit" className="btn-secondary px-4 py-2 text-[13px]" disabled={!label.trim()}>
        Add metric
      </button>
    </form>
  );
}

/* ── 5. Data ──────────────────────────────────────────────────────────── */

const PRIORITIES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function StepData({ state, update, universe }: StepProps) {
  const lookup = useMemo(() => ({ get: (iso2: string) => universe.get(iso2) }), [universe]);
  const manualMissing = state.markets.reduce(
    (n, m) => n + state.metrics.filter((x) => x.provider === 'manual' && resolveValue(state, m, x, lookup).value === null).length,
    0
  );
  const setValue = (mk: string, key: string, v: number | null) =>
    update((s) => {
      const row = { ...(s.values[mk] ?? {}) };
      if (v === null) delete row[key];
      else row[key] = v;
      return { ...s, values: { ...s.values, [mk]: row } };
    });

  return (
    <Section
      title="Market data"
      hint="Blue values come from public sources; type over one to override it. Empty typed-in fields lower a market’s coverage, and audience and CPM are needed for the optimised plan. Priority is your media expertise: 1× is neutral."
      aside={<Pill tone={manualMissing ? 'warn' : 'good'}>{manualMissing ? `${manualMissing} to fill` : 'All filled'}</Pill>}
    >
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
              <th className="sticky left-0 z-10 bg-[rgba(246,248,251,0.96)] px-2 py-2">Market</th>
              {state.metrics.map((m) => (
                <th key={m.key} className="px-2 py-2 font-semibold">
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                    {m.label}
                    <MetricInfo metric={m} />
                  </span>
                  <div className="font-normal normal-case tracking-normal text-ink-3">{isPercent(m) ? '%' : m.unit ?? ''}</div>
                </th>
              ))}
              <th className="px-2 py-2">
                <span className="inline-flex items-center gap-1">
                  Priority <MetricInfo metric={EXPLAIN.priority} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.markets.map((mk) => {
              const p = state.priorities[mk.key] ?? { priority: 1, reason: '' };
              return (
                <tr key={mk.key} className="align-top">
                  <td className="sticky left-0 z-10 border-t border-black/[0.06] bg-[rgba(246,248,251,0.96)] px-2 py-2">
                    <div className="flex items-center gap-2 whitespace-nowrap font-medium text-ink">
                      <Flag iso2={mk.iso2} name={mk.name} />
                      {mk.name}
                      {mk.origin === 'recommended' && <Pill tone="accent">AI</Pill>}
                    </div>
                  </td>
                  {state.metrics.map((metric) => (
                    <td key={metric.key} className="border-t border-black/[0.06] px-2 py-1.5">
                      <ValueCell
                        metric={metric}
                        resolved={resolveValue(state, mk, metric, lookup)}
                        onChange={(v) => setValue(mk.key, metric.key, v)}
                        label={`${mk.name}, ${metric.label}`}
                      />
                    </td>
                  ))}
                  <td className="border-t border-black/[0.06] px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <select
                        className="glass-input num rounded-[8px] px-2 py-1.5 text-[13px]"
                        value={p.priority}
                        aria-label={`${mk.name} priority`}
                        onChange={(e) => update((s) => ({ ...s, priorities: { ...s.priorities, [mk.key]: { ...p, priority: Number(e.target.value) } } }))}
                      >
                        {PRIORITIES.map((v) => (
                          <option key={v} value={v}>
                            {v}×
                          </option>
                        ))}
                      </select>
                      {p.priority !== 1 && (
                        <input
                          className="glass-input w-44 rounded-[8px] px-2 py-1.5 text-[12.5px]"
                          placeholder="Why? (shown on hover)"
                          value={p.reason}
                          maxLength={200}
                          onChange={(e) => update((s) => ({ ...s, priorities: { ...s.priorities, [mk.key]: { ...p, reason: e.target.value } } }))}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ValueCell({
  metric,
  resolved,
  onChange,
  label,
}: {
  metric: MetricDef;
  resolved: ReturnType<typeof resolveValue>;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const pct = isPercent(metric);
  const auto = metric.provider && metric.provider !== 'manual';
  const typed = resolved.source === 'typed' || resolved.source === 'override';
  const shown = typed && resolved.value !== null ? String(pct ? +(resolved.value * 100).toFixed(4) : resolved.value) : '';
  const [draft, setDraft] = useState<string | null>(null);
  const placeholder = !typed && resolved.value !== null ? formatValue(resolved.value, metric) : auto ? 'No data' : '';
  const missing = resolved.value === null;
  return (
    <div className="w-[116px]">
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft ?? shown}
        placeholder={placeholder}
        onFocus={() => setDraft(shown)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const raw = (draft ?? '').replace(/[,%\s]/g, '');
          setDraft(null);
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(pct ? n / 100 : n);
        }}
        className={`num w-full rounded-[8px] px-2 py-1.5 text-right text-[13px] outline-none transition-shadow duration-150 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,113,227,0.18)] ${
          missing && !auto
            ? 'bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.35)]'
            : !typed && auto
              ? 'bg-[rgba(0,113,227,0.06)] placeholder:text-accent'
              : 'bg-white/70 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)]'
        }`}
      />
      {resolved.source === 'override' && <div className="mt-0.5 text-right text-[10.5px] text-ink-3">overridden</div>}
      {resolved.source === 'saved' && <div className="mt-0.5 text-right text-[10.5px] text-ink-3">as saved</div>}
    </div>
  );
}

/* ── 6. Review ────────────────────────────────────────────────────────── */

export function StepReview({ state, update, universe }: StepProps) {
  const lookup = useMemo(() => ({ get: (iso2: string) => universe.get(iso2) }), [universe]);
  const { config, missing } = useMemo(() => buildConfig(state, lookup), [state, lookup]);
  const result = useMemo(() => previewAllocation(config), [config]);
  const model = effectiveModel(state);
  const summary = modelSummary(model);
  const optimisable = canOptimise(state.metrics);
  const rows = [...result.rows].sort((a, b) => b.budget - a.budget);
  const optimised = model === 'optimised';

  return (
    <div className="space-y-5">
      <Section
        title="Allocation preview"
        hint={`At the default budget of ${formatMoney(state.defaultBudget, state.currency)}. This is exactly what the published decoder will show.`}
        aside={
          <SegmentedControl
            label="Model"
            value={model}
            onChange={(id) => update((s) => ({ ...s, model: id as BuilderState['model'] }))}
            items={[
              ...(optimisable ? [{ id: 'optimised', label: 'Optimised' }] : []),
              { id: 'score', label: 'Score-weighted' },
              ...(state.extras.allocation ? [{ id: 'workbook', label: 'Workbook' }] : []),
            ]}
          />
        }
      >
        <div className="well mb-4 rounded-[12px] p-4 text-[13px] leading-relaxed text-ink-2">
          <div className="font-semibold text-ink">{summary.title}</div>
          <p className="mt-1">{summary.body}</p>
          <p className="mt-2 text-[12.5px]">
            <span className="font-semibold text-ink">How accurate: </span>
            {summary.accuracy}
          </p>
        </div>
        {result.error && <p className="mb-3 text-[13px] text-red-700">{result.error}</p>}
        {result.warnings.length > 0 && (
          <ul className="mb-3 space-y-1 text-[12.5px] text-amber-800">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-3">
                <th className="px-2 py-2">Market</th>
                {(['budget', 'share', 'quality', 'coverage', 'priority', ...(optimised ? (['reach', 'saturation'] as const) : [])] as const).map((k) => (
                  <th key={k} className="px-2 py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      {EXPLAIN[k].label}
                      <MetricInfo metric={EXPLAIN[k]} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r) => {
                const mk = state.markets.find((m) => m.name === r.name);
                return (
                  <tr key={r.name} className="border-t border-black/[0.06]">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        {mk && <Flag iso2={mk.iso2} name={mk.name} />}
                        {r.name}
                        {mk?.origin === 'recommended' && <Pill tone="accent">AI</Pill>}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-ink">{formatMoney(r.budget, state.currency)}</td>
                    <td className="px-2 py-2 text-right">{(r.share * 100).toFixed(1)}%</td>
                    <td className="px-2 py-2 text-right">{r.quality !== undefined ? r.quality.toFixed(2) : '–'}</td>
                    <td className={`px-2 py-2 text-right ${r.coverage !== undefined && r.coverage < 1 ? 'text-amber-700' : ''}`}>
                      {r.coverage !== undefined ? `${Math.round(r.coverage * 100)}%` : '–'}
                    </td>
                    <td className="px-2 py-2 text-right">{r.priority !== undefined ? `${+r.priority.toFixed(2)}×` : '–'}</td>
                    {optimised && <td className="px-2 py-2 text-right">{r.reach !== undefined ? formatValue(r.reach, { key: '', unit: 'people' }) : '–'}</td>}
                    {optimised && <td className="px-2 py-2 text-right">{r.saturation !== undefined ? `${Math.round(r.saturation * 100)}%` : '–'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {missing.length > 0 && (
        <Section title={`${missing.length} empty value${missing.length === 1 ? '' : 's'}`} hint="Typed-in values must be filled before publishing. Public values with no data just lower coverage.">
          <ul className="grid gap-x-6 gap-y-1 text-[12.5px] text-ink-2 sm:grid-cols-2">
            {missing.slice(0, 24).map((m, i) => (
              <li key={i}>
                {m.market}: {m.metric}
              </li>
            ))}
            {missing.length > 24 && <li>…and {missing.length - 24} more</li>}
          </ul>
        </Section>
      )}
    </div>
  );
}

export { marketKey };
