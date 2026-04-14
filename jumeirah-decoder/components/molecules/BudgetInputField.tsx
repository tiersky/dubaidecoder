"use client";

interface BudgetInputFieldProps {
  value: number;
  onChange: (value: number) => void;
}

export default function BudgetInputField({
  value,
  onChange,
}: BudgetInputFieldProps) {
  return (
    <div className="glass-card p-5 border-2 border-amber-200/50">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        Total Marketing Budget (AED)
      </label>
      <input
        type="number"
        value={value}
        min={100000}
        step={100000}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="glass-input w-full px-4 py-3 rounded-xl text-lg font-bold text-slate-800"
        placeholder="Enter total budget in AED"
      />
      <p className="text-xs text-slate-400 mt-2">
        Budget auto-allocates to countries based on % Split from analysis
      </p>
    </div>
  );
}
