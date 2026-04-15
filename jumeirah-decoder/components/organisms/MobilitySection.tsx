import GlassCard from "@/components/atoms/GlassCard";
import { Country } from "@/types";
import { distanceToDubaiKm } from "@/lib/utils";

interface MobilitySectionProps {
  country: Country;
}

const MAX_DISTANCE_KM = 15000;

const formatCompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

interface InfoTooltipProps {
  text: string;
}

function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label="Info"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
      >
        ?
      </button>
      <div className="pointer-events-none absolute right-0 top-6 z-[100] w-60 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </div>
    </div>
  );
}

export default function MobilitySection({ country }: MobilitySectionProps) {
  const distanceKm = distanceToDubaiKm(country.lat, country.lng);
  const proximityRatio = Math.max(0, Math.min(1, 1 - distanceKm / MAX_DISTANCE_KM));
  const avgSeatsPerFlight =
    country.dailyFlightsToDxb > 0
      ? Math.round(country.dailySeatsToDxb / country.dailyFlightsToDxb)
      : 0;
  const isDomestic = country.code === "ae";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Mobility
        </h2>
        <span className="text-[11px] text-slate-400">Connectivity to Dubai</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Flights */}
        <GlassCard hover className="relative z-0 hover:z-50">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Daily Flights to DXB
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                {isDomestic ? "—" : country.dailyFlightsToDxb}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isDomestic
                  ? "Domestic market"
                  : country.dailyFlightsToDxb === 0
                  ? "No direct service"
                  : "Emirates + flydubai, daily avg"}
              </p>
            </div>
            <InfoTooltip text="Average daily direct flights to Dubai International (DXB) operated by Emirates and flydubai combined, as of latest schedule snapshot." />
          </div>
        </GlassCard>

        {/* Daily Seats */}
        <GlassCard hover className="relative z-0 hover:z-50">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Daily Seats to DXB
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                {isDomestic ? "—" : formatCompact(country.dailySeatsToDxb)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isDomestic
                  ? "Domestic market"
                  : avgSeatsPerFlight > 0
                  ? `${avgSeatsPerFlight} avg per flight`
                  : "No direct service"}
              </p>
            </div>
            <InfoTooltip text="Total daily seat capacity into DXB across all Emirates + flydubai flights from this country. Indicates scale of available inbound supply." />
          </div>
        </GlassCard>

        {/* Proximity to Dubai */}
        <GlassCard hover className="relative z-0 hover:z-50">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                Proximity to Dubai
              </p>
              <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
                {Math.round(distanceKm).toLocaleString()}{" "}
                <span className="text-sm font-medium text-slate-400">km</span>
              </p>
            </div>
            <InfoTooltip text="Great-circle distance from this country's geographic centroid to Dubai (25.20°N, 55.27°E). Closer markets = shorter flights, lower fares, more weekend trips." />
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-300 transition-all duration-500"
                style={{ width: `${proximityRatio * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400">
              <span>Far</span>
              <span>Close</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
