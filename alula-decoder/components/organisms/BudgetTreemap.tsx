'use client';

import { Chart as ChartJS, Tooltip, Legend } from 'chart.js';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';
import { Chart } from 'react-chartjs-2';
import { useMemo } from 'react';
import ChartCard from '@/components/molecules/ChartCard';
import { Allocation } from '@/lib/utils';

ChartJS.register(TreemapController, TreemapElement, Tooltip, Legend);

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
  '#eab308', '#f43f5e', '#0891b2', '#7c3aed', '#65a30d',
  '#dc2626', '#0284c7', '#9333ea',
];

interface BudgetTreemapProps {
  allocations: Allocation[];
}

interface TreeRow {
  name: string;
  code: string;
  budget: number;
  percentSplit: number;
  color: string;
}

export default function BudgetTreemap({ allocations }: BudgetTreemapProps) {
  const rows = useMemo<TreeRow[]>(() => {
    const sorted = [...allocations]
      .filter((a) => a.budget > 0)
      .sort((a, b) => b.budget - a.budget);
    return sorted.map((a, i) => ({
      name: a.name,
      code: a.code,
      budget: a.budget,
      percentSplit: a.percentSplit,
      color: COLORS[i % COLORS.length],
    }));
  }, [allocations]);

  const data = useMemo(
    () => ({
      datasets: [
        {
          tree: rows,
          key: 'budget',
          borderWidth: 1,
          borderColor: '#ffffff',
          spacing: 1,
          backgroundColor: (ctx: { raw?: { _data?: TreeRow } }) =>
            ctx.raw?._data?.color ?? '#cbd5e1',
          labels: {
            display: true,
            align: 'left' as const,
            position: 'top' as const,
            color: '#ffffff',
            font: { family: 'Outfit', size: 11, weight: 'bold' as const },
            padding: 6,
            formatter: (ctx: { raw?: { _data?: TreeRow } }) => {
              const d = ctx.raw?._data;
              if (!d) return '';
              const pct = (d.percentSplit * 100).toFixed(1);
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
      plugins: {
        legend: { display: false },
        // chartjs-plugin-datalabels is registered globally elsewhere — it
        // tries to render values on every rect and looks like grey noise on
        // top of the treemap's own white labels. Disable explicitly here.
        datalabels: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { family: 'Outfit', size: 12 },
          bodyFont: { family: 'Outfit', size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items: Array<{ raw?: { _data?: TreeRow } }>) =>
              items[0]?.raw?._data?.name ?? '',
            label: (item: { raw?: { _data?: TreeRow } }) => {
              const d = item.raw?._data;
              if (!d) return '';
              return [
                `${(d.percentSplit * 100).toFixed(1)}% of budget`,
                `AED ${Math.round(d.budget).toLocaleString()}`,
              ];
            },
          },
        },
      },
    }),
    []
  );

  if (rows.length === 0) {
    return (
      <ChartCard title="Budget Distribution" height="h-[420px]">
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No active countries — toggle markets on to allocate budget.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Budget Distribution" height="h-[420px]">
      {/* @ts-expect-error chartjs-chart-treemap registers a custom controller type not in @types */}
      <Chart type="treemap" data={data} options={options} />
    </ChartCard>
  );
}
