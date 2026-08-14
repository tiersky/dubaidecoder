"use client";

interface CountryListItemProps {
  name: string;
  iso2: string | null;
  active: boolean;
  onClick: () => void;
}

export default function CountryListItem({
  name,
  iso2,
  active,
  onClick,
}: CountryListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 ${
        active
          ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
          : "hover:bg-white/60 text-slate-700"
      }`}
    >
      {iso2 !== null ? (
        <img
          src={`https://flagcdn.com/w40/${iso2}.png`}
          alt={name}
          className="w-7 h-5 object-cover rounded-sm shadow-sm flex-shrink-0"
        />
      ) : (
        <span className="w-7 h-5 flex items-center justify-center rounded-sm shadow-sm flex-shrink-0 bg-slate-200 text-slate-500 text-[9px] font-semibold uppercase">
          {name.slice(0, 2)}
        </span>
      )}
      <span className="font-medium text-sm flex-1 truncate">{name}</span>
    </button>
  );
}
