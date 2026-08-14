"use client";

import { MarketVm } from "@/lib/dashboard/derive";
import { MetricDef } from "@/lib/model/score";
import CountryHeader from "@/components/organisms/CountryHeader";
import KPIGrid from "@/components/organisms/KPIGrid";

interface CountryDetailProps {
  market: MarketVm;
  metrics: MetricDef[];
  onBack: () => void;
}

export default function CountryDetail({
  market,
  metrics,
  onBack,
}: CountryDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <CountryHeader market={market} onBack={onBack} />
      </div>

      {/* KPI Cards */}
      <div className="opacity-0 animate-fade-in-up animate-delay-1">
        <KPIGrid market={market} metrics={metrics} />
      </div>
    </div>
  );
}
