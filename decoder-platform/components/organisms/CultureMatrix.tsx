'use client';

import { useMemo, useRef, useState } from 'react';
import Flag from '@/components/atoms/Flag';
import MetricInfo from '@/components/atoms/MetricInfo';
import Pager from '@/components/atoms/Pager';
import { MarketVm } from '@/lib/dashboard/derive';
import { DIMENSIONS, cultureProfile, type CultureProfile, type DimensionKey } from '@/lib/insights/hofstede';
import { useFlip } from '@/lib/ui/use-flip';

const PAGE_SIZE = 10;

interface CultureMatrixProps {
  markets: MarketVm[];
  onSelectCountry: (market: MarketVm) => void;
  onOpenExplorer: () => void;
}

/**
 * Every market's six Hofstede scores as one sortable matrix. Grey intensity
 * carries the value (the blue ramp is reserved for budget); the sorted
 * column turns accent. Rows glide to their new place when the sort changes.
 */
export default function CultureMatrix({ markets, onSelectCountry, onOpenExplorer }: CultureMatrixProps) {
  const rows = useMemo(
    () =>
      markets
        .map((m) => ({ m, p: cultureProfile(m.iso2) }))
        .filter((r): r is { m: MarketVm; p: CultureProfile } => r.p !== null),
    [markets]
  );
  const [sort, setSort] = useState<{ key: DimensionKey; desc: boolean } | null>(null);
  const [hoverCol, setHoverCol] = useState<DimensionKey | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => dir * (a.p.scores[sort.key] - b.p.scores[sort.key]) || a.m.name.localeCompare(b.m.name));
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const bodyRef = useRef<HTMLDivElement>(null);
  useFlip(bodyRef, visible.map((r) => r.m.name).join('|'));

  if (!rows.length) return null;
  const missing = markets.length - rows.length;

  const onHeader = (key: DimensionKey) =>
    setSort((s) => (s?.key === key ? (s.desc ? { key, desc: false } : null) : { key, desc: true }));

  return (
    <section aria-label="Culture profiles" className="glass-card materialize p-4 sm:p-5" style={{ ['--i' as string]: 2 }}>
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Culture profiles</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Hofstede&apos;s six dimensions, 0 to 100. Sort by a column; open a market from its row.
          </p>
        </div>
        <button type="button" onClick={onOpenExplorer} className="press text-[13px] font-medium text-accent">
          Open culture explorer
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]" role="table" aria-label="Hofstede scores by market">
          <div role="row" className="grid grid-cols-[minmax(10rem,1.4fr)_repeat(6,minmax(0,1fr))] items-end gap-1.5 px-2 pb-2">
            <span role="columnheader" className="text-[11.5px] font-medium text-ink-2">
              Market
            </span>
            {DIMENSIONS.map((d) => {
              const active = sort?.key === d.key;
              return (
                <span role="columnheader" key={d.key} className="flex items-center justify-center gap-0.5" aria-sort={active ? (sort!.desc ? 'descending' : 'ascending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => onHeader(d.key)}
                    onMouseEnter={() => setHoverCol(d.key)}
                    onMouseLeave={() => setHoverCol(null)}
                    className={`press inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-center text-[11.5px] font-semibold leading-tight text-balance transition-colors duration-200 ${
                      active ? 'bg-accent/10 text-accent' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {d.label}
                    <svg
                      aria-hidden
                      className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${active ? 'opacity-100' : 'opacity-0'} ${active && !sort!.desc ? 'rotate-180' : ''}`}
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 4.5L6 7.5l3-3" />
                    </svg>
                  </button>
                  <MetricInfo metric={{ label: d.label, description: `${d.about} Low: ${d.low.toLowerCase()}. High: ${d.high.toLowerCase()}.` }} />
                </span>
              );
            })}
          </div>

          <div ref={bodyRef} role="rowgroup" className="space-y-1">
            {visible.map(({ m, p }, i) => (
              <div key={m.name} data-flip={m.name} role="row" className="materialize" style={{ ['--i' as string]: Math.min(i, 10) + 3 }}>
                <button
                  type="button"
                  onClick={() => onSelectCountry(m)}
                  aria-label={`Open ${m.name}`}
                  className="press grid w-full grid-cols-[minmax(10rem,1.4fr)_repeat(6,minmax(0,1fr))] items-center gap-1.5 rounded-[12px] px-2 py-1.5 text-left transition-colors duration-200 hover:bg-black/[0.03]"
                >
                  <span role="cell" className="flex min-w-0 items-center gap-2.5">
                    <Flag iso2={m.iso2} name={m.name} size="sm" />
                    <span className="truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                    {p.regional.length > 0 && (
                      <span className="whitespace-nowrap text-[10.5px] text-ink-2" title="Uses the Hofstede 'Arab countries' regional row where the market has no own score">
                        regional
                      </span>
                    )}
                  </span>
                  {DIMENSIONS.map((d) => {
                    const v = p.scores[d.key];
                    const accent = sort?.key === d.key;
                    const est = p.regional.includes(d.key);
                    const strength = 0.05 + (v / 100) * 0.55;
                    return (
                      <span
                        role="cell"
                        key={d.key}
                        className={`num flex h-9 items-center justify-center rounded-[9px] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-300 ${
                          hoverCol === d.key && !accent ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.12)]' : ''
                        }`}
                        style={{
                          background: accent ? `rgba(0, 113, 227, ${strength})` : `rgba(29, 29, 31, ${strength * 0.62})`,
                          color: strength > 0.42 ? '#fff' : 'var(--color-ink)',
                          fontStyle: est ? 'italic' : undefined,
                        }}
                        aria-label={`${d.label} ${v}${est ? ', regional estimate' : ''}`}
                      >
                        {v}
                      </span>
                    );
                  })}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-black/[0.06] px-1 pt-3 empty:hidden">
        <Pager page={current} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} />
      </div>

      <p className="mt-3 px-1 text-[11.5px] text-ink-2">
        Source: Hofstede 6-D model (2015), internal use. Italic figures are regional estimates.
        {missing > 0 && ` ${missing} market${missing === 1 ? ' has' : 's have'} no Hofstede data and ${missing === 1 ? 'is' : 'are'} not shown.`}
      </p>
    </section>
  );
}
