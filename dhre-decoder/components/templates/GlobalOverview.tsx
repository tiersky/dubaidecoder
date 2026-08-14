'use client';

import { Country, TIER_CONFIG, Tier } from '@/types';
import { regions } from '@/data/regions';
import GlassCard from '@/components/atoms/GlassCard';
import WorldMap from '@/components/organisms/WorldMap';
import RankedBarChart from '@/components/organisms/RankedBarChart';
import RegionalBreakdown from '@/components/organisms/RegionalBreakdown';

interface GlobalOverviewProps {
  countries: Country[];
  onSelectCountry: (country: Country) => void;
}

const TIER_COUNTS: { tier: Tier; label: string }[] = [
  { tier: 'prime', label: 'Prime' },
  { tier: 'secondary', label: 'Secondary' },
  { tier: 'monitoring', label: 'Monitoring' },
];

export default function GlobalOverview({ countries, onSelectCountry }: GlobalOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          International Market Prioritization
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Identify and prioritize markets where UAE appears more attractive for real estate investment
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard hover>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-800 tracking-tight">{countries.length}</p>
            <p className="text-sm font-medium text-slate-600 mt-1">Total Markets</p>
          </div>
        </GlassCard>
        {TIER_COUNTS.map(({ tier, label }) => {
          const count = countries.filter((c) => c.tier === tier).length;
          return (
            <GlassCard key={tier} hover>
              <div className="text-center">
                <p className="text-3xl font-bold tracking-tight" style={{ color: TIER_CONFIG[tier].color }}>
                  {count}
                </p>
                <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* World Map */}
      <GlassCard padding="p-4 sm:p-6">
        <WorldMap countries={countries} onSelectCountry={onSelectCountry} />
      </GlassCard>

      {/* Ranked Bar Chart */}
      <RankedBarChart countries={countries} />

      {/* Regional Breakdown */}
      <RegionalBreakdown countries={countries} regions={regions} />
    </div>
  );
}
