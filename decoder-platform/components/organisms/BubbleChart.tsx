'use client';

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bubble } from 'react-chartjs-2';
import ChartCard from '@/components/molecules/ChartCard';
import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

function metricValue(row: MarketVm, key: string, budgetByName: Map<string, number>): number | null {
  if (key === 'score') return row.score;
  if (key === 'split') return row.split;
  if (key === 'budget') return budgetByName.get(row.name) ?? null;
  return row.values[key] ?? null;
}

function axisLabel(key: string, metrics: MetricDef[]): string {
  const metric = metrics.find((m) => m.key === key);
  if (metric) return metric.label;
  if (key === 'score') return 'Weighted Score';
  if (key === 'split') return '% Split';
  if (key === 'budget') return 'Budget Split';
  return key;
}

function formatAxisValue(key: string, value: number, currency: string): string {
  if (key === 'budget') return `${currency} ${Math.round(value).toLocaleString()}`;
  if (key === 'split') return `${(value * 100).toFixed(1)}%`;
  if (key === 'score') return value.toFixed(2);
  return value.toLocaleString();
}

function scaleRadius(value: number, min: number, max: number): number {
  if (max === min) return 15;
  return 8 + 22 * Math.sqrt((value - min) / (max - min));
}

interface BubbleChartProps {
  markets: MarketVm[];
  metrics: MetricDef[];
  allocations: AllocationRow[];
  xAxis: string;
  yAxis: string;
  bubbleSize: string;
  currency: string;
}

export default function BubbleChart({
  markets,
  metrics,
  allocations,
  xAxis,
  yAxis,
  bubbleSize,
  currency,
}: BubbleChartProps) {
  const budgetByName = new Map(allocations.map((a) => [a.name, a.budget]));

  const points = markets
    .map((m) => ({
      name: m.name,
      x: metricValue(m, xAxis, budgetByName),
      y: metricValue(m, yAxis, budgetByName),
      sizeValue: metricValue(m, bubbleSize, budgetByName),
    }))
    .filter((p): p is { name: string; x: number; y: number; sizeValue: number | null } => p.x !== null && p.y !== null);

  const sizeValues = points.map((p) => p.sizeValue ?? 0);
  const min = Math.min(...sizeValues);
  const max = Math.max(...sizeValues);

  const mapPoints = () =>
    points.map((p) => ({
      x: p.x,
      y: p.y,
      r: scaleRadius(p.sizeValue ?? 0, min, max),
      name: p.name,
    }));

  const data = {
    datasets: [
      {
        label: 'Markets',
        data: mapPoints(),
        backgroundColor: 'rgba(59, 130, 246, 0.35)',
        borderColor: '#3b82f6',
        borderWidth: 1.5,
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
          color: '#94a3b8',
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
          title: (items: { dataIndex: number; datasetIndex: number }[]) => {
            if (!items.length) return '';
            const item = items[0];
            const dataset = data.datasets[item.datasetIndex];
            const point = dataset.data[item.dataIndex] as { name: string };
            return point.name;
          },
          label: (context: { parsed: { x: number | null; y: number | null } }) => [
            `${axisLabel(xAxis, metrics)}: ${formatAxisValue(xAxis, context.parsed.x ?? 0, currency)}`,
            `${axisLabel(yAxis, metrics)}: ${formatAxisValue(yAxis, context.parsed.y ?? 0, currency)}`,
          ],
        },
      },
      datalabels: {
        color: '#475569',
        font: {
          family: 'Outfit',
          size: 9,
        },
        formatter: (_value: unknown, context: { dataIndex: number; datasetIndex: number }) => {
          const dataset = data.datasets[context.datasetIndex];
          const point = dataset.data[context.dataIndex] as { name: string };
          return point.name;
        },
        align: 'top' as const,
        offset: 4,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: axisLabel(xAxis, metrics),
          color: '#94a3b8',
          font: { family: 'Outfit', size: 12 },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
        },
        border: {
          display: false,
        },
      },
      y: {
        title: {
          display: true,
          text: axisLabel(yAxis, metrics),
          color: '#94a3b8',
          font: { family: 'Outfit', size: 12 },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Outfit', size: 11 },
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <ChartCard title="Market Analysis" height="h-[400px]">
      <Bubble data={data} options={options} />
    </ChartCard>
  );
}
