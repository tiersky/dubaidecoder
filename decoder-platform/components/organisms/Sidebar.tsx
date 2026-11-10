'use client';

import { useState, useMemo } from 'react';
import SearchInput from '@/components/atoms/SearchInput';
import CountryListItem from '@/components/molecules/CountryListItem';

interface SidebarProps {
  markets: Array<{ name: string; iso2: string | null }>;
  selected: string | null;
  onSelect: (name: string | null) => void;
  /** Called after a pick, so the mobile sheet can dismiss. */
  onNavigate?: () => void;
}

export default function Sidebar({ markets, selected, onSelect, onNavigate }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMarkets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter((market) => market.name.toLowerCase().includes(q));
  }, [markets, searchTerm]);

  return (
    <>
      <div className="space-y-3 px-3 pb-2 pt-4">
        <div className="flex items-baseline justify-between px-1.5">
          <h2 className="text-[13px] font-semibold text-ink">Markets</h2>
          <span className="num text-xs text-ink-2">{markets.length}</span>
        </div>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search markets" />
      </div>

      <nav aria-label="Markets" className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 pt-1">
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onNavigate?.();
          }}
          aria-current={selected === null ? 'page' : undefined}
          className={`press flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left text-[13.5px] transition-colors duration-150 ${
            selected === null ? 'bg-accent text-white' : 'text-ink hover:bg-black/[0.045]'
          }`}
        >
          <svg className="h-[18px] w-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="8.25" strokeWidth={1.6} />
            <path d="M3.75 12h16.5M12 3.75c2.2 2.3 3.3 5.05 3.3 8.25s-1.1 5.95-3.3 8.25c-2.2-2.3-3.3-5.05-3.3-8.25S9.8 6.05 12 3.75z" strokeWidth={1.6} />
          </svg>
          <span className="font-medium">All markets</span>
        </button>

        <div className="mx-2.5 my-2 h-px bg-black/[0.06]" />

        {filteredMarkets.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-ink-2">
            No markets match “{searchTerm.trim()}”
          </p>
        ) : (
          filteredMarkets.map((market) => (
            <CountryListItem
              key={market.name}
              name={market.name}
              iso2={market.iso2}
              active={selected === market.name}
              onClick={() => {
                onSelect(market.name);
                onNavigate?.();
              }}
            />
          ))
        )}
      </nav>
    </>
  );
}
