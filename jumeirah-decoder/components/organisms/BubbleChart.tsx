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
import { Country } from '@/types';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend, ChartDataLabels);

function camelCaseToWords(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function scaleRadius(value: number, metric: string): number {
  let r: number;

  if (metric === 'budgetSplit') {
    r = Math.sqrt(value / 100_000) * 2;
  } else if (metric === 'finalWeightedScore') {
    r = Math.sqrt(value) / 2;
  } else if (metric === 'population') {
    r = Math.sqrt(value / 1_000_000) * 3;
  } else if (metric === 'googleTravelIntent') {
    r = Math.sqrt(value / 100_000) * 3;
  } else if (metric === 'novTravelVolume') {
    r = Math.sqrt(value / 1_000) * 3;
  } else {
    r = Math.sqrt(Math.abs(value)) * 2;
  }

  return Math.max(8, Math.min(40, r));
}

interface BubbleChartProps {
  allCountries: Country[];
  xAxis: string;
  yAxis: string;
  bubbleSize: string;
}

export default function BubbleChart({ allCountries, xAxis, yAxis, bubbleSize }: BubbleChartProps) {
  const mapCountries = (countries: Country[]) =>
    countries.map((c) => ({
      x: Number(c[xAxis as keyof Country]) || 0,
      y: Number(c[yAxis as keyof Country]) || 0,
      r: scaleRadius(Number(c[bubbleSize as keyof Country]) || 0, bubbleSize),
      name: c.name,
    }));

  const data = {
    datasets: [
      {
        label: 'Markets',
        data: mapCountries(allCountries),
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
            `${camelCaseToWords(xAxis)}: ${(context.parsed.x ?? 0).toLocaleString()}`,
            `${camelCaseToWords(yAxis)}: ${(context.parsed.y ?? 0).toLocaleString()}`,
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
          text: camelCaseToWords(xAxis),
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
          text: camelCaseToWords(yAxis),
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
