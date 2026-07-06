'use client';

import { useState, useMemo } from 'react';
import SearchInput from '@/components/atoms/SearchInput';
import CountryListItem from '@/components/molecules/CountryListItem';
import { Country } from '@/types';

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!searchTerm) return countries;
    return countries.filter((country) =>
      country.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [countries, searchTerm]);

  const sidebarContent = (
    <>
      <div className="p-4 space-y-3 border-b border-white/30">
        {/* Search input */}
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search countries..."
        />
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
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl glass-card shadow-md"
        aria-label="Toggle sidebar"
      >
        <svg
          className="h-5 w-5 text-slate-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {mobileOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop always visible, mobile conditionally */}
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
