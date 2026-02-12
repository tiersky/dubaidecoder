"use client";

import { Country } from "@/types";
import CountryHeader from "@/components/organisms/CountryHeader";
import KPIGrid from "@/components/organisms/KPIGrid";
import SeasonalityImage from "@/components/organisms/SeasonalityImage";

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

      {/* Seasonality Image */}
      <div className="opacity-0 animate-fade-in-up animate-delay-2">
        <SeasonalityImage countryName={country.name} />
      </div>
    </div>
  );
}
