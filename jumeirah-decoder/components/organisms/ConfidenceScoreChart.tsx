'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import GlassCard from '@/components/atoms/GlassCard';
import { confidenceWeeks, LATEST_CONFIDENCE_SCORE } from '@/data/confidenceScore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface ConfidenceScoreChartProps {
  countryName: string;
}

const SERIES = [
  { key: 'social', label: 'Social', color: '#3b82f6' },
  { key: 'recordedSearch', label: 'Recorded Search', color: '#10b981' },
  { key: 'consolidated', label: 'Consolidated', color: '#8b5cf6' },
] as const;

export default function ConfidenceScoreChart({
  countryName,
}: ConfidenceScoreChartProps) {
  const labels = confidenceWeeks.map((w) => w.weekLabel);

  const data = {
    labels,
    datasets: SERIES.map((s) => {
      const isConsolidated = s.key === 'consolidated';
      return {
        label: s.label,
        data: confidenceWeeks.map((w) => w[s.key] as number),
        borderColor: s.color,
        backgroundColor: isConsolidated ? `${s.color}22` : 'transparent',
        borderWidth: isConsolidated ? 2.5 : 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: s.color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.4,
        fill: isConsolidated,
      };
    }),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#64748b',
          font: { family: 'Outfit', size: 11 },
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(2)}`,
        },
      },
      datalabels: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.08)' },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 10 },
        },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
          callback: (val: string | number) => Number(val).toFixed(0),
        },
        border: { display: false },
        title: {
          display: true,
          text: 'Confidence Score',
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
        },
      },
    },
  };

  return (
    <GlassCard padding="p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Confidence Score Trend
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            MENA-wide weekly index • applied to {countryName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            Latest Consolidated
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">
            {LATEST_CONFIDENCE_SCORE.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="relative h-[320px]">
        <Line data={data} options={options} />
      </div>
    </GlassCard>
  );
}
