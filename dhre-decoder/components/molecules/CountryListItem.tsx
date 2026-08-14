'use client';

import { Tier, TIER_CONFIG } from '@/types';

interface CountryListItemProps {
  name: string;
  code: string;
  tier: Tier;
  active: boolean;
  onClick: () => void;
}

export default function CountryListItem({
  name,
  code,
  tier,
  active,
  onClick,
}: CountryListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 ${
        active
          ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
          : 'hover:bg-white/60 text-slate-700'
      }`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: TIER_CONFIG[tier].color }}
      />
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        alt={name}
        className="w-7 h-5 object-cover rounded-sm shadow-sm flex-shrink-0"
      />
      <span className="font-medium text-sm flex-1 truncate">{name}</span>
    </button>
  );
}
