'use client';

import { useMemo, useState } from 'react';
import AnimatedNumber from '@/components/atoms/AnimatedNumber';
import MetricInfo from '@/components/atoms/MetricInfo';
import SegmentedControl from '@/components/atoms/SegmentedControl';
import Flag from '@/components/atoms/Flag';
import ScrollRow from '@/components/atoms/ScrollRow';
import { MarketVm } from '@/lib/dashboard/derive';
import { FACTS, formatFact, type CountryData, type FactDef, type SeriesPoint } from '@/lib/insights/facts';
import type { CountryDataState } from '@/lib/insights/use-country-data';

interface MarketContextProps {
  market: MarketVm;
  markets: MarketVm[];
  state: CountryDataState;
  compareName: string | null;
  onCompare: (name: string | null) => void;
  onSelectMarket: (name: string) => void;
  /** For city markets: the parent country whose data this section shows. */
  countryLabel?: string;
}

const COMPARE_FACTS = FACTS.filter((f) => f.key !== 'gdpGrowth' && f.key !== 'inflation');

/** Keeps a hover label inside the track near either end. */
const labelShift = (left: number) => (left < 15 ? '-12%' : left > 85 ? '-88%' : '-50%');

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function MarketContext({ market, markets, state, compareName, onCompare, onSelectMarket, countryLabel }: MarketContextProps) {
  if (state.status === 'unavailable') return null;
  const data = state.status === 'ready' ? state.data.countries : null;
  const own = market.iso2 && data ? data[market.iso2] : undefined;

  const peers = markets.filter((m) => m.iso2 && m.name !== market.name && data?.[m.iso2]);
  const compare = compareName ? markets.find((m) => m.name === compareName) : undefined;
  const compareData = compare?.iso2 && data ? data[compare.iso2] : undefined;

  return (
    <section aria-label={`${market.name} market context`} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Market context
            {countryLabel && <span className="font-medium text-ink-2"> · {countryLabel}, country level</span>}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">Public economic and social data, set against the other markets in this decoder.</p>
        </div>
        {peers.length > 0 && (
          <div className="flex min-w-0 max-w-full items-center gap-2 lg:max-w-[60%]">
            <span className="whitespace-nowrap text-[12px] text-ink-2">Compare with</span>
            <ScrollRow label="Compare with">
              {peers.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={compareName === p.name}
                  onClick={() => onCompare(compareName === p.name ? null : p.name)}
                  className="chip flex-shrink-0 whitespace-nowrap"
                >
                  <Flag iso2={p.iso2} name={p.name} size="sm" />
                  {p.name}
                </button>
              ))}
            </ScrollRow>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <CompareCard
          market={market}
          markets={markets}
          data={data}
          compareName={compare?.name ?? null}
          onSelectMarket={onSelectMarket}
        />
        <OutlookCard market={market} own={own} compare={compare} compareData={compareData} loading={!data} />
      </div>
      <p className="px-1 text-[11.5px] text-ink-2">
        Sources: IMF World Economic Outlook, World Bank, Our World in Data. Refreshed daily; each figure shows its year.
      </p>
    </section>
  );
}

/* ── Outlook: growth or inflation by year, projections tinted ─────────── */

const SERIES = [
  { id: 'gdpGrowth', label: 'GDP growth' },
  { id: 'inflation', label: 'Inflation' },
] as const;

function OutlookCard({
  market,
  own,
  compare,
  compareData,
  loading,
}: {
  market: MarketVm;
  own?: CountryData;
  compare?: MarketVm;
  compareData?: CountryData;
  loading: boolean;
}) {
  const [series, setSeries] = useState<'gdpGrowth' | 'inflation'>('gdpGrowth');
  const [hover, setHover] = useState<number | null>(null);
  const a = own?.outlook[series] ?? [];
  const b = compareData?.outlook[series] ?? [];
  const years = [...new Set([...a, ...b].map((p) => p.year))].sort((x, y) => x - y);
  const byYear = (pts: SeriesPoint[]) => new Map(pts.map((p) => [p.year, p]));
  const ma = byYear(a);
  const mb = byYear(b);
  const values = [...a, ...b].map((p) => p.value);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = hi - lo || 1;
  const H = 148;
  const zero = ((0 - lo) / span) * H; // px from the bottom
  const bar = (v: number) => ({
    height: Math.max(1.5, (Math.abs(v) / span) * H),
    bottom: v >= 0 ? zero : zero - (Math.abs(v) / span) * H,
  });
  const thisYear = a.find((p) => p.projected)?.year;

  return (
    <div className="glass-card materialize flex flex-col p-5 sm:p-6" style={{ ['--i' as string]: 2 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink">Economic outlook</h3>
        <SegmentedControl items={[...SERIES]} value={series} onChange={(id) => setSeries(id as typeof series)} label="Outlook series" />
      </div>

      {loading ? (
        <div className="mt-5 h-[188px] animate-pulse rounded-[14px] bg-black/[0.04]" />
      ) : years.length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-2">No IMF outlook for {market.name}.</p>
      ) : (
        <>
          <div className="relative mt-6" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            <div className="absolute inset-x-0 border-t border-dashed border-black/15" style={{ bottom: zero }} aria-hidden />
            <div className="absolute inset-0 flex">
              {years.map((y) => {
                const pa = ma.get(y);
                const pb = mb.get(y);
                const projected = (pa ?? pb)?.projected;
                const active = hover === y;
                return (
                  <button
                    type="button"
                    key={y}
                    onMouseEnter={() => setHover(y)}
                    onFocus={() => setHover(y)}
                    onBlur={() => setHover(null)}
                    aria-label={`${y}: ${market.name} ${pa ? formatFact('pct', pa.value) : 'no data'}${compare && pb ? `, ${compare.name} ${formatFact('pct', pb.value)}` : ''}${projected ? ', projection' : ''}`}
                    className={`relative flex-1 rounded-[8px] transition-colors duration-200 ${active ? 'bg-black/[0.035]' : ''}`}
                  >
                    {pa && (
                      <span
                        className="absolute rounded-[4px] transition-[height,bottom] duration-500 ease-[var(--ease-out)]"
                        style={{
                          ...bar(pa.value),
                          left: compare ? '22%' : '30%',
                          right: compare ? '52%' : '30%',
                          background: 'var(--color-accent)',
                          opacity: pa.projected ? 0.42 : 1,
                        }}
                      />
                    )}
                    {compare && pb && (
                      <span
                        className="absolute rounded-[4px] transition-[height,bottom] duration-500 ease-[var(--ease-out)]"
                        style={{
                          ...bar(pb.value),
                          left: '52%',
                          right: '22%',
                          background: 'var(--color-ink)',
                          opacity: pb.projected ? 0.32 : 0.85,
                        }}
                      />
                    )}
                    {pa && (active || y === thisYear) && (
                      <span
                        className="num absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-ink"
                        style={{ bottom: Math.max(zero, bar(pa.value).bottom + bar(pa.value).height) + 4 }}
                      >
                        {formatFact('pct', pa.value)}
                        {compare && pb && active && <span className="font-medium text-ink-2"> · {formatFact('pct', pb.value)}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex">
            {years.map((y) => (
              <span key={y} className={`num flex-1 text-center text-[11px] ${y === thisYear ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                {y}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
            <Legend color="var(--color-accent)" label={market.name} />
            {compare && <Legend color="var(--color-ink)" label={compare.name} />}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-accent/40" aria-hidden />
              Lighter: IMF projection
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/* ── Compare: every market on one track per fact ───────────────────────── */

function CompareCard({
  market,
  markets,
  data,
  compareName,
  onSelectMarket,
}: {
  market: MarketVm;
  markets: MarketVm[];
  data: Record<string, CountryData> | null;
  compareName: string | null;
  onSelectMarket: (name: string) => void;
}) {
  return (
    <div className="glass-card materialize p-5 sm:p-6" style={{ ['--i' as string]: 1 }}>
      <h3 className="text-[14px] font-semibold text-ink">How {market.name} compares</h3>
      <p className="mt-0.5 text-[12px] text-ink-2">
        Each dot is a market: blue is {market.name}{compareName ? `, dark is ${compareName}` : ''}. Hover a dot for its name and value; click to open it.
      </p>
      <div className="mt-4 divide-y divide-black/[0.06]">
        {COMPARE_FACTS.map((fact) => (
          <FactRow
            key={fact.key}
            fact={fact}
            market={market}
            markets={markets}
            data={data}
            compareName={compareName}
            onSelectMarket={onSelectMarket}
          />
        ))}
      </div>
    </div>
  );
}

function FactRow({
  fact,
  market,
  markets,
  data,
  compareName,
  onSelectMarket,
}: {
  fact: FactDef;
  market: MarketVm;
  markets: MarketVm[];
  data: Record<string, CountryData> | null;
  compareName: string | null;
  onSelectMarket: (name: string) => void;
}) {
  const points = useMemo(
    () =>
      markets
        .map((m) => ({ m, v: m.iso2 && data ? data[m.iso2]?.facts[fact.key] : undefined }))
        .filter((p): p is { m: MarketVm; v: NonNullable<typeof p.v> } => Boolean(p.v)),
    [markets, data, fact.key]
  );
  const own = points.find((p) => p.m.name === market.name)?.v;
  const log = fact.unit === 'people';
  const scale = (v: number) => (log ? Math.log10(Math.max(v, 1)) : v);
  const vals = points.map((p) => scale(p.v.value));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pos = (v: number) => (hi === lo ? 50 : 4 + ((scale(v) - lo) / (hi - lo)) * 92);
  const rank = own ? points.filter((p) => p.v.value > own.value).length + 1 : null;
  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover ? points.find((p) => p.m.name === hover) : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-x-5 py-3 sm:grid-cols-[minmax(0,13rem)_7rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="truncate text-[12.5px] font-medium text-ink">{fact.label}</p>
          <MetricInfo metric={{ label: fact.label, description: fact.about, source: fact.source }} />
        </div>
        <p className="num text-[11px] text-ink-2">
          {own ? `${rank ? `${ordinal(rank)} of ${points.length} · ` : ''}${own.year}` : data ? 'No data' : ' '}
        </p>
      </div>
      <p className="num display hidden text-right text-[16px] font-semibold text-ink sm:block">
        {own ? (
          <AnimatedNumber value={own.value} from={0} duration={900} format={(v) => formatFact(fact.unit, v)} />
        ) : (
          '—'
        )}
      </p>
      <div className="dot-track mx-2" onMouseLeave={() => setHover(null)}>
        {points.map(({ m, v }) => {
          const focus = m.name === market.name;
          const left = pos(v.value);
          const tip = `${m.name}: ${formatFact(fact.unit, v.value)} (${v.year})`;
          const show = () => setHover(m.name);
          return focus ? (
            <span key={m.name} className="dot" data-focus onMouseEnter={show} style={{ left: `${left}%` }} aria-hidden />
          ) : (
            <button
              key={m.name}
              type="button"
              className="dot"
              data-compare={m.name === compareName}
              aria-label={`Open ${tip}`}
              onMouseEnter={show}
              onFocus={show}
              onBlur={() => setHover(null)}
              onClick={() => onSelectMarket(m.name)}
              style={{ left: `${left}%` }}
            />
          );
        })}
        {hovered && (
          <span
            key={hovered.m.name}
            className="dot-label"
            style={{
              left: `${pos(hovered.v.value)}%`,
              transform: `translateX(${labelShift(pos(hovered.v.value))})`,
              ['--tx' as string]: labelShift(pos(hovered.v.value)),
            }}
          >
            <span className="font-semibold">{hovered.m.name}</span> · {formatFact(fact.unit, hovered.v.value)}
            <span className="text-white/60"> · {hovered.v.year}</span>
          </span>
        )}
      </div>
    </div>
  );
}
