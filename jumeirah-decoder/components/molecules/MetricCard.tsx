import GlassCard from "@/components/atoms/GlassCard";
import MetricValue from "@/components/atoms/MetricValue";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
  tooltip?: string;
}

export default function MetricCard({
  value,
  label,
  sublabel,
  color,
  icon,
  tooltip,
}: MetricCardProps) {
  return (
    <div className="relative z-0 hover:z-50">
      <GlassCard hover>
        <div className="flex items-start justify-between">
          <MetricValue value={value} label={label} sublabel={sublabel} color={color} />
          <div className="flex items-start gap-2">
            {tooltip && (
              <div className="relative group">
                <button
                  type="button"
                  aria-label="Info"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                >
                  ?
                </button>
                <div className="pointer-events-none absolute right-0 top-6 z-[100] w-60 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  {tooltip}
                </div>
              </div>
            )}
            {icon && (
              <div className="p-2 rounded-xl bg-slate-50/80 text-slate-400">
                {icon}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
