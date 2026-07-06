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

export default function SelectDropdown({
  label,
  options,
  value,
  onChange,
}: SelectDropdownProps) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full px-3.5 py-2.5 rounded-xl text-sm text-slate-700 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20width%3d%2212%22%20height%3d%2212%22%20viewBox%3d%220%200%2012%2012%22%3e%3cpath%20fill%3d%22%2394a3b8%22%20d%3d%22M2%204l4%204%204-4%22%2f%3e%3c%2fsvg%3e')] bg-[position:right_12px_center] bg-no-repeat pr-9"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
