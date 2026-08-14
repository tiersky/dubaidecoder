import { MarketVm } from '@/lib/dashboard/derive';

interface CountryHeaderProps {
  market: MarketVm;
  onBack: () => void;
}

export default function CountryHeader({ market, onBack }: CountryHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="p-2 rounded-xl hover:bg-white/60 transition-colors duration-200 text-slate-500 hover:text-slate-700"
        aria-label="Go back"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
      </button>

      {/* Flag */}
      {market.iso2 !== null ? (
        <img
          src={`https://flagcdn.com/w80/${market.iso2}.png`}
          alt={`${market.name} flag`}
          className="w-14 h-10 object-cover rounded-lg shadow-sm border border-white/40"
        />
      ) : (
        <span className="w-14 h-10 flex items-center justify-center rounded-lg shadow-sm border border-white/40 bg-slate-200 text-slate-500 text-xs font-semibold uppercase">
          {market.name.slice(0, 2)}
        </span>
      )}

      {/* Country name */}
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
        {market.name}
      </h1>
    </div>
  );
}
