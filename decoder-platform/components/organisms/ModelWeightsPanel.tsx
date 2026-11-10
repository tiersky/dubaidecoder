'use client';

import { MetricDef } from '@/lib/model/score';
import GlassCard from '@/components/atoms/GlassCard';
import MetricInfo from '@/components/atoms/MetricInfo';
import Switch from '@/components/atoms/Switch';

interface ModelWeightsPanelProps {
  metrics: MetricDef[];
  weights: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export default function ModelWeightsPanel({
  metrics,
  weights,
  onChange,
  enabled,
  onToggle,
  className = '',
}: ModelWeightsPanelProps) {
  const handleWeightChange = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  return (
    <GlassCard padding="p-5 sm:p-6" className={className}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Model weights</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            {enabled ? 'Turning this off restores the published weights' : 'Adjust metric weights to change budget allocation'}
          </p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label="Customize model weights" />
      </div>

      {/* Height via grid rows: content stays in the DOM, so it can animate both ways */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-[380ms] ease-[var(--ease-out)]"
        style={{ gridTemplateRows: enabled ? '1fr' : '0fr', opacity: enabled ? 1 : 0 }}
        aria-hidden={!enabled}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 gap-3 pt-5 sm:grid-cols-3">
            {metrics.map((metric) => (
              <label key={metric.key} className="flex flex-col">
                <span className="mb-1.5 flex min-h-[2.1rem] items-start gap-1 text-xs font-medium leading-tight text-ink-2">
                  <span>{metric.label}</span> <MetricInfo metric={metric} />
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  tabIndex={enabled ? 0 : -1}
                  aria-label={`${metric.label} weight`}
                  value={weights[metric.key]}
                  onChange={(e) =>
                    handleWeightChange(metric.key, Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                  }
                  className="glass-input num mt-auto w-full rounded-[10px] px-3 py-2 text-[14px] font-semibold text-ink"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
