import MetricCard from '@/components/molecules/MetricCard';
import { Country } from '@/types';
import { formatPopulation } from '@/lib/utils';

interface KPIGridProps {
  country: Country;
}

export default function KPIGrid({ country }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <MetricCard
        label="Population"
        value={formatPopulation(country.population)}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        }
      />

      <MetricCard
        label="International Travellers"
        value={formatPopulation(country.internationalTravellers)}
        sublabel={
          country.population > 0
            ? `${((country.internationalTravellers / country.population) * 100).toFixed(1)}% of population`
            : undefined
        }
        tooltip="International tourist departures — number of trips by country's residents who travel abroad and stay overnight. Percentage shown is relative to the country's population."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 9h16.5m-16.5 6.75h16.5M12 3v18m-9-9a9 9 0 1018 0 9 9 0 00-18 0z"
            />
          </svg>
        }
      />

      <MetricCard
        label="Tourism Expenditure"
        value={
          country.tourismExpenditureUsd >= 1_000_000_000
            ? `$${(country.tourismExpenditureUsd / 1_000_000_000).toFixed(1)}B`
            : country.tourismExpenditureUsd >= 1_000_000
            ? `$${(country.tourismExpenditureUsd / 1_000_000).toFixed(1)}M`
            : `$${country.tourismExpenditureUsd.toLocaleString()}`
        }
        tooltip="Total annual spending (USD) by this country's outbound travellers on international trips."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
            />
          </svg>
        }
      />

      <MetricCard
        label="Avg. Spend per Trip"
        value={`$${country.avgSpendPerTripUsd.toLocaleString()}`}
        tooltip="Average USD spent per international trip by travellers from this country."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      />

      <MetricCard
        label="Google Travel Intent"
        value={country.googleTravelIntent.toLocaleString()}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        }
      />

      <MetricCard
        label="GDP (PPP) per Capita"
        value={`$${country.gdpPppPerCapitaUsd.toLocaleString()}`}
        tooltip="Gross Domestic Product per person at Purchasing Power Parity (USD) — reflects real purchasing power and standard of living."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 3v18h18M7 14l4-4 4 4 5-5"
            />
          </svg>
        }
      />

      <MetricCard
        label="GDP Growth"
        value={`${(country.gdpGrowth * 100).toFixed(2)}%`}
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
            />
          </svg>
        }
      />

      <MetricCard
        label="Confidence Score"
        value={
          country.confidenceScore !== null
            ? country.confidenceScore.toFixed(2)
            : 'N/A'
        }
        sublabel={
          country.confidenceScore !== null ? 'Latest week' : 'Not tracked yet'
        }
        tooltip="Per-country weekly confidence score — latest available week. Tracked for 9 markets today; remaining markets show N/A until data lands."
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
      />
    </div>
  );
}
