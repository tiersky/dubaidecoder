import GlassCard from "@/components/atoms/GlassCard";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  height?: string;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  height = "h-[300px]",
}: ChartCardProps) {
  return (
    <GlassCard className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className={`relative ${height}`}>{children}</div>
    </GlassCard>
  );
}
