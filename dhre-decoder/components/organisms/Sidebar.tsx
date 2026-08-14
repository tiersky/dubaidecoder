'use client';

import { useState, useMemo } from 'react';
import SearchInput from '@/components/atoms/SearchInput';
import CountryListItem from '@/components/molecules/CountryListItem';
import { Country, Tier, TIER_CONFIG } from '@/types';

const TIER_FILTERS: { value: Tier | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prime', label: 'Prime' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'excluded', label: 'Excluded' },
];

interface SidebarProps {
  countries: Country[];
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
}

export default function Sidebar({
  countries,
  selectedCountry,
  onSelectCountry,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all');
  const [mobileOpen, setMobileOpen] = useState(false);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { all: countries.length };
    for (const c of countries) {
      counts[c.tier] = (counts[c.tier] ?? 0) + 1;
    }
    return counts;
  }, [countries]);

  const filteredCountries = useMemo(() => {
    let filtered = countries;
    if (tierFilter !== 'all') {
      filtered = filtered.filter((c) => c.tier === tierFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [countries, searchTerm, tierFilter]);

  const sidebarContent = (
    <>
      <div className="p-4 space-y-3 border-b border-white/30">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search countries..."
        />
        <div className="flex flex-wrap gap-1">
          {TIER_FILTERS.map((f) => {
            const isActive = tierFilter === f.value;
            const tierColor = f.value !== 'all' ? TIER_CONFIG[f.value as Tier].color : undefined;
            const count = tierCounts[f.value] ?? 0;

            return (
              <button
                key={f.value}
                onClick={() => setTierFilter(f.value)}
                className={`
                  group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                  transition-all duration-200 select-none
                  ${isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white/50 text-slate-500 hover:bg-white/80 hover:text-slate-700'
                  }
                `}
              >
                {tierColor && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 transition-opacity duration-200 ${
                      isActive ? 'opacity-90' : 'opacity-60 group-hover:opacity-90'
                    }`}
                    style={{ backgroundColor: isActive ? '#fff' : tierColor }}
                  />
                )}
                <span>{f.label}</span>
                <span
                  className={`text-[9px] font-semibold tabular-nums transition-colors duration-200 ${
                    isActive ? 'text-white/60' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredCountries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No countries found
          </p>
        ) : (
          filteredCountries.map((country) => (
            <CountryListItem
              key={country.code}
              name={country.name}
              code={country.code}
              tier={country.tier}
              active={selectedCountry?.code === country.code}
              onClick={() => {
                onSelectCountry(country);
                setMobileOpen(false);
              }}
            />
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl glass-card shadow-md"
        aria-label="Toggle sidebar"
      >
        <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`glass-sidebar w-72 flex flex-col h-full overflow-hidden transition-transform duration-300 z-40
          ${mobileOpen ? 'fixed inset-y-0 left-0 translate-x-0' : 'fixed inset-y-0 left-0 -translate-x-full'}
          lg:relative lg:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
