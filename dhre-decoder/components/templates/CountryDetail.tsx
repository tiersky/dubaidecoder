'use client';

import { Country } from '@/types';
import CountryHeader from '@/components/organisms/CountryHeader';
import KPIGrid from '@/components/organisms/KPIGrid';
import RadarChart from '@/components/organisms/RadarChart';
import InsightCard from '@/components/molecules/InsightCard';

interface CountryDetailProps {
  country: Country;
  onBack: () => void;
}

export default function CountryDetail({ country, onBack }: CountryDetailProps) {
  return (
    <div className="space-y-6">
      <div className="opacity-0 animate-fade-in-up">
        <CountryHeader country={country} onBack={onBack} />
      </div>

      <div className="opacity-0 animate-fade-in-up animate-delay-1">
        <KPIGrid country={country} />
      </div>

      <div className="opacity-0 animate-fade-in-up animate-delay-2">
        <RadarChart country={country} />
      </div>

      <div className="opacity-0 animate-fade-in-up animate-delay-3">
        <InsightCard recommendation={country.recommendation} />
      </div>
    </div>
  );
}
