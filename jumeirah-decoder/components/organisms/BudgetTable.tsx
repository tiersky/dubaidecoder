'use client';

import { Country } from '@/types';
import { formatPopulation, Allocation } from '@/lib/utils';

interface BudgetTableProps {
  allCountries: Country[];
  totalBudget: number;
  allocations?: Allocation[];
  enabledCodes: Set<string>;
  onToggleCountry: (code: string) => void;
}

const compactUSD = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

export default function BudgetTable({
  allCountries,
  totalBudget,
  allocations,
  enabledCodes,
  onToggleCountry,
}: BudgetTableProps) {
  const allocationMap = new Map(allocations?.map((a) => [a.code, a]));

  const rows = allCountries.map((country) => {
    const enabled = enabledCodes.has(country.code);
    const alloc = enabled ? allocationMap.get(country.code) : undefined;
    return {
      country,
      enabled,
      percentSplit: alloc?.percentSplit ?? 0,
      budget: alloc?.budget ?? 0,
      weightedScore: alloc?.weightedScore ?? 0,
    };
  });

  // Preserve the data-file order (revenue rank) so toggling a country off
  // doesn't make its row jump to the bottom — it just greys out in place.
  const sorted = rows;

  void totalBudget;

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
                Country
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Population
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Intl. Travellers
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Tourism Exp.
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Avg. Spend/Trip
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Google Travel Intent
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                GDP (PPP)/Cap
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">
                Confidence
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
            {sorted.map((row, index) => {
              const off = !row.enabled;
              const cellTone = off ? 'text-slate-400' : 'text-slate-600';
              const numericCell = `px-3 py-2.5 text-right tabular-nums ${cellTone}`;
              return (
                <tr
                  key={row.country.code}
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
                      onClick={() => onToggleCountry(row.country.code)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        row.enabled ? 'bg-blue-500' : 'bg-slate-300'
                      }`}
                      aria-label={`Toggle ${row.country.name}`}
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
                    {row.country.name}
                  </td>
                  <td className={numericCell}>
                    {formatPopulation(row.country.population)}
                  </td>
                  <td className={numericCell}>
                    {formatPopulation(row.country.internationalTravellers)}
                  </td>
                  <td className={numericCell}>
                    {compactUSD(row.country.tourismExpenditureUsd)}
                  </td>
                  <td className={numericCell}>
                    ${row.country.avgSpendPerTripUsd.toLocaleString()}
                  </td>
                  <td className={numericCell}>
                    {formatPopulation(row.country.googleTravelIntent)}
                  </td>
                  <td className={numericCell}>
                    ${row.country.gdpPppPerCapitaUsd.toLocaleString()}
                  </td>
                  <td className={numericCell}>
                    {row.country.confidenceScore.toFixed(2)}
                  </td>
                  <td className={numericCell}>
                    {row.enabled ? row.weightedScore.toFixed(2) : '—'}
                  </td>
                  <td className={numericCell}>
                    {row.enabled ? `${(row.percentSplit * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                      off ? 'text-slate-400' : 'text-slate-700'
                    }`}
                  >
                    {row.enabled
                      ? `AED ${Math.round(row.budget).toLocaleString()}`
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
