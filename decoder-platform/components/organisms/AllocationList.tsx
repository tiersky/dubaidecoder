"use client";

import { useMemo } from "react";
import { MarketVm, AllocationRow } from "@/lib/dashboard/derive";
import Flag from "@/components/atoms/Flag";
import ShareBar from "@/components/atoms/ShareBar";
import { formatMoneyCompact, relativeShare, toneScale } from "@/lib/ui/theme";

interface AllocationListProps {
  markets: MarketVm[];
  allocations: AllocationRow[];
  currency: string;
  onSelect: (market: MarketVm) => void;
}

/** Markets ranked by budget, with share bars on the same ramp as the map. */
export default function AllocationList({ markets, allocations, currency, onSelect }: AllocationListProps) {
  const rows = useMemo(() => {
    const byName = new Map(markets.map((m) => [m.name, m]));
    return [...allocations]
      .filter((a) => byName.has(a.name))
      .sort((a, b) => b.budget - a.budget)
      .map((a) => ({ alloc: a, market: byName.get(a.name)! }));
  }, [markets, allocations]);

  const maxSplit = Math.max(0, ...rows.map((r) => r.alloc.split));
  const tone = toneScale(rows.filter((r) => r.alloc.budget > 0).map((r) => r.alloc.split));

  if (rows.length === 0) {
    return <p className="px-5 pb-6 pt-2 text-[13px] text-ink-2">No markets in this version yet.</p>;
  }

  return (
    <ol className="flex-1 overflow-y-auto px-2 pb-3">
      {rows.map(({ alloc, market }, i) => {
        const t = relativeShare(alloc.split, maxSplit);
        const funded = alloc.budget > 0;
        return (
          <li key={alloc.name} className="materialize" style={{ ["--i" as string]: Math.min(i, 12) + 2 }}>
            <button
              type="button"
              onClick={() => onSelect(market)}
              className="press group flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-black/[0.035]"
            >
              <span className="num w-4 text-right text-xs text-ink-2">{i + 1}</span>
              <Flag iso2={alloc.iso2} name={alloc.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-[13.5px] font-medium ${funded ? "text-ink" : "text-ink-2"}`}>
                    {alloc.name}
                  </span>
                  <span className="num flex-shrink-0 text-[13.5px] font-semibold text-ink">
                    {funded ? `${(alloc.split * 100).toFixed(1)}%` : "—"}
                  </span>
                </span>
                <span className="mt-1.5 flex items-center gap-2.5">
                  <ShareBar value={t} tone={funded ? tone(alloc.split) : 0} className="flex-1" />
                  <span className="num w-[76px] flex-shrink-0 text-right text-[11.5px] text-ink-2">
                    {funded ? formatMoneyCompact(currency, alloc.budget) : "Not funded"}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
