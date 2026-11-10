'use client';

import { Chart as ChartJS, Tooltip, Legend } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
import { Chart } from 'react-chartjs-2';
import { useMemo } from 'react';
import ChartCard from '@/components/molecules/ChartCard';
import { AllocationRow } from '@/lib/dashboard/derive';
import {
  INK,
  RAMP_WHITE_TEXT_FROM,
  TOOLTIP_CHART,
  chartFont,
  formatMoney,
  rampColor,
  toneScale,
} from '@/lib/ui/theme';

ChartJS.register(TreemapController, TreemapElement, Tooltip, Legend);

interface BudgetTreemapProps {
  allocations: AllocationRow[];
  currency: string;
}

interface TreeRow {
  name: string;
  iso2: string | null;
  budget: number;
  split: number;
  color: string;
  tone: number;
}

export default function BudgetTreemap({ allocations, currency }: BudgetTreemapProps) {
  const rows = useMemo<TreeRow[]>(() => {
    const sorted = [...allocations]
      .filter((a) => a.budget > 0)
      .sort((a, b) => b.budget - a.budget);
    const scale = toneScale(sorted.map((a) => a.split));
    return sorted.map((a) => {
      // Same encoding as the map: darker = larger share.
      const tone = 0.1 + 0.9 * scale(a.split);
      return {
        name: a.name,
        iso2: a.iso2,
        budget: a.budget,
        split: a.split,
        tone,
        color: rampColor(tone),
      };
    });
  }, [allocations]);

  const data = useMemo(
    () => ({
      datasets: [
        {
          tree: rows,
          key: 'budget',
          borderWidth: 0,
          borderRadius: 8,
          spacing: 2,
          backgroundColor: (ctx: { raw?: { _data?: TreeRow } }) =>
            ctx.raw?._data?.color ?? '#cbd5e1',
          labels: {
            display: true,
            align: 'left' as const,
            position: 'top' as const,
            color: (ctx: { raw?: { _data?: TreeRow } }) =>
              (ctx.raw?._data?.tone ?? 1) >= RAMP_WHITE_TEXT_FROM ? '#ffffff' : INK,
            font: [
              { family: chartFont(), size: 12.5, weight: 600 as const },
              { family: chartFont(), size: 11.5, weight: 400 as const },
            ],
            padding: 9,
            overflow: 'fit' as const,
            formatter: (ctx: { raw?: { _data?: TreeRow } }) => {
              const d = ctx.raw?._data;
              if (!d) return '';
              const pct = (d.split * 100).toFixed(1);
              return [d.name, `${pct}%`];
            },
          },
        },
      ],
    }),
    [rows]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' as const },
      plugins: {
        legend: { display: false },
        // chartjs-plugin-datalabels is registered globally elsewhere — it
        // tries to render values on every rect and looks like grey noise on
        // top of the treemap's own white labels. Disable explicitly here.
        datalabels: { display: false },
        tooltip: {
          ...TOOLTIP_CHART,
          titleFont: { family: chartFont(), size: 12, weight: 600 as const },
          bodyFont: { family: chartFont(), size: 12 },
          callbacks: {
            title: (items: Array<{ raw?: { _data?: TreeRow } }>) =>
              items[0]?.raw?._data?.name ?? '',
            label: (item: { raw?: { _data?: TreeRow } }) => {
              const d = item.raw?._data;
              if (!d) return '';
              return [
                `${(d.split * 100).toFixed(1)}% of budget`,
                formatMoney(currency, d.budget),
              ];
            },
          },
        },
      },
    }),
    [currency]
  );

  if (rows.length === 0) {
    return (
      <ChartCard title="Budget distribution" className="h-full"
      height="min-h-[360px] flex-1">
        <div className="well flex h-full items-center justify-center px-6 text-center text-[13px] text-ink-2">
          No active countries — toggle markets on to allocate budget.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Budget distribution"
      subtitle="Area is proportional to budget; darker means a larger share"
      className="h-full"
      height="min-h-[360px] flex-1"
    >
      <div className="absolute inset-0">
        {/* @ts-expect-error chartjs-chart-treemap registers a custom controller type not in @types */}
        <Chart type="treemap" data={data} options={options} />
      </div>
    </ChartCard>
  );
}
