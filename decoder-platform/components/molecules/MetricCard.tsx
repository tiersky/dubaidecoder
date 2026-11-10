import MetricInfo from "@/components/atoms/MetricInfo";
import ShareBar from "@/components/atoms/ShareBar";

interface MetricCardProps {
  value: string | number;
  label: string;
  index?: number;
  metric?: { label: string; source?: string; description?: string };
  peer?: { fraction: number; caption: string } | null;
}

export default function MetricCard({ value, label, index = 0, metric, peer }: MetricCardProps) {
  return (
    <div
      className="glass-card materialize flex min-h-[132px] flex-col p-5"
      style={{ ["--i" as string]: Math.min(index, 10) + 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug text-ink-2">{label}</p>
        {metric && <MetricInfo metric={metric} label={label} />}
      </div>
      <p className="num display mt-2 text-[26px] font-semibold text-ink">{value}</p>
      {peer && (
        <div className="mt-auto pt-3">
          <ShareBar value={peer.fraction} tone={0.5} />
          <p className="mt-1.5 text-[11.5px] text-ink-2">{peer.caption}</p>
        </div>
      )}
    </div>
  );
}
