import GlassCard from "@/components/atoms/GlassCard";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: string;
}

export default function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
  height = "h-[300px]",
}: ChartCardProps) {
  return (
    <GlassCard className={`flex flex-col ${className}`} padding="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-2">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className={`relative ${height}`}>{children}</div>
    </GlassCard>
  );
}
