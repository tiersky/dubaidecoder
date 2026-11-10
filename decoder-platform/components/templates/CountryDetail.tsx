"use client";

import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import { MetricDef } from "@/lib/model/score";
import CountryHeader from "@/components/organisms/CountryHeader";
import KPIGrid from "@/components/organisms/KPIGrid";
import MarketInsightCard from "@/components/organisms/MarketInsightCard";

interface CountryDetailProps {
  market: MarketVm;
  markets: MarketVm[];
  metrics: MetricDef[];
  allocations: AllocationRow[];
  currency: string;
  slug: string;
  industry: string | null;
  ai?: { canRegenerate: boolean };
  onBack: () => void;
}

export default function CountryDetail({
  market,
  markets,
  metrics,
  allocations,
  currency,
  slug,
  industry,
  ai,
  onBack,
}: CountryDetailProps) {
  return (
    <div className="space-y-6">
      <CountryHeader market={market} allocations={allocations} currency={currency} onBack={onBack} />
      {ai && (
        <MarketInsightCard
          key={market.name}
          slug={slug}
          market={market.name}
          industry={industry}
          canRegenerate={ai.canRegenerate}
        />
      )}
      <KPIGrid market={market} markets={markets} metrics={metrics} />
    </div>
  );
}
