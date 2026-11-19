'use client';

import GlassCard from '@/components/atoms/GlassCard';
import Flag from '@/components/atoms/Flag';
import type { RecommendationSet } from '@/lib/config/types';
import type { MarketVm } from '@/lib/dashboard/derive';

interface SuggestedMarketsProps {
  set: RecommendationSet;
  markets: MarketVm[];
  onSelect: (m: MarketVm) => void;
}

/** The AI market suggestions made when the decoder was built: what was added, and what else was weighed. */
export default function SuggestedMarkets({ set, markets, onSelect }: SuggestedMarketsProps) {
  const byIso = new Map(markets.filter((m) => m.iso2).map((m) => [m.iso2!.toLowerCase(), m]));
  const added = set.items.filter((i) => i.status === 'included' && byIso.has(i.iso2));
  const considered = set.items.filter((i) => i.status === 'suggested');
  if (!added.length && !considered.length) return null;
  const ai = set.model !== 'lookalike';

  return (
    <GlassCard padding="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{ai ? 'Suggested by AI' : 'Suggested lookalike markets'}</h2>
        <span className="text-xs text-ink-2">
          {new Date(set.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <p className="mt-2 max-w-[80ch] text-[13px] leading-relaxed text-ink-2">{set.summary}</p>

      {added.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {added.map((item) => {
            const m = byIso.get(item.iso2)!;
            return (
              <li key={item.iso2}>
                <button
                  type="button"
                  onClick={() => onSelect(m)}
                  className="glass-card-hover press h-full w-full rounded-[14px] bg-white/60 p-4 text-left shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex items-center gap-2.5">
                    <Flag iso2={item.iso2} name={item.name} size="md" />
                    <span className="flex-1 text-[14px] font-semibold text-ink">{m.name}</span>
                    {ai && <span className="num text-[12px] text-ink-2">{item.fit} fit</span>}
                  </div>
                  <p className="mt-2 text-[13px] text-ink-2">{item.headline}</p>
                  <ul className="mt-2 space-y-1 text-[12.5px] leading-snug text-ink">
                    {item.reasons.slice(0, 2).map((r, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-emerald-600">+</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {considered.length > 0 && (
        <p className="mt-4 text-[12.5px] text-ink-2">
          <span className="font-medium text-ink">Also considered: </span>
          {considered.map((i) => i.name).join(', ')}.
        </p>
      )}
    </GlassCard>
  );
}
