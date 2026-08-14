'use client';

import { Country, TIER_CONFIG, Tier } from '@/types';
import { formatPopulation, Allocation } from '@/lib/utils';
import TierBadge from '@/components/atoms/TierBadge';

interface BudgetTableProps {
  allCountries: Country[];
  totalBudget: number;
  allocations: Allocation[];
  excludedCodes: Set<string>;
  onToggleCountry: (code: string) => void;
}

export default function BudgetTable({
  allCountries,
  totalBudget,
  allocations,
  excludedCodes,
  onToggleCountry,
}: BudgetTableProps) {
  const allocationMap = new Map(allocations.map((a) => [a.code, a]));

  const nonExcludedTier = allCountries.filter((c) => c.tier !== 'excluded');
  const excludedTier = allCountries.filter((c) => c.tier === 'excluded');

  const rows = nonExcludedTier
    .map((country) => {
      const isUserExcluded = excludedCodes.has(country.code);
      const alloc = allocationMap.get(country.code);
      return {
        country,
        isUserExcluded,
        percentSplit: alloc?.percentSplit ?? 0,
        budget: alloc?.budget ?? 0,
        weightedScore: alloc?.weightedScore ?? country.weightedScore,
      };
    })
    .sort((a, b) => {
      if (a.isUserExcluded !== b.isUserExcluded) return a.isUserExcluded ? 1 : -1;
      return b.percentSplit - a.percentSplit;
    });

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200/60">
              <th className="px-3 py-3 text-center uppercase tracking-wider text-slate-400 font-medium w-16">Include</th>
              <th className="px-3 py-3 text-left uppercase tracking-wider text-slate-400 font-medium">Country</th>
              <th className="px-3 py-3 text-left uppercase tracking-wider text-slate-400 font-medium">Tier</th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">Millionaires</th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">Score</th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">% Split</th>
              <th className="px-3 py-3 text-right uppercase tracking-wider text-slate-400 font-medium">Budget (AED)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.country.code}
                className={`border-b border-slate-100/40 transition-colors hover:bg-slate-50/50 ${
                  row.isUserExcluded
                    ? 'opacity-40'
                    : index % 2 === 0
                    ? 'bg-white/30'
                    : 'bg-slate-50/20'
                }`}
              >
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => onToggleCountry(row.country.code)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                      !row.isUserExcluded ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    aria-label={`Toggle ${row.country.name}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        !row.isUserExcluded ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-700">{row.country.name}</td>
                <td className="px-3 py-2.5"><TierBadge tier={row.country.tier} /></td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {row.country.millionairePopulation != null ? formatPopulation(row.country.millionairePopulation) : 'N/A'}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">{row.weightedScore.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                  {row.isUserExcluded ? '—' : `${(row.percentSplit * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-700 tabular-nums">
                  {row.isUserExcluded ? '—' : `AED ${Math.round(row.budget).toLocaleString()}`}
                </td>
              </tr>
            ))}

            {excludedTier.length > 0 && (
              <>
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-50/40">
                    Excluded from Allocation (Tier)
                  </td>
                </tr>
                {excludedTier.map((country) => (
                  <tr key={country.code} className="bg-red-50/20 border-b border-slate-100/40">
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] text-slate-400">N/A</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-400">{country.name}</td>
                    <td className="px-3 py-2.5"><TierBadge tier="excluded" /></td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">
                      {country.millionairePopulation != null ? formatPopulation(country.millionairePopulation) : 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{country.weightedScore.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">—</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">—</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
