'use client';

import { Country } from '@/types';
import { formatPopulation, Allocation } from '@/lib/utils';

interface BudgetTableProps {
  allCountries: Country[];
  totalBudget: number;
  allocations?: Allocation[];
}

export default function BudgetTable({ allCountries, totalBudget, allocations }: BudgetTableProps) {
  const allocationMap = new Map(
    allocations?.map((a) => [a.code, a])
  );

  const rows = allCountries.map((country) => {
    const alloc = allocationMap.get(country.code);
    const percentSplit = alloc ? alloc.percentSplit : country.percentSplit;
    const budget = alloc ? alloc.budget : totalBudget * country.percentSplit;
    const weightedScore = alloc ? alloc.weightedScore : country.finalWeightedScore;
    return { country, percentSplit, budget, weightedScore };
  });

  const sorted = rows.sort((a, b) => b.percentSplit - a.percentSplit);

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200/60">
              <th className="px-3 py-3 text-left uppercase tracking-wider text-slate-400 font-medium">
                Country
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Population
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Luxury Spend/Cap
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Nov Travel Vol
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                GDP Growth
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Weighted Score
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                % Split
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Budget (AED)
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => (
              <tr
                key={row.country.code}
                className={`border-b border-slate-100/40 transition-colors hover:bg-slate-50/50 ${
                  index % 2 === 0 ? 'bg-white/30' : 'bg-slate-50/20'
                }`}
              >
                <td className="px-3 py-2.5 font-medium text-slate-700">
                  {row.country.name}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {formatPopulation(row.country.population)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  ${row.country.luxurySpendPerCapita.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {row.country.novTravelVolume.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {(row.country.gdpGrowth * 100).toFixed(2)}%
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {row.weightedScore.toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {(row.percentSplit * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700 tabular-nums">
                  AED {Math.round(row.budget).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
