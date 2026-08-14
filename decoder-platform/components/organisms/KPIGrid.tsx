import MetricCard from '@/components/molecules/MetricCard';
import { MarketVm } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';
import { fmt } from '@/lib/dashboard/format';

interface KPIGridProps {
  market: MarketVm;
  metrics: MetricDef[];
}

// Single neutral icon (bar-chart glyph) reused across every card — metrics
// are config-driven, so no per-metric semantic icon is available.
const ICON_PATH =
  'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z';

const icon = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ICON_PATH} />
  </svg>
);

export default function KPIGrid({ market, metrics }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.key}
          label={metric.label}
          value={fmt(market.values[metric.key] ?? null)}
          icon={icon}
          metric={metric}
        />
      ))}

      <MetricCard label="Weighted Score" value={market.score.toFixed(2)} icon={icon} />

      <MetricCard
        label="% Split"
        value={`${(market.split * 100).toFixed(1)}%`}
        icon={icon}
      />
    </div>
  );
}
