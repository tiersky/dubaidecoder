import GlassCard from "@/components/atoms/GlassCard";
import MetricValue from "@/components/atoms/MetricValue";

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  color?: string;
  icon?: React.ReactNode;
}

export default function MetricCard({
  value,
  label,
  sublabel,
  color,
  icon,
}: MetricCardProps) {
  return (
    <GlassCard hover>
      <div className="flex items-start justify-between">
        <MetricValue value={value} label={label} sublabel={sublabel} color={color} />
        {icon && (
          <div className="p-2 rounded-xl bg-slate-50/80 text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
