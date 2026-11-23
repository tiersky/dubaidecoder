'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Flag from '@/components/atoms/Flag';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import ScrollRow from '@/components/atoms/ScrollRow';
import { DIMENSIONS, cultureProfile, type DimensionKey, type Scores } from '@/lib/insights/hofstede';
import { culturalDistance, orbitLayout, type OrbitMode } from '@/lib/insights/culture-space';
import type { SceneBody } from './Scene';

// three.js only loads once the Culture tab renders this card.
const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[12.5px] text-ink-2">Loading the culture map…</div>,
});

export interface CultureMapEntry extends SceneBody {
  regional: DimensionKey[];
}

interface CultureMapProps {
  entries: CultureMapEntry[];
  destination?: { iso2: string; name: string } | null;
  onOpenMarket: (name: string) => void;
}

type View = 'orbit' | 'space';

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const useReducedMotion = () =>
  useSyncExternalStore(subscribeMotion, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);

const average = (entries: CultureMapEntry[]): Scores => {
  const s = {} as Scores;
  for (const d of DIMENSIONS) s[d.key] = Math.round(entries.reduce((t, e) => t + e.scores[d.key], 0) / Math.max(1, entries.length));
  return s;
};

const dim = (k: DimensionKey) => DIMENSIONS.find((d) => d.key === k)!;

/**
 * Hofstede profiles in 3D. Orbit: markets circle a chosen centre at their
 * cultural distance from it, or at their score on one dimension. Space: a
 * cube with three dimensions on its axes. The scene itself is decorative for
 * screen readers; the market chips and the matrix below carry the data.
 */
export default function CultureMap({ entries, destination, onOpenMarket }: CultureMapProps) {
  const reducedMotion = useReducedMotion();
  const [view, setView] = useState<View>('orbit');
  const [orbitMode, setOrbitMode] = useState<OrbitMode>('distance');
  const [axes, setAxes] = useState<[DimensionKey, DimensionKey, DimensionKey]>(['pdi', 'uai', 'idv']);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Centre options: the decoder's destination (when Hofstede covers it), the
  // decoder average, then each market.
  const destProfile = destination ? cultureProfile(destination.iso2) : null;
  const centres = useMemo(() => {
    const list: { id: string; label: string; iso2: string | null; scores: Scores }[] = [];
    if (destination && destProfile) list.push({ id: `dest:${destProfile.iso2}`, label: destination.name, iso2: destProfile.iso2, scores: destProfile.scores });
    list.push({ id: 'average', label: 'Decoder average', iso2: null, scores: average(entries) });
    for (const e of entries) if (e.iso2 !== destProfile?.iso2) list.push({ id: e.id, label: e.name, iso2: e.iso2, scores: e.scores });
    return list;
  }, [destination, destProfile, entries]);
  const [centreId, setCentreId] = useState(centres[0].id);
  const centre = centres.find((c) => c.id === centreId) ?? centres[0];

  // The market that *is* the centre sits on the sun in distance mode, so hide its planet there.
  const centreBodyId = entries.find((e) => e.id === centre.id || (centre.iso2 && e.iso2 === centre.iso2))?.id ?? null;
  const bodies = useMemo(() => [...entries].sort((a, b) => a.name.localeCompare(b.name)), [entries]);
  // Angles come from the full list so planets keep their spoke when the centre
  // changes. The centre market's own distance is 0, so it never sets the scale.
  const layout = useMemo(() => {
    const { placements, scaleMax } = orbitLayout(bodies, centre.scores, orbitMode);
    return { scaleMax, placements: orbitMode === 'distance' ? placements.filter((p) => p.id !== centreBodyId) : placements };
  }, [bodies, centre.scores, orbitMode, centreBodyId]);

  // Pause frames (but keep the WebGL scene mounted) while the card is off screen.
  const boxRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const focusId = hovered ?? selected;
  const focus = entries.find((e) => e.id === focusId) ?? null;
  const focusDistance = focus ? culturalDistance(focus.scores, centre.scores) : null;

  const subtitle =
    view === 'space'
      ? `Each market placed by ${dim(axes[0]).label.toLowerCase()}, ${dim(axes[1]).label.toLowerCase()} and ${dim(axes[2]).label.toLowerCase()}. Drag to turn it.`
      : orbitMode === 'distance'
        ? `Markets orbit ${centre.label} at their cultural distance from it, across all six dimensions. Closer means more alike.`
        : `Each ring is a ${dim(orbitMode).label.toLowerCase()} score; farther out is more ${dim(orbitMode).high.toLowerCase()}. The blue ring is ${centre.label}.`;

  return (
    <section aria-label="Culture map" className="glass-card materialize overflow-hidden p-4 sm:p-5" style={{ ['--i' as string]: 1 }}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Culture map</h2>
          <p className="mt-0.5 max-w-[70ch] text-[12.5px] text-ink-2">{subtitle}</p>
        </div>
        <SegmentedControl
          items={[
            { id: 'orbit', label: 'Orbit' },
            { id: 'space', label: 'Culture space' },
          ]}
          value={view}
          onChange={(id) => setView(id as View)}
          label="Culture map view"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        {view === 'orbit' ? (
          <>
            <ScrollRow label="What the orbit shows" className="min-w-0 flex-1">
              <button type="button" className="chip flex-shrink-0 whitespace-nowrap" aria-pressed={orbitMode === 'distance'} onClick={() => setOrbitMode('distance')}>
                Overall distance
              </button>
              {DIMENSIONS.map((d) => (
                <button key={d.key} type="button" className="chip flex-shrink-0 whitespace-nowrap" aria-pressed={orbitMode === d.key} onClick={() => setOrbitMode(d.key)}>
                  {d.label}
                </button>
              ))}
            </ScrollRow>
            <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
              Centre
              <select value={centre.id} onChange={(e) => setCentreId(e.target.value)} className="glass-input appearance-none rounded-[var(--radius-control)] py-1.5 pl-3 pr-3 text-[12.5px] font-medium text-ink">
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          (['Across', 'Up', 'Depth'] as const).map((axisName, i) => (
            <label key={axisName} className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
              {axisName}
              <select
                value={axes[i]}
                onChange={(e) =>
                  setAxes((a) => {
                    const next = [...a] as typeof a;
                    const pick = e.target.value as DimensionKey;
                    const clash = next.indexOf(pick);
                    if (clash !== -1) next[clash] = next[i]; // swap rather than duplicate an axis
                    next[i] = pick;
                    return next;
                  })
                }
                className="glass-input appearance-none rounded-[var(--radius-control)] py-1.5 pl-3 pr-3 text-[12.5px] font-medium text-ink"
              >
                {DIMENSIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          ))
        )}
      </div>

      <div ref={boxRef} className="well relative mt-3 h-[440px] overflow-hidden sm:h-[520px]">
        <div className="absolute inset-0" aria-hidden>
          <Scene
            view={view}
            bodies={bodies}
            placements={layout.placements}
            orbitMode={orbitMode}
            scaleMax={layout.scaleMax}
            center={centre}
            axes={axes}
            selected={selected}
            hovered={hovered}
            onSelect={setSelected}
            onHover={setHovered}
            reducedMotion={reducedMotion}
            active={onScreen}
          />
        </div>

        {focus && (
          <div className="glass pointer-events-auto absolute bottom-3 left-3 w-[250px] rounded-[18px] p-3.5">
            <div className="flex items-center gap-2.5">
              <Flag iso2={focus.iso2} name={focus.name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{focus.name}</p>
                {focusDistance !== null && centreBodyId !== focus.id && (
                  <p className="text-[11.5px] text-ink-2">
                    Distance from {centre.label} <span className="num font-semibold text-ink">{focusDistance.toFixed(2)}</span>
                  </p>
                )}
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {DIMENSIONS.map((d) => {
                const v = focus.scores[d.key];
                const active = view === 'orbit' ? orbitMode === d.key : axes.includes(d.key);
                return (
                  <li key={d.key} className="grid grid-cols-[1fr_88px_24px] items-center gap-2 text-[11.5px]">
                    <span className={active ? 'font-semibold text-ink' : 'text-ink-2'}>{d.label}</span>
                    <span className="relative h-1.5 overflow-hidden rounded-full bg-black/[0.07]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: active ? 'var(--color-accent)' : '#9aa3b2' }} />
                    </span>
                    <span className={`num text-right font-semibold text-ink ${focus.regional.includes(d.key) ? 'italic' : ''}`}>{v}</span>
                  </li>
                );
              })}
            </ul>
            {selected === focus.id && (
              <button type="button" onClick={() => onOpenMarket(focus.name)} className="press mt-3 text-[12.5px] font-medium text-accent">
                Open {focus.name} →
              </button>
            )}
          </div>
        )}

        <p className="pointer-events-none absolute right-3 top-3 hidden text-[11px] text-ink-2 sm:block">Drag to turn · scroll to zoom · click a market</p>
      </div>

      <ScrollRow label="Markets on the map" className="mt-3">
        {bodies.map((b) => (
          <button
            key={b.id}
            type="button"
            className="chip flex-shrink-0 whitespace-nowrap"
            aria-pressed={selected === b.id}
            onClick={() => setSelected((s) => (s === b.id ? null : b.id))}
            onMouseEnter={() => setHovered(b.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {b.name}
          </button>
        ))}
      </ScrollRow>

      <p className="mt-3 px-1 text-[11.5px] text-ink-2">
        Distance is the Kogut–Singh index: the gap on each Hofstede dimension, scaled by how much that dimension varies worldwide, averaged over all six.
        For scale: the UK and the USA are 0.3 apart, the UK and China 3.4.
      </p>
    </section>
  );
}
