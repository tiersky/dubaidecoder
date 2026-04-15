"use client";

import { Country } from "@/types";
import CountryHeader from "@/components/organisms/CountryHeader";
import KPIGrid from "@/components/organisms/KPIGrid";
import MobilitySection from "@/components/organisms/MobilitySection";
import ConfidenceScoreChart from "@/components/organisms/ConfidenceScoreChart";

interface CountryDetailProps {
  country: Country;
  onBack: () => void;
}

export default function CountryDetail({
  country,
  onBack,
}: CountryDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <CountryHeader country={country} onBack={onBack} />
      </div>

      {/* KPI Cards */}
      <div className="opacity-0 animate-fade-in-up animate-delay-1">
        <KPIGrid country={country} />
      </div>

      {/* Mobility */}
      <div className="opacity-0 animate-fade-in-up animate-delay-2">
        <MobilitySection country={country} />
      </div>

      {/* Confidence Score */}
      <div className="opacity-0 animate-fade-in-up animate-delay-2">
        <ConfidenceScoreChart
          countryCode={country.code}
          countryName={country.name}
        />
      </div>
    </div>
  );
}
