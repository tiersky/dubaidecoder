import GlassCard from "@/components/atoms/GlassCard";
import MetricValue from "@/components/atoms/MetricValue";
import MetricInfo from "@/components/atoms/MetricInfo";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
  metricKey?: string;
}

export default function MetricCard({
  value,
  label,
  sublabel,
  color,
  icon,
  metricKey,
}: MetricCardProps) {
  return (
    <GlassCard hover>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <MetricValue value={value} label={label} sublabel={sublabel} color={color} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {metricKey && <MetricInfo metricKey={metricKey} label={label} />}
          {icon && (
            <div className="p-2 rounded-xl bg-slate-50/80 text-slate-400">
              {icon}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
