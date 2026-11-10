"use client";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function SelectDropdown({ label, options, value, onChange }: SelectDropdownProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass-input w-full appearance-none truncate rounded-[var(--radius-control)] py-2 pl-3 pr-9 text-[13px] font-medium text-ink"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-2"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 6.5L8 3l3.5 3.5M4.5 9.5L8 13l3.5-3.5" />
        </svg>
      </span>
    </label>
  );
}
