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
import { MarketVm, AllocationRow } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';
import { ACCENT, GRID, INK, INK_2, TOOLTIP_CHART, chartFont, formatMoney } from '@/lib/ui/theme';

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
  if (key === 'budget') return formatMoney(currency, value);
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

  const family = chartFont();

  const data = {
    datasets: [
      {
        label: 'Markets',
        data: mapPoints(),
        backgroundColor: 'rgba(0, 113, 227, 0.18)',
        hoverBackgroundColor: 'rgba(0, 113, 227, 0.32)',
        borderColor: ACCENT,
        hoverBorderColor: ACCENT,
        borderWidth: 1.5,
        hoverBorderWidth: 2,
      },
    ],
  };

  const axis = (key: string) => ({
    title: {
      display: true,
      text: axisLabel(key, metrics),
      color: INK_2,
      font: { family, size: 12, weight: 500 as const },
      padding: { top: 8 },
    },
    grid: { color: GRID, drawTicks: false },
    ticks: { color: INK_2, font: { family, size: 11 }, padding: 8 },
    border: { display: false },
    grace: '8%',
  });

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutQuart' as const },
    layout: { padding: { top: 12, right: 12 } },
    plugins: {
      // Single series: the card title names it, so no legend box.
      legend: { display: false },
      tooltip: {
        ...TOOLTIP_CHART,
        titleFont: { family, size: 12, weight: 600 as const },
        bodyFont: { family, size: 12 },
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
        color: INK,
        font: { family, size: 10.5, weight: 500 as const },
        formatter: (_value: unknown, context: { dataIndex: number; datasetIndex: number }) => {
          const dataset = data.datasets[context.datasetIndex];
          const point = dataset.data[context.dataIndex] as { name: string };
          return point.name;
        },
        align: 'top' as const,
        anchor: 'end' as const,
        offset: 2,
        clamp: true,
      },
    },
    scales: { x: axis(xAxis), y: axis(yAxis) },
  };

  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-ink-2">
        No active markets report both indicators. Choose other axes or turn markets on.
      </div>
    );
  }

  return <Bubble data={data} options={options} />;
}
