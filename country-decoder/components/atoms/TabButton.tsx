"use client";

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
          : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
      }`}
    >
      {label}
    </button>
  );
}
