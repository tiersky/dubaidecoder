"use client";

import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import GlassCard from "@/components/atoms/GlassCard";
import WorldMap from "@/components/organisms/WorldMap";

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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Global Market Overview
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Select a country from the map or sidebar to view detailed insights
        </p>
      </div>

      {/* World Map */}
      <GlassCard padding="p-4 sm:p-6">
        <WorldMap
          markets={markets}
          currency={currency}
          allocations={allocations}
          onSelectCountry={onSelectCountry}
        />
      </GlassCard>

      {/* Quick Stats */}
      <div className="flex justify-center">
        <GlassCard hover>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 tracking-tight">
              {markets.length}
            </p>
            <p className="text-sm font-medium text-slate-600 mt-1">
              Target Markets
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Global coverage analysis
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
