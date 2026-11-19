'use client';

import { useMemo, useState } from 'react';
import Flag from '@/components/atoms/Flag';
import SearchInput from '@/components/atoms/SearchInput';
import type { Universe } from './shared';

/** Search-and-add over every country in the universe. */
export default function CountryPicker({
  universe,
  selected,
  onPick,
  placeholder = 'Search countries',
}: {
  universe: Universe;
  selected: Set<string>;
  onPick: (iso2: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return [...universe.values()]
      .filter((c) => !selected.has(c.iso2) && (c.name.toLowerCase().includes(needle) || c.iso2 === needle))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(needle)) - Number(!b.name.toLowerCase().startsWith(needle)) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [q, universe, selected]);

  return (
    <div className="relative">
      <SearchInput value={q} onChange={setQ} placeholder={placeholder} />
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-[12px] bg-white/95 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1),0_12px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          {matches.map((c) => (
            <li key={c.iso2}>
              <button
                type="button"
                onClick={() => {
                  onPick(c.iso2);
                  setQ('');
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink hover:bg-black/[0.04]"
              >
                <Flag iso2={c.iso2} name={c.name} />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
