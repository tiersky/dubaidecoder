'use client';

import GlassCard from '@/components/atoms/GlassCard';
import MetricInfo from '@/components/atoms/MetricInfo';
import { EXPLAIN, modelSummary } from '@/lib/model/explain';
import { formatMoney } from '@/lib/ui/theme';
import type { AllocationModel } from '@/lib/config/types';
import type { Uncertainty } from '@/lib/model/uncertainty';

interface ModelExplainerProps {
  model: AllocationModel;
  currency: string;
  totalBudget: number;
  ranges?: Uncertainty['ranges'];
  next: Array<{ name: string; extra: number }>;
  step: number;
  warnings: string[];
}

/** What the model does, how firm its numbers are, and where more money would go. */
export default function ModelExplainer({ model, currency, totalBudget, ranges, next, step, warnings }: ModelExplainerProps) {
  const s = modelSummary(model);
  const stability = ranges ? Object.values(ranges).map((r) => r.rankStability) : [];
  const firm = stability.length ? stability.filter((x) => x >= 0.8).length : 0;
  const spread =
    ranges && totalBudget > 0
      ? Object.values(ranges).reduce((a, r) => a + (r.p90 - r.p10), 0) / 2 / totalBudget
      : null;

  return (
    <GlassCard padding="p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{s.title}</h2>
            <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-semibold text-ink-2">Model</span>
          </div>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-ink-2">{s.body}</p>
          <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">How accurate: </span>
            {s.accuracy}
          </p>
          {ranges && stability.length > 0 && (
            <p className="mt-3 text-[13px] text-ink">
              <span className="num font-semibold">{firm}</span> of <span className="num">{stability.length}</span> markets keep their rank in at least 80% of
              simulated plans
              {spread !== null && (
                <>
                  ; budgets typically move by <span className="num font-semibold">±{(spread * 100).toFixed(1)}%</span> of the total
                </>
              )}
              . <MetricInfo metric={EXPLAIN.range} />
            </p>
          )}
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12.5px] text-amber-800">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="well rounded-[14px] p-4">
          <h3 className="text-[13px] font-semibold text-ink">
            Where the next {formatMoney(currency, step)} goes
          </h3>
          {next.length ? (
            <ul className="mt-3 space-y-2">
              {next.slice(0, 5).map((n) => (
                <li key={n.name} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 truncate text-ink">{n.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (n.extra / step) * 100)}%` }} />
                  </span>
                  <span className="num w-20 text-right text-ink-2">{formatMoney(currency, n.extra)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-ink-3">No market would take more at this budget.</p>
          )}
          <p className="mt-3 text-[11.5px] leading-snug text-ink-3">
            {model === 'optimised'
              ? 'Goes to the markets where the next unit reaches the most valuable people.'
              : 'Split in proportion to the current shares.'}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
