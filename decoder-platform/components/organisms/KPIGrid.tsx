import MetricCard from '@/components/molecules/MetricCard';
import { MarketVm } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';
import { fmt } from '@/lib/dashboard/format';

interface KPIGridProps {
  market: MarketVm;
  markets: MarketVm[];
  metrics: MetricDef[];
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Position of this market's raw value among all markets that report it. */
function peerPosition(key: string, market: MarketVm, markets: MarketVm[]) {
  const own = market.values[key];
  const values = markets
    .map((m) => m.values[key])
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (own === null || own === undefined || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const rank = values.filter((v) => v > own).length + 1;
  return {
    fraction: max === min ? 1 : (own - min) / (max - min),
    caption: `${ordinal(rank)} highest of ${values.length}`,
  };
}

export default function KPIGrid({ market, markets, metrics }: KPIGridProps) {
  return (
    <section aria-label="Market indicators">
      <h2 className="mb-3 px-1 text-[15px] font-semibold text-ink">Indicators</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((metric, i) => (
          <MetricCard
            key={metric.key}
            index={i}
            label={metric.label}
            value={fmt(market.values[metric.key] ?? null)}
            metric={metric}
            peer={peerPosition(metric.key, market, markets)}
          />
        ))}
      </div>
    </section>
  );
}
