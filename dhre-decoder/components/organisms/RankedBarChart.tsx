'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import ChartCard from '@/components/molecules/ChartCard';
import { Country, TIER_CONFIG } from '@/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

interface RankedBarChartProps {
  countries: Country[];
}

export default function RankedBarChart({ countries }: RankedBarChartProps) {
  const sorted = [...countries].sort((a, b) => b.weightedScore - a.weightedScore);

  const data = {
    labels: sorted.map((c) => c.name),
    datasets: [
      {
        label: 'Weighted Score',
        data: sorted.map((c) => c.weightedScore),
        backgroundColor: sorted.map((c) => TIER_CONFIG[c.tier].color + '99'),
        borderColor: sorted.map((c) => TIER_CONFIG[c.tier].color),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: { parsed: { x: number | null } }) =>
            `Score: ${(context.parsed.x ?? 0).toFixed(1)}`,
        },
      },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#475569',
        font: { family: 'Outfit', size: 10, weight: 'bold' as const },
        formatter: (value: number) => value.toFixed(1),
        offset: 2,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } },
        border: { display: false },
        title: {
          display: true,
          text: 'Weighted Score',
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: '#475569', font: { family: 'Outfit', size: 10 } },
        border: { display: false },
      },
    },
  };

  return (
    <ChartCard title="Market Ranking by Weighted Score" height="h-[700px]">
      <Bar data={data} options={options} />
    </ChartCard>
  );
}
