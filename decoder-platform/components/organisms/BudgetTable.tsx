'use client';

import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';
import MetricInfo from '@/components/atoms/MetricInfo';

interface BudgetTableProps {
  markets: MarketVm[];
  metrics: MetricDef[];
  totalBudget: number;
  allocations?: AllocationRow[];
  currency: string;
  enabledNames: Set<string>;
  onToggleMarket: (name: string) => void;
}

function fmt(v: number | null): string {
  if (v === null) return '—';
  if (Math.abs(v) < 1) return v.toFixed(2);
  return Math.round(v).toLocaleString();
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

  const headerCell =
    'px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium';

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200/60">
              <th className="px-3 py-3 text-center uppercase tracking-wider text-slate-400 font-medium w-16">
                Active
              </th>
              <th className="px-3 py-3 text-left uppercase tracking-wider text-slate-400 font-medium">
                Market
              </th>
              {metrics.map((metric) => (
                <th key={metric.key} className={headerCell}>
                  <span className="inline-flex items-center gap-1">
                    {metric.label} <MetricInfo metric={metric} />
                  </span>
                </th>
              ))}
              <th className={headerCell}>Weighted Score</th>
              <th className={headerCell}>% Split</th>
              <th className={headerCell}>Budget ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const off = !row.enabled;
              const cellTone = off ? 'text-slate-400' : 'text-slate-600';
              const numericCell = `px-3 py-2.5 text-right tabular-nums ${cellTone}`;
              return (
                <tr
                  key={row.market.name}
                  className={`border-b border-slate-100/40 transition-colors hover:bg-slate-50/50 ${
                    off
                      ? 'bg-slate-50/40 opacity-60'
                      : index % 2 === 0
                      ? 'bg-white/30'
                      : 'bg-slate-50/20'
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => onToggleMarket(row.market.name)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        row.enabled ? 'bg-blue-500' : 'bg-slate-300'
                      }`}
                      aria-label={`Toggle ${row.market.name}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          row.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td
                    className={`px-3 py-2.5 font-medium ${
                      off ? 'text-slate-500' : 'text-slate-700'
                    }`}
                  >
                    {row.market.name}
                  </td>
                  {metrics.map((metric) => (
                    <td key={metric.key} className={numericCell}>
                      {fmt(row.market.values[metric.key] ?? null)}
                    </td>
                  ))}
                  <td className={numericCell}>
                    {row.enabled ? row.score.toFixed(2) : '—'}
                  </td>
                  <td className={numericCell}>
                    {row.enabled ? `${(row.split * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                      off ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {row.enabled
                      ? `${currency} ${Math.round(row.budget).toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
