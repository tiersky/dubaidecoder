"use client";

import { useState } from "react";
import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import { MetricDef } from "@/lib/model/score";
import CountryHeader from "@/components/organisms/CountryHeader";
import IndicatorStrip from "@/components/organisms/IndicatorStrip";
import MarketInsightCard from "@/components/organisms/MarketInsightCard";
import MarketContext from "@/components/organisms/MarketContext";
import CultureProfileCard from "@/components/organisms/CultureProfileCard";
import { useCountryData } from "@/lib/insights/use-country-data";

interface CountryDetailProps {
  market: MarketVm;
  markets: MarketVm[];
  metrics: MetricDef[];
  allocations: AllocationRow[];
  currency: string;
  slug: string;
  industry: string | null;
  ai?: { canRegenerate: boolean };
  /** Public context data; off for unpublished draft previews. */
  context?: boolean;
  onBack: () => void;
  onSelectMarket: (name: string) => void;
  onOpenCulture: () => void;
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
  context = true,
  onBack,
  onSelectMarket,
  onOpenCulture,
}: CountryDetailProps) {
  const data = useCountryData(context ? slug : "");
  const [compareName, setCompareName] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <CountryHeader market={market} allocations={allocations} currency={currency} onBack={onBack} />
      <IndicatorStrip market={market} markets={markets} metrics={metrics} />
      {ai && (
        <MarketInsightCard
          key={market.name}
          slug={slug}
          market={market.name}
          industry={industry}
          canRegenerate={ai.canRegenerate}
        />
      )}
      {context && (
        <MarketContext
          market={market}
          markets={markets}
          state={data}
          compareName={compareName}
          onCompare={setCompareName}
          onSelectMarket={onSelectMarket}
        />
      )}
      <CultureProfileCard market={market} markets={markets} onOpenExplorer={onOpenCulture} />
    </div>
  );
}
