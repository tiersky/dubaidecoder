"use client";

import Flag from "@/components/atoms/Flag";

interface CountryListItemProps {
  name: string;
  iso2: string | null;
  active: boolean;
  onClick: () => void;
}

export default function CountryListItem({ name, iso2, active, onClick }: CountryListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`press flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-left transition-colors duration-150 ${
        active ? "bg-accent text-white" : "text-ink hover:bg-black/[0.045]"
      }`}
    >
      <Flag iso2={iso2} name={name} size="sm" />
      <span className="flex-1 truncate text-[13.5px] font-medium">{name}</span>
    </button>
  );
}
