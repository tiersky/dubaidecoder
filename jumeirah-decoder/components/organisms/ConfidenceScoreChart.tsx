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
import {
  confidenceWeekLabels,
  getConfidenceSeries,
  getLatestConfidence,
} from '@/data/confidenceScore';

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
  countryCode: string;
  countryName: string;
}

export default function ConfidenceScoreChart({
  countryCode,
  countryName,
}: ConfidenceScoreChartProps) {
  const series = getConfidenceSeries(countryCode);
  const latest = getLatestConfidence(countryCode);

  if (!series || latest === null) {
    return (
      <GlassCard padding="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Confidence Score Trend
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Weekly index • {countryName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              Latest
            </p>
            <p className="text-2xl font-bold text-slate-300 tabular-nums leading-tight">
              N/A
            </p>
          </div>
        </div>
        <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
          Confidence score data not available for {countryName}.
        </div>
      </GlassCard>
    );
  }

  const data = {
    labels: confidenceWeekLabels,
    datasets: [
      {
        label: countryName,
        data: series,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `Confidence: ${(ctx.parsed.y ?? 0).toFixed(2)}`,
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
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 12,
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
            Weekly index • {countryName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            Latest
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">
            {latest.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="relative h-[320px]">
        <Line data={data} options={options} />
      </div>
    </GlassCard>
  );
}
