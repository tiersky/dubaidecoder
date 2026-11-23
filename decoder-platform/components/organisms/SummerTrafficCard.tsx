'use client';

import { useState } from 'react';
import type { SeriesPoint, SummerTraffic } from '@/lib/config/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SUMMER_MONTHS = new Set([6, 7, 8, 9]);

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const fortnight = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Where ultra-high-net-worth audiences are in summer: private-jet arrivals
 * (OpenSky) and yacht activity (EMODnet) for a city market. Grey bars carry
 * the series; the peak turns accent (the blue ramp is reserved for budget).
 */
export default function SummerTrafficCard({ name, summer }: { name: string; summer: SummerTraffic }) {
  const { jets, yachts, notes } = summer;
  const stats = [
    jets && { label: 'Private jets per 2 days', value: fmt(jets.summerPer2Days), sub: 'Jun–Sep average' },
    jets?.uplift != null && { label: 'Summer vs off-season', value: `${jets.uplift.toFixed(1)}×`, sub: 'private-jet arrivals' },
    jets && { label: 'Est. private arrivals', value: fmt(jets.seasonArrivals), sub: 'Jun–Sep 2025' },
    yachts && { label: 'Yacht hours per month', value: fmt(yachts.summerHoursPerMonth), sub: `Jun–Sep ${yachts.year}` },
    yachts?.uplift != null && { label: 'Yacht summer lift', value: `${yachts.uplift.toFixed(1)}×`, sub: 'vs rest of year' },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  return (
    <section aria-label="Summer UHNW traffic" className="glass-card materialize p-5 sm:p-6" style={{ ['--i' as string]: 1 }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Summer UHNW traffic</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            Where the ultra-wealthy are in {name} from June to September: private-jet arrivals and yacht activity.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11.5px] text-ink-2">{s.label}</dt>
            <dd className="num display mt-0.5 text-[22px] font-semibold leading-tight text-ink">{s.value}</dd>
            <dd className="text-[11px] text-ink-2">{s.sub}</dd>
          </div>
        ))}
      </dl>

      <div className={`mt-6 grid gap-6 ${jets && yachts ? 'lg:grid-cols-2' : ''}`}>
        {jets && (
          <Bars
            title="Private-jet arrivals, every other weekend"
            caption={`Fri–Sat arrivals at ${jets.airports.join(', ')}`}
            points={jets.series}
            labelOf={(p) => fortnight(p.label)}
            highlight={(p) => p.label === jets.peak}
            unit="arrivals"
          />
        )}
        {yachts && (
          <Bars
            title={`Yacht activity by month, ${yachts.year}`}
            caption={`Pleasure-craft hours in the waters off ${yachts.sites.join(', ')}`}
            points={yachts.series}
            labelOf={(p) => MONTHS[Number(p.label) - 1]}
            highlight={(p) => Number(p.label) === yachts.peakMonth}
            emphasise={(p) => SUMMER_MONTHS.has(Number(p.label))}
            unit="hours"
          />
        )}
      </div>

      <ul className="mt-5 space-y-1 border-t border-black/[0.06] pt-4 text-[11.5px] leading-relaxed text-ink-2">
        {jets && (
          <li>
            Private jets: OpenSky Network arrivals, business jets and VIP airliners only, summer 2025 (Fri–Sat samples every two weeks).
            {jets.captureRate != null
              ? ` Scaled up for OpenSky's ${Math.round(jets.captureRate * 100)}% capture rate here, checked against EUROCONTROL airport traffic.`
              : ' Raw counts: no EUROCONTROL check here, so the true figure may be higher.'}
            {jets.gccShare != null && ` ${(jets.gccShare * 100).toFixed(1)}% of private arrivals were on GCC-registered aircraft (a floor: many Gulf jets are registered offshore).`}
          </li>
        )}
        {yachts && (
          <li>
            Yachts: EMODnet Human Activities vessel density (pleasure craft), hours per month in a 20 km box around each hub; counts all AIS-tracked
            pleasure craft, not only superyachts.
          </li>
        )}
        {notes?.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </section>
  );
}

function Bars({
  title,
  caption,
  points,
  labelOf,
  highlight,
  emphasise,
  unit,
}: {
  title: string;
  caption: string;
  points: SeriesPoint[];
  labelOf: (p: SeriesPoint) => string;
  highlight: (p: SeriesPoint) => boolean;
  emphasise?: (p: SeriesPoint) => boolean;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const H = 132;
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-[11.5px] text-ink-2">{caption}</p>
      <div className="relative mt-4 flex gap-1" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => {
          const peak = highlight(p);
          const on = hover === i;
          const h = Math.max(2, (p.value / max) * (H - 18));
          return (
            <button
              type="button"
              key={p.label}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${labelOf(p)}: ${fmt(p.value)} ${unit}${peak ? ', peak' : ''}`}
              className={`relative flex-1 rounded-[6px] transition-colors duration-200 ${on ? 'bg-black/[0.035]' : ''}`}
            >
              <span
                className="absolute inset-x-[18%] bottom-0 rounded-[4px] transition-[height] duration-500 ease-[var(--ease-out)]"
                style={{
                  height: h,
                  background: peak ? 'var(--color-accent)' : emphasise && !emphasise(p) ? '#dde1e8' : '#9aa3b2',
                }}
              />
              {(on || peak) && (
                <span className="num absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold text-ink" style={{ bottom: h + 3 }}>
                  {fmt(p.value)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1">
        {points.map((p) => (
          <span key={p.label} className={`num flex-1 truncate text-center text-[10.5px] ${highlight(p) ? 'font-semibold text-ink' : 'text-ink-2'}`}>
            {labelOf(p)}
          </span>
        ))}
      </div>
    </div>
  );
}
