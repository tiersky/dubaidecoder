'use client';

import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';
import { useState } from 'react';
import { fmt } from '@/lib/dashboard/format';
import MetricInfo from '@/components/atoms/MetricInfo';
import Switch from '@/components/atoms/Switch';
import Flag from '@/components/atoms/Flag';
import ShareBar from '@/components/atoms/ShareBar';
import AnimatedNumber from '@/components/atoms/AnimatedNumber';
import { formatMoney, relativeShare } from '@/lib/ui/theme';

const fmtScore = (v: number) => v.toFixed(2);
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface BudgetTableProps {
  markets: MarketVm[];
  metrics: MetricDef[];
  totalBudget: number;
  allocations?: AllocationRow[];
  currency: string;
  enabledNames: Set<string>;
  onToggleMarket: (name: string) => void;
}

export default function BudgetTable({
  markets,
  metrics,
  totalBudget,
  allocations,
  currency,
  enabledNames,
  onToggleMarket,
}: BudgetTableProps) {
  const allocationMap = new Map(allocations?.map((a) => [a.name, a]));

  const rows = markets.map((market) => {
    const enabled = enabledNames.has(market.name);
    const alloc = enabled ? allocationMap.get(market.name) : undefined;
    return {
      market,
      enabled,
      split: alloc?.split ?? 0,
      budget: alloc?.budget ?? 0,
      score: alloc?.score ?? 0,
    };
  });

  // Preserve the config order so toggling a market off doesn't make its
  // row jump — it just greys out in place.
  const sorted = rows;

  void totalBudget;

  const maxSplit = Math.max(0, ...sorted.map((r) => (r.enabled ? r.split : 0)));
  const fmtBudget = (v: number) => formatMoney(currency, v);
  const activeCount = sorted.filter((r) => r.enabled).length;
  // The pinned Market column only gets its own material once columns slide
  // under it; at rest it must read as part of the card.
  const [scrolled, setScrolled] = useState(false);
  // On + Market are pinned together, so nothing scrolls out beside them.
  const pinBg = `transition-[background-color,box-shadow] duration-200 ${
    scrolled ? 'bg-[#f9fafc]' : 'bg-transparent'
  }`;
  const pinOn = `sticky left-0 z-10 w-[60px] min-w-[60px] ${pinBg}`;
  const pinned = `sticky left-[60px] z-10 ${pinBg} ${
    scrolled ? 'shadow-[6px_0_12px_-8px_rgba(0,0,0,0.18)]' : ''
  }`;

  const headerCell =
    'px-3 py-3 text-right text-[11.5px] font-medium text-ink-2 whitespace-nowrap align-bottom last:pr-6';

  return (
    <section className="glass-card overflow-hidden" aria-label="Allocation by market">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-1 pt-5 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">Allocation by market</h2>
        <p className="text-xs text-ink-2">
          <span className="num">{activeCount}</span> of <span className="num">{sorted.length}</span> markets
          active • toggle markets to reallocate
        </p>
      </div>
      <div
        className="overflow-x-auto pb-2"
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 0)}
      >
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className={`${pinOn} pl-5 pr-2 py-3 text-left align-bottom text-[11.5px] font-medium text-ink-2 sm:pl-6`}>On</th>
              <th className={`${pinned} px-3 py-3 text-left align-bottom text-[11.5px] font-medium text-ink-2`}>
                Market
              </th>
              <th className={`${headerCell} min-w-[150px]`}>% Split</th>
              <th className={headerCell}>Budget ({currency})</th>
              <th className={headerCell}>Weighted score</th>
              {metrics.map((metric) => (
                <th key={metric.key} className={headerCell}>
                  <span className="inline-flex items-center gap-1">
                    {metric.label} <MetricInfo metric={metric} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const off = !row.enabled;
              const cell = 'border-t border-black/[0.05] px-3 py-2.5';
              const numericCell = `${cell} num text-right whitespace-nowrap last:pr-6 ${off ? 'text-ink-3' : 'text-ink'}`;
              return (
                <tr
                  key={row.market.name}
                  className="transition-opacity duration-300 hover:[&>td]:bg-black/[0.02]"
                  style={{ opacity: off ? 0.55 : 1 }}
                >
                  <td className={`${cell} ${pinOn} pl-5 pr-2 sm:pl-6`}>
                    <Switch
                      size="sm"
                      checked={row.enabled}
                      onChange={() => onToggleMarket(row.market.name)}
                      label={`Include ${row.market.name}`}
                    />
                  </td>
                  <td className={`${cell} ${pinned}`}>
                    <span className="flex items-center gap-2.5">
                      <Flag iso2={row.market.iso2} name={row.market.name} size="sm" />
                      <span className="whitespace-nowrap font-medium text-ink">{row.market.name}</span>
                    </span>
                  </td>
                  <td className={`${cell} text-right`}>
                    <span className="flex items-center justify-end gap-3">
                      <ShareBar value={row.enabled ? relativeShare(row.split, maxSplit) : 0} className="w-20" />
                      <span className={`num w-12 text-right font-medium ${off ? 'text-ink-3' : 'text-ink'}`}>
                        {row.enabled ? <AnimatedNumber value={row.split} format={fmtPct} /> : '—'}
                      </span>
                    </span>
                  </td>
                  <td className={`${numericCell} font-semibold`}>
                    {row.enabled ? <AnimatedNumber value={row.budget} format={fmtBudget} /> : '—'}
                  </td>
                  <td className={numericCell}>
                    {row.enabled ? <AnimatedNumber value={row.score} format={fmtScore} /> : '—'}
                  </td>
                  {metrics.map((metric) => (
                    <td key={metric.key} className={`${numericCell} ${off ? '' : 'text-ink-2'}`}>
                      {fmt(row.market.values[metric.key] ?? null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
