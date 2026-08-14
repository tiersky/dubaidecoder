import GlassCard from '@/components/atoms/GlassCard';

interface InsightCardProps {
  recommendation: string;
}

export default function InsightCard({ recommendation }: InsightCardProps) {
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-50/80 text-amber-500 flex-shrink-0">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">
            Strategic Insight
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {recommendation}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
