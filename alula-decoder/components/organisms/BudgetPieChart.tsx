'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Pie } from 'react-chartjs-2';
import ChartCard from '@/components/molecules/ChartCard';
import { Allocation } from '@/lib/utils';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7',
];

interface BudgetPieChartProps {
  allocations: Allocation[];
}

export default function BudgetPieChart({ allocations }: BudgetPieChartProps) {
  const sorted = [...allocations].sort((a, b) => b.percentSplit - a.percentSplit);

  const data = {
    labels: sorted.map((a) => a.name),
    datasets: [
      {
        data: sorted.map((a) => a.percentSplit * 100),
        backgroundColor: COLORS.slice(0, sorted.length),
        borderColor: '#fff',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#64748b',
          font: { family: 'Outfit', size: 11 },
          padding: 8,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: { label: string; parsed: number }) => {
            const alloc = sorted[context.parsed !== undefined ? sorted.findIndex(a => a.name === context.label) : 0];
            return [
              `${context.parsed.toFixed(1)}%`,
              `AED ${Math.round(alloc?.budget ?? 0).toLocaleString()}`,
            ];
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: { family: 'Outfit', size: 10, weight: 'bold' as const },
        formatter: (value: number) => value >= 6 ? `${value.toFixed(0)}%` : '',
      },
    },
  };

  return (
    <ChartCard title="Budget Distribution" height="h-[350px]">
      <Pie data={data} options={options} />
    </ChartCard>
  );
}
