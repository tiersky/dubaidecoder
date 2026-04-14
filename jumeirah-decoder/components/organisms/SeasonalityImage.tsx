'use client';

import { useState } from 'react';
import Image from 'next/image';
import GlassCard from '@/components/atoms/GlassCard';

interface SeasonalityImageProps {
  countryName: string;
}

export default function SeasonalityImage({ countryName }: SeasonalityImageProps) {
  const [hasError, setHasError] = useState(false);

  const filename = `${countryName.replace(/ /g, '_')}_dubai_seasonality.png`;

  if (hasError) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          Seasonality data not available for {countryName}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard padding="p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">
        Seasonality Analysis
      </h3>
      <div className="relative w-full">
        <Image
          src={`/seasonality/${filename}`}
          alt={`${countryName} Dubai travel seasonality analysis`}
          width={1200}
          height={600}
          className="w-full h-auto rounded-lg"
          onError={() => setHasError(true)}
        />
      </div>
    </GlassCard>
  );
}
