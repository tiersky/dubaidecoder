"use client";

import { useState } from "react";

interface BudgetInputFieldProps {
  value: number;
  onChange: (value: number) => void;
  currency: string;
}

/** Formatted while idle (1,250,000), raw digits while editing. */
export default function BudgetInputField({ value, onChange, currency }: BudgetInputFieldProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  return (
    <div>
      <label htmlFor="total-budget" className="block text-xs font-medium text-ink-2">
        Total marketing budget
      </label>
      <div className="well mt-2 flex items-baseline gap-2 px-4 py-3 transition-shadow duration-200 focus-within:shadow-[0_0_0_4px_rgba(0,113,227,0.16),inset_0_0_0_1px_rgba(0,113,227,0.5)]">
        <span className="text-[15px] font-semibold text-ink-2">{currency}</span>
        <input
          id="total-budget"
          inputMode="numeric"
          autoComplete="off"
          value={focused ? draft : value.toLocaleString()}
          onFocus={() => {
            setFocused(true);
            setDraft(String(value));
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            setDraft(digits);
            onChange(parseInt(digits, 10) || 0);
          }}
          className="num display w-full min-w-0 bg-transparent text-[28px] font-semibold text-ink outline-none"
          placeholder="0"
        />
      </div>
      <p className="mt-2 text-xs text-ink-2">Budget auto-allocates to countries based on % Split from analysis</p>
    </div>
  );
}
