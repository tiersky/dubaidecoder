'use client';

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import ChartCard from '@/components/molecules/ChartCard';
import { Country, INDEX_KEYS, INDEX_LABELS } from '@/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  country: Country;
}

export default function RadarChart({ country }: RadarChartProps) {
  const labels = INDEX_KEYS.map((k) => INDEX_LABELS[k]);
  const countryValues = INDEX_KEYS.map((k) => country.indices[k] ?? 0);
  const uaeBenchmark = INDEX_KEYS.map(() => 0.5);

  const data = {
    labels,
    datasets: [
      {
        label: country.name,
        data: countryValues,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 3,
      },
      {
        label: 'UAE Benchmark',
        data: uaeBenchmark,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointBackgroundColor: '#f59e0b',
        pointRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#64748b',
          font: { family: 'Outfit', size: 11 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { r: number } }) =>
            `${context.dataset.label}: ${context.parsed.r.toFixed(3)}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 1,
        ticks: {
          stepSize: 0.25,
          color: '#94a3b8',
          font: { family: 'Outfit', size: 9 },
          backdropColor: 'transparent',
        },
        pointLabels: {
          color: '#475569',
          font: { family: 'Outfit', size: 10 },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)',
        },
        angleLines: {
          color: 'rgba(148, 163, 184, 0.15)',
        },
      },
    },
  };

  return (
    <ChartCard title="Normalized Index Scores" subtitle="vs UAE Benchmark (0.5 midline)" height="h-[350px]">
      <Radar data={data} options={options} />
    </ChartCard>
  );
}
