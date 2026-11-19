'use client';

import { useMemo, useRef, useState } from 'react';
import AnimatedNumber from '@/components/atoms/AnimatedNumber';
import Flag from '@/components/atoms/Flag';
import MetricInfo from '@/components/atoms/MetricInfo';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import Switch from '@/components/atoms/Switch';
import ScrollRow from '@/components/atoms/ScrollRow';
import RadarChart, { type RadarSeries } from '@/components/atoms/RadarChart';
import { MarketVm } from '@/lib/dashboard/derive';
import {
  DIMENSIONS,
  allProfiles,
  cultureProfile,
  fitScore,
  type DimensionKey,
  type Scores,
} from '@/lib/insights/hofstede';
import { useFlip } from '@/lib/ui/use-flip';
import CultureReadingBox from '@/components/organisms/CultureReadingBox';

interface CultureExplorerProps {
  markets: MarketVm[];
  onSelectMarket: (name: string) => void;
  slug: string;
  /** AI reading of the comparison; off for unpublished draft previews. */
  aiEnabled: boolean;
}

interface Entry {
  id: string;
  name: string;
  iso2: string | null;
  scores: Scores;
  regional: DimensionKey[];
  inDecoder: boolean;
}

type Mode = 'dimension' | 'profile';
const PIN_COLORS = ['#0071e3', '#1d1d1f', '#6aa9ee'];
const MAX_PINS = 3;

const mean = (entries: Entry[]): Scores => {
  const s = {} as Scores;
  for (const d of DIMENSIONS) s[d.key] = Math.round(entries.reduce((t, e) => t + e.scores[d.key], 0) / Math.max(1, entries.length));
  return s;
};

export default function CultureExplorer({ markets, onSelectMarket, slug, aiEnabled }: CultureExplorerProps) {
  const decoderEntries = useMemo<Entry[]>(
    () =>
      markets.flatMap((m) => {
        const p = cultureProfile(m.iso2);
        return p ? [{ id: `m:${m.name}`, name: m.name, iso2: m.iso2, scores: p.scores, regional: p.regional, inDecoder: true }] : [];
      }),
    [markets]
  );
  const worldEntries = useMemo<Entry[]>(() => {
    const taken = new Set(decoderEntries.map((e) => e.iso2));
    return allProfiles()
      .filter((p) => !taken.has(p.iso2))
      .map((p) => ({ id: `w:${p.iso2}`, name: p.name, iso2: p.iso2, scores: p.scores, regional: [], inDecoder: false }));
  }, [decoderEntries]);

  const [mode, setMode] = useState<Mode>('dimension');
  const [world, setWorld] = useState(false);
  const [sortKey, setSortKey] = useState<DimensionKey>('idv');
  const [descending, setDescending] = useState(true);
  const [target, setTarget] = useState<Scores>(() => mean(decoderEntries));
  const [included, setIncluded] = useState<Record<DimensionKey, boolean>>(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d.key, true])) as Record<DimensionKey, boolean>
  );
  const [pins, setPins] = useState<string[]>([]);

  const entries = useMemo(() => (world ? [...decoderEntries, ...worldEntries] : decoderEntries), [world, decoderEntries, worldEntries]);
  const weights = useMemo(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d.key, included[d.key] ? 1 : 0])) as Record<DimensionKey, number>,
    [included]
  );

  const ranked = useMemo(() => {
    const score = (e: Entry) => (mode === 'dimension' ? e.scores[sortKey] : fitScore(e.scores, target, weights));
    const dir = mode === 'dimension' && !descending ? 1 : -1;
    return entries
      .map((e) => ({ e, value: score(e) }))
      .sort((a, b) => dir * (a.value - b.value) || a.e.name.localeCompare(b.e.name));
  }, [entries, mode, sortKey, descending, target, weights]);

  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, ranked.map((r) => r.e.id).join('|'));

  const visiblePins = pins.filter((id) => entries.some((e) => e.id === id));
  const radarIds = visiblePins.length ? visiblePins : ranked.slice(0, 2).map((r) => r.e.id);
  const radarSeries: RadarSeries[] = radarIds.flatMap((id, i) => {
    const e = entries.find((x) => x.id === id);
    return e ? [{ id, label: e.name, color: PIN_COLORS[i % PIN_COLORS.length], values: DIMENSIONS.map((d) => e.scores[d.key]) }] : [];
  });
  if (mode === 'profile') {
    radarSeries.push({ id: 'target', label: 'Target profile', color: '#86868b', dashed: true, values: DIMENSIONS.map((d) => target[d.key]) });
  }

  const togglePin = (id: string) =>
    setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-MAX_PINS)));
  const pinColor = (id: string) => {
    const i = radarIds.indexOf(id);
    return i === -1 ? null : PIN_COLORS[i % PIN_COLORS.length];
  };

  const dimension = DIMENSIONS.find((d) => d.key === sortKey)!;
  const valueLabel = mode === 'dimension' ? dimension.label : 'Fit to target';

  if (!decoderEntries.length) {
    return (
      <div className="glass-card p-8 text-center">
        <h1 className="text-[17px] font-semibold text-ink">No culture data for these markets</h1>
        <p className="mt-1 text-[13px] text-ink-2">Hofstede publishes six-dimension scores for about 65 countries; none of this decoder&apos;s markets are among them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="display text-[26px] font-semibold text-ink sm:text-[28px]">Culture explorer</h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] text-ink-2">
            Rank markets on Hofstede&apos;s six cultural dimensions, or describe the audience you want and see which markets fit it best.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            items={[
              { id: 'dimension', label: 'Rank by dimension' },
              { id: 'profile', label: 'Match a profile' },
            ]}
            value={mode}
            onChange={(id) => setMode(id as Mode)}
            label="Ranking mode"
          />
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
            <Switch checked={world} onChange={() => setWorld((w) => !w)} label="Include all countries" size="sm" />
            All {decoderEntries.length + worldEntries.length} countries
          </label>
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section aria-label="Ranking controls" className="glass-card p-5 lg:order-1">
            {mode === 'dimension' ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[14px] font-semibold text-ink">Dimension</h2>
                  <SegmentedControl
                    items={[
                      { id: 'high', label: 'Highest' },
                      { id: 'low', label: 'Lowest' },
                    ]}
                    value={descending ? 'high' : 'low'}
                    onChange={(id) => setDescending(id === 'high')}
                    label="Sort direction"
                  />
                </div>
                <div className="mt-3 space-y-1">
                  {DIMENSIONS.map((d) => {
                    const on = d.key === sortKey;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSortKey(d.key)}
                        className={`press block w-full rounded-[12px] px-3 py-2 text-left transition-colors duration-200 ${
                          on ? 'bg-ink text-white' : 'hover:bg-black/[0.04]'
                        }`}
                      >
                        <span className={`block text-[13px] font-semibold ${on ? 'text-white' : 'text-ink'}`}>{d.label}</span>
                        <span className={`block text-[11.5px] ${on ? 'text-white/75' : 'text-ink-2'}`}>
                          {descending ? d.high : d.low} first
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[14px] font-semibold text-ink">Target audience profile</h2>
                <p className="mt-0.5 text-[12px] text-ink-2">Set the culture you are looking for. Switch a dimension off to ignore it.</p>
                <ScrollRow label="Start from a preset" className="mt-3">
                  <button type="button" className="chip flex-shrink-0 whitespace-nowrap" aria-pressed={false} onClick={() => setTarget(mean(decoderEntries))}>
                    Decoder average
                  </button>
                  {decoderEntries.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="chip flex-shrink-0 whitespace-nowrap"
                      aria-pressed={false}
                      onClick={() => setTarget({ ...e.scores })}
                    >
                      Like {e.name}
                    </button>
                  ))}
                </ScrollRow>
                <div className="mt-4 space-y-3.5">
                  {DIMENSIONS.map((d) => (
                    <div key={d.key}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1">
                          <Switch
                            size="sm"
                            checked={included[d.key]}
                            onChange={() => setIncluded((x) => ({ ...x, [d.key]: !x[d.key] }))}
                            label={`Use ${d.label}`}
                          />
                          <span className={`ml-1 truncate text-[12.5px] font-medium ${included[d.key] ? 'text-ink' : 'text-ink-3'}`}>{d.label}</span>
                          <MetricInfo metric={{ label: d.label, description: d.about }} />
                        </div>
                        <span className="num text-[12.5px] font-semibold text-ink">{target[d.key]}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={target[d.key]}
                        disabled={!included[d.key]}
                        onChange={(ev) => setTarget((t) => ({ ...t, [d.key]: Number(ev.target.value) }))}
                        aria-label={`Target ${d.label}`}
                        className="range mt-1"
                        style={{ ['--fill' as string]: `${target[d.key]}%` }}
                      />
                      <div className="flex justify-between text-[10.5px] text-ink-2">
                        <span>{d.low}</span>
                        <span>{d.high}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

        {/* Ranked list */}
        <section aria-label="Ranked markets" className="glass-card flex min-h-0 flex-col p-2 sm:p-3 lg:order-2">
          <div className="flex items-center justify-between px-3 pb-2 pt-2 text-[11.5px] font-medium text-ink-2">
            <span>
              {ranked.length} {world ? 'countries' : 'markets'} · click to compare on the radar
            </span>
            <span>{valueLabel}</span>
          </div>
          <div className="relative min-h-0 flex-1 lg:min-h-[420px]">
          <ol ref={listRef} className="max-h-[560px] overflow-y-auto overscroll-contain pr-1 lg:absolute lg:inset-0 lg:max-h-none">
            {ranked.map(({ e, value }, i) => {
              const color = pinColor(e.id);
              const pinned = visiblePins.includes(e.id);
              return (
                <li key={e.id} data-flip={e.id} className="relative">
                  <div
                    className={`group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors duration-200 ${
                      pinned ? 'bg-white/70 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_2px_8px_-4px_rgba(15,23,42,0.18)]' : 'hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className="num w-6 text-right text-[12px] font-semibold text-ink-2">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => togglePin(e.id)}
                      aria-pressed={pinned}
                      aria-label={`${pinned ? 'Remove' : 'Add'} ${e.name} ${pinned ? 'from' : 'to'} the radar`}
                      className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Flag iso2={e.iso2} name={e.name} size="md" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-medium text-ink">{e.name}</span>
                          {color && <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
                        </span>
                        <span className="block text-[11px] text-ink-2">
                          {e.inDecoder ? (e.regional.length ? `In this decoder · ${e.regional.length} regional estimates` : 'In this decoder') : 'Reference country'}
                        </span>
                      </span>
                    </button>
                    <Fingerprint scores={e.scores} active={mode === 'dimension' ? sortKey : null} />
                    <span className="num display w-14 text-right text-[17px] font-semibold text-ink">
                      <AnimatedNumber value={value} from={0} duration={600} format={(v) => (mode === 'dimension' ? String(Math.round(v)) : `${Math.round(v)}%`)} />
                    </span>
                    {e.inDecoder && (
                      <button
                        type="button"
                        onClick={() => onSelectMarket(e.name)}
                        aria-label={`Open ${e.name}`}
                        className="press hidden rounded-full p-1.5 text-ink-3 hover:bg-black/5 hover:text-ink sm:block"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          </div>
        </section>
      </div>

      {/* Compare: radar beside the AI reading */}
      <section aria-label="Radar comparison" className="glass-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Compare</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              {visiblePins.length ? 'Your picks' : 'The top two'} on all six dimensions
              {mode === 'profile' ? ', with your target profile dashed' : ''}. Click up to three rows above to choose.
            </p>
          </div>
          {visiblePins.length > 0 && (
            <button type="button" onClick={() => setPins([])} className="press text-[12.5px] font-medium text-accent">
              Clear picks
            </button>
          )}
        </div>
        <div className="mt-4 grid items-stretch gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="flex flex-col items-center">
            <div className="w-full max-w-[380px]">
              <RadarChart axes={DIMENSIONS.map((d) => d.label)} series={radarSeries} size={380} />
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-ink-2">
              {radarSeries.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={s.dashed ? { border: `1.5px dashed ${s.color}` } : { background: s.color }}
                    aria-hidden
                  />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {aiEnabled ? (
            <CultureReadingBox
              slug={slug}
              subjects={radarIds.flatMap((id) => {
                const e = entries.find((x) => x.id === id);
                return e?.iso2 ? [{ name: e.name, iso2: e.iso2 }] : [];
              })}
              target={mode === 'profile' ? target : null}
            />
          ) : (
            <div className="well flex items-center p-5 text-[13px] text-ink-2">AI reading is available on the published decoder.</div>
          )}
        </div>
      </section>

      <p className="px-1 text-[11.5px] text-ink-2">
        Source: Hofstede 6-D model dimension data (geerthofstede.com, 2015), for internal use. Gulf markets without their own scores use the
        &quot;Arab countries&quot; regional row, marked as regional estimates.
      </p>
    </div>
  );
}

/** Six tiny bars: the row's whole profile at a glance. */
function Fingerprint({ scores, active }: { scores: Scores; active: DimensionKey | null }) {
  return (
    <span className="hidden h-7 items-end gap-[3px] md:flex" aria-hidden>
      {DIMENSIONS.map((d) => (
        <span key={d.key} className="relative h-full w-[5px] overflow-hidden rounded-[2px] bg-black/[0.06]">
          <span
            className="bar-v absolute inset-x-0 bottom-0 h-full rounded-[2px]"
            style={{
              transform: `scaleY(${scores[d.key] / 100})`,
              background: active === d.key ? 'var(--color-accent)' : active ? '#c3c8d1' : '#9aa3b2',
            }}
          />
        </span>
      ))}
    </span>
  );
}
