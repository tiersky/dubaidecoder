"use client";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search" }: SearchInputProps) {
  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-[10px] bg-black/[0.05] py-[7px] pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-2 outline-none transition-[background-color,box-shadow] duration-200 focus:bg-white/90 focus:shadow-[0_0_0_3px_rgba(0,113,227,0.18)] [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
