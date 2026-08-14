'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Doughnut } from 'react-chartjs-2';
import GlassCard from '@/components/atoms/GlassCard';
import { Country } from '@/types';
import { Region } from '@/types';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

const REGION_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4',
];

interface RegionalBreakdownProps {
  countries: Country[];
  regions: Region[];
}

export default function RegionalBreakdown({ countries, regions }: RegionalBreakdownProps) {
  const countryMap = new Map(countries.map((c) => [c.code, c]));

  const regionData = regions.map((region) => {
    const regionCountries = region.countries
      .map((code) => countryMap.get(code))
      .filter((c): c is Country => c !== undefined && c.tier !== 'excluded');
    const totalScore = regionCountries.reduce((sum, c) => sum + c.weightedScore, 0);
    return { ...region, totalScore, count: regionCountries.length };
  });

  const grandTotal = regionData.reduce((sum, r) => sum + r.totalScore, 0);
  const withShare = regionData.map((r) => ({
    ...r,
    share: grandTotal > 0 ? (r.totalScore / grandTotal) * 100 : 0,
  }));

  const sorted = [...withShare].sort((a, b) => b.share - a.share);

  const chartData = {
    labels: sorted.map((r) => r.name),
    datasets: [
      {
        data: sorted.map((r) => r.share),
        backgroundColor: REGION_COLORS.slice(0, sorted.length),
        borderColor: '#fff',
        borderWidth: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#64748b',
          font: { family: 'Outfit', size: 11 },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
      datalabels: {
        color: '#fff',
        font: { family: 'Outfit', size: 11, weight: 'bold' as const },
        formatter: (value: number) => value >= 3 ? `${value.toFixed(0)}%` : '',
      },
    },
  };

  return (
    <GlassCard>
      <h3 className="text-sm font-semibold text-slate-800 mb-4">
        Regional Budget Distribution
      </h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="relative h-[300px]">
          <Doughnut data={chartData} options={chartOptions} />
        </div>

        {/* Region Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-3 py-2.5 text-left uppercase tracking-wider text-slate-400 font-medium">
                  Region
                </th>
                <th className="px-3 py-2.5 text-right uppercase tracking-wider text-slate-400 font-medium">
                  Share
                </th>
                <th className="px-3 py-2.5 text-left uppercase tracking-wider text-slate-400 font-medium">
                  Insight
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((region, i) => (
                <tr
                  key={region.name}
                  className={`border-b border-slate-100/40 ${
                    i % 2 === 0 ? 'bg-white/30' : 'bg-slate-50/20'
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: REGION_COLORS[i] }}
                      />
                      <span className="font-medium text-slate-700">{region.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-700 tabular-nums">
                    ~{region.share.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-xs">
                    <p className="line-clamp-2">{region.insight}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </GlassCard>
  );
}
