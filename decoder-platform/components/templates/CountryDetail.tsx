"use client";

import { useState } from "react";
import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import { MetricDef } from "@/lib/model/score";
import CountryHeader from "@/components/organisms/CountryHeader";
import IndicatorStrip from "@/components/organisms/IndicatorStrip";
import MarketInsightCard from "@/components/organisms/MarketInsightCard";
import MarketContext from "@/components/organisms/MarketContext";
import CultureProfileCard from "@/components/organisms/CultureProfileCard";
import SummerTrafficCard from "@/components/organisms/SummerTrafficCard";
import { useCountryData } from "@/lib/insights/use-country-data";
import { cultureMarkets } from "@/lib/dashboard/culture-markets";

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
      {market.summer && <SummerTrafficCard name={market.name} summer={market.summer} />}
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
          countryLabel={market.place?.country}
        />
      )}
      <CultureProfileCard
        market={market.place ? { ...market, name: market.place.country } : market}
        markets={cultureMarkets(markets)}
        onOpenExplorer={onOpenCulture}
        countryLabel={market.place?.country}
      />
    </div>
  );
}
