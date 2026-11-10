import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';
import Flag from '@/components/atoms/Flag';
import { formatMoney } from '@/lib/ui/theme';

interface CountryHeaderProps {
  market: MarketVm;
  allocations: AllocationRow[];
  currency: string;
  onBack: () => void;
}

export default function CountryHeader({ market, allocations, currency, onBack }: CountryHeaderProps) {
  const ranked = [...allocations].filter((a) => a.budget > 0).sort((a, b) => b.budget - a.budget);
  const alloc = allocations.find((a) => a.name === market.name);
  const funded = Boolean(alloc && alloc.budget > 0);
  const rank = funded ? ranked.findIndex((a) => a.name === market.name) + 1 : null;

  const stats = [
    { label: 'Budget share', value: funded ? `${(alloc!.split * 100).toFixed(1)}%` : '—' },
    { label: 'Budget', value: funded ? formatMoney(currency, alloc!.budget) : 'Not funded' },
    { label: 'Weighted score', value: market.score.toFixed(2) },
    { label: 'Rank by budget', value: rank ? `${rank} of ${ranked.length}` : '—' },
  ];

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="press -ml-1 inline-flex items-center gap-1 rounded-full py-1 pl-1.5 pr-3 text-[13.5px] font-medium text-accent hover:bg-accent/[0.08]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 18l-6-6 6-6" />
        </svg>
        All markets
      </button>

      <div className="glass-card flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Flag iso2={market.iso2} name={market.name} size="lg" />
          <div className="min-w-0">
            <h1 className="display truncate text-[30px] font-semibold text-ink sm:text-[34px]">{market.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              {funded ? 'Funded in the recommended split' : 'Not funded in the recommended split'}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:gap-x-10">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="whitespace-nowrap text-xs text-ink-2">{s.label}</dt>
              <dd className="num display mt-1 whitespace-nowrap text-[21px] font-semibold text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
