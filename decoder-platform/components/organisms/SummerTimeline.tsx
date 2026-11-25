'use client';

import { useMemo, useState } from 'react';
import type { MarketVm } from '@/lib/dashboard/derive';
import { SLOTS, summerTimeline, type TimelineRow } from '@/lib/dashboard/summer-timeline';

const MONTHS = [
  { month: 6, label: 'June' },
  { month: 7, label: 'July' },
  { month: 8, label: 'August' },
  { month: 9, label: 'September' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
// Grey carries the season, the accent marks each city's peak (blue ramps are budget).
// Most half-months sit at 60–100% of a city's peak, so the ramp is steepened
// (level³) to keep the busy weeks distinguishable from the merely busy.
const shade = (level: number) => `rgba(29, 29, 31, ${(0.05 + 0.62 * level ** 3).toFixed(3)})`;
const GRID = 'grid grid-cols-[minmax(112px,150px)_repeat(8,minmax(0,1fr))] gap-x-1';

interface Focus {
  row: TimelineRow | null;
  slot: number;
}

/**
 * When the season peaks in each city market: private-jet and yacht traffic per
 * half-month, each city scaled to its own busiest half-month. Rows run from the
 * earliest peak to the latest; the top row is the plan as a whole.
 */
export default function SummerTimeline({ markets, onSelect }: { markets: MarketVm[]; onSelect: (m: MarketVm) => void }) {
  const t = useMemo(() => summerTimeline(markets), [markets]);
  const byName = useMemo(() => new Map(markets.map((m) => [m.name, m])), [markets]);
  const [focus, setFocus] = useState<Focus | null>(null);
  if (!t.rows.length) return null;

  const busiest = t.overall.reduce<number>((b, v, i) => ((v ?? -1) > (t.overall[b] ?? -1) ? i : b), 0);
  const describe = (f: Focus): string => {
    const slot = SLOTS[f.slot].label;
    if (!f.row) {
      const n = t.peaks[f.slot];
      return `${slot}: the markets average ${Math.round((t.overall[f.slot] ?? 0) * 100)}% of their own peak; ${n} ${n === 1 ? 'market peaks' : 'markets peak'} here.`;
    }
    const c = f.row.cells[f.slot];
    if (c.level == null) return `${f.row.name}, ${slot}: no sample.`;
    const parts = [`${f.row.name}, ${slot}: ${Math.round(c.level * 100)}% of its peak${f.row.peak === f.slot ? ' (peak)' : ''}`];
    if (c.jets != null) parts.push(`${fmt(c.jets)} private jets per 2 days`);
    if (c.yachts != null) parts.push(`${fmt(c.yachts)} yacht hours in ${MONTHS[SLOTS[f.slot].month - 6].label}`);
    return parts.join(' · ');
  };

  return (
    <section aria-label="Summer timeline" className="glass-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Summer timeline</h2>
          <p className="mt-0.5 max-w-[640px] text-[12.5px] text-ink-2">
            When UHNW traffic peaks in each market, June to September. Each row is scaled to that market’s own busiest half-month, so it shows
            timing, not size.
          </p>
        </div>
        <p className="text-[12.5px] text-ink-2">
          Busiest overall: <span className="font-semibold text-ink">{SLOTS[busiest].label}</span>
        </p>
      </div>

      <div className="mt-5 overflow-x-auto" onMouseLeave={() => setFocus(null)}>
        <div className="min-w-[560px]">
          <div className={GRID}>
            <span />
            {MONTHS.map((m) => (
              <span key={m.month} className="col-span-2 border-l border-black/[0.08] pb-1.5 pl-1.5 text-[11.5px] font-medium text-ink-2">
                {m.label}
              </span>
            ))}
          </div>

          {/* The plan as a whole: mean level per half-month, and how many markets peak there. */}
          <div className={`${GRID} items-end border-b border-black/[0.08] pb-2`}>
            <span className="self-center text-[12px] font-semibold text-ink">All markets</span>
            {t.overall.map((v, i) => (
              <button
                type="button"
                key={i}
                onMouseEnter={() => setFocus({ row: null, slot: i })}
                onFocus={() => setFocus({ row: null, slot: i })}
                onBlur={() => setFocus(null)}
                aria-label={describe({ row: null, slot: i })}
                className="flex h-[72px] flex-col items-center justify-end rounded-[6px] hover:bg-black/[0.035]"
              >
                <span className="num mb-1 h-[14px] text-[10.5px] font-medium leading-none text-ink-2" aria-hidden>
                  {t.peaks[i] > 0 ? `${t.peaks[i]} peak${t.peaks[i] === 1 ? '' : 's'}` : ''}
                </span>
                <span className="flex h-[50px] w-[62%] items-end">
                  <span
                    className="w-full rounded-t-[4px] transition-[height] duration-500 ease-[var(--ease-out)]"
                    style={{ height: `${Math.max(4, (v ?? 0) * 100)}%`, background: i === busiest ? 'var(--color-accent)' : '#9aa3b2' }}
                  />
                </span>
              </button>
            ))}
          </div>

          <ul className="mt-2 space-y-1">
            {t.rows.map((r) => {
              const m = byName.get(r.name);
              return (
                <li key={r.name} className={GRID}>
                  <button
                    type="button"
                    onClick={() => m && onSelect(m)}
                    className="truncate rounded-[6px] px-1 text-left text-[12.5px] text-ink hover:text-accent focus-visible:text-accent"
                    title={`Open ${r.name}`}
                  >
                    {r.name}
                  </button>
                  {r.cells.map((c, i) => {
                    const peak = r.peak === i;
                    const on = focus?.row?.name === r.name && focus.slot === i;
                    return (
                      <button
                        type="button"
                        key={i}
                        onMouseEnter={() => setFocus({ row: r, slot: i })}
                        onFocus={() => setFocus({ row: r, slot: i })}
                        onBlur={() => setFocus(null)}
                        onClick={() => m && onSelect(m)}
                        aria-label={describe({ row: r, slot: i })}
                        className={`h-6 rounded-[4px] transition-shadow duration-150 ${on ? 'ring-2 ring-ink/40' : ''}`}
                        style={{
                          background: c.level == null ? 'repeating-linear-gradient(135deg, #eef0f3 0 3px, transparent 3px 6px)' : peak ? 'var(--color-accent)' : shade(c.level),
                        }}
                      />
                    );
                  })}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 min-h-[18px] text-[12px] text-ink">
        {focus ? describe(focus) : <span className="text-ink-2">Hover a cell for the numbers; click a market to open it.</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-black/[0.06] pt-3 text-[11.5px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--color-accent)' }} /> Market’s peak
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-8 rounded-[3px]" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(1)})` }} /> Quieter → busier
        </span>
        <span>
          Private jets: OpenSky, Fri–Sat samples every two weeks, summer 2025. Yachts: EMODnet monthly hours, 2023. Where a market has both, they’re
          averaged.
        </span>
      </div>
    </section>
  );
}
