'use client';

import { INDEX_KEYS, INDEX_LABELS, ModelWeights } from '@/types';
import GlassCard from '@/components/atoms/GlassCard';

interface ModelWeightsPanelProps {
  weights: ModelWeights;
  onChange: (weights: ModelWeights) => void;
  enabled: boolean;
  onToggle: () => void;
}

export default function ModelWeightsPanel({
  weights,
  onChange,
  enabled,
  onToggle,
}: ModelWeightsPanelProps) {
  const handleWeightChange = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Model Weights
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Adjust metric weights to change budget allocation
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
            enabled ? 'bg-blue-500' : 'bg-slate-300'
          }`}
          aria-label="Toggle model weights"
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {INDEX_KEYS.map((key) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-slate-500 font-medium leading-tight block">
                {INDEX_LABELS[key]}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={weights[key]}
                onChange={(e) =>
                  handleWeightChange(key, Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                }
                className="w-full px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-white/60 border border-slate-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent tabular-nums"
              />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
