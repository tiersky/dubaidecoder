"use client";

import { useMemo } from "react";
import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import GlassCard from "@/components/atoms/GlassCard";
import WorldMap from "@/components/organisms/WorldMap";
import AllocationList from "@/components/organisms/AllocationList";
import { formatMoney } from "@/lib/ui/theme";

interface GlobalOverviewProps {
  markets: MarketVm[];
  currency: string;
  allocations: AllocationRow[];
  onSelectCountry: (market: MarketVm) => void;
}

export default function GlobalOverview({
  markets,
  currency,
  allocations,
  onSelectCountry,
}: GlobalOverviewProps) {
  const total = useMemo(() => allocations.reduce((sum, a) => sum + (a.budget || 0), 0), [allocations]);
  const funded = allocations.filter((a) => a.budget > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
        <div>
          <h1 className="display text-[28px] font-semibold text-ink sm:text-[32px]">Global Market Overview</h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            Select a country from the map or sidebar to view detailed insights
          </p>
        </div>
        <dl className="flex gap-6 sm:text-right">
          <div>
            <dt className="text-xs text-ink-2">Target markets</dt>
            <dd className="num display mt-0.5 text-[22px] font-semibold text-ink">{markets.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Total budget</dt>
            <dd className="num display mt-0.5 text-[22px] font-semibold text-ink">{formatMoney(currency, total)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <GlassCard padding="p-3 sm:p-4">
          <WorldMap
            markets={markets}
            currency={currency}
            allocations={allocations}
            onSelectCountry={onSelectCountry}
          />
        </GlassCard>

        {/* On xl the list takes the map card's height and scrolls inside it */}
        <div className="relative">
        <GlassCard padding="p-0" className="flex max-h-[560px] flex-col overflow-hidden xl:absolute xl:inset-0 xl:max-h-none">
          <div className="flex items-baseline justify-between px-5 pb-2 pt-5">
            <h2 className="text-[15px] font-semibold text-ink">Budget split</h2>
            <span className="text-xs text-ink-2">
              {funded} of {markets.length} funded
            </span>
          </div>
          <AllocationList
            markets={markets}
            allocations={allocations}
            currency={currency}
            onSelect={onSelectCountry}
          />
        </GlassCard>
        </div>
      </div>
    </div>
  );
}
