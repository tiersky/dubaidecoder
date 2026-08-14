import MetricCard from '@/components/molecules/MetricCard';
import { Country, INDEX_HIGHER_BETTER } from '@/types';
import { formatPopulation } from '@/lib/utils';

interface KPIGridProps {
  country: Country;
}

function DirectionIcon({ higherBetter }: { higherBetter: boolean }) {
  return higherBetter ? (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  );
}

export default function KPIGrid({ country }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <MetricCard
        label="Millionaire Population"
        value={country.millionairePopulation != null ? formatPopulation(country.millionairePopulation) : 'N/A'}
        sublabel={INDEX_HIGHER_BETTER.millionairePopulation ? 'Higher = larger target' : 'Lower = UAE more attractive'}
        icon={<DirectionIcon higherBetter={INDEX_HIGHER_BETTER.millionairePopulation} />}
      />

      <MetricCard
        label="Price-to-Income Ratio"
        value={country.priceToIncome.toFixed(1)}
        sublabel="Lower = UAE more attractive"
        icon={<DirectionIcon higherBetter={false} />}
      />

      <MetricCard
        label="Gross Rental Yield"
        value={`${country.grossRentalYield.toFixed(1)}%`}
        sublabel="Higher = UAE competes better"
        icon={<DirectionIcon higherBetter={true} />}
      />

      <MetricCard
        label="Mortgage % of Income"
        value={`${country.mortgagePercentIncome.toFixed(1)}%`}
        sublabel="Lower = UAE more attractive"
        icon={<DirectionIcon higherBetter={false} />}
      />

      <MetricCard
        label="Affordability Index"
        value={country.affordabilityIndex.toFixed(1)}
        sublabel="Lower borrowing cost = higher incentive"
        icon={<DirectionIcon higherBetter={false} />}
      />

      <MetricCard
        label="Economic Growth Rate"
        value={`${country.economicGrowthRate.toFixed(1)}%`}
        sublabel="Lower = more outbound appetite"
        icon={<DirectionIcon higherBetter={false} />}
      />

      <MetricCard
        label="% Millionaires"
        value={country.percentMillionaires != null ? `${country.percentMillionaires.toFixed(1)}%` : 'N/A'}
        sublabel="HNWI concentration"
        icon={
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
