'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface RadarSeries {
  id: string;
  label: string;
  color: string;
  values: number[]; // 0–100, one per axis
  dashed?: boolean;
}

interface RadarChartProps {
  axes: string[];
  series: RadarSeries[];
  size?: number;
}

/** Splits an axis label into lines of about 12 characters at word breaks. */
function wrap(label: string, max = 12): string[] {
  const out: string[] = [];
  for (const word of label.split(' ')) {
    const last = out[out.length - 1];
    if (last && (last + ' ' + word).length <= max) out[out.length - 1] = `${last} ${word}`;
    else out.push(word);
  }
  return out;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Outline radar for comparing profiles. Each polygon tweens from its
 * on-screen shape to the new one; a newly added series grows from the centre.
 */
export default function RadarChart({ axes, series, size = 300 }: RadarChartProps) {
  const [shown, setShown] = useState<Record<string, number[]>>({});
  const shownRef = useRef(shown);
  const seriesRef = useRef(series);
  useLayoutEffect(() => {
    shownRef.current = shown;
    seriesRef.current = series;
  });
  const shapeKey = JSON.stringify(series.map((s) => [s.id, s.values]));

  useEffect(() => {
    const from = shownRef.current;
    const target = Object.fromEntries(seriesRef.current.map((s) => [s.id, s.values]));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 1 : 480;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutExpo(t);
      const next: Record<string, number[]> = {};
      for (const [id, vals] of Object.entries(target)) {
        const f = from[id] ?? vals.map(() => 0);
        next[id] = vals.map((v, i) => f[i] + (v - f[i]) * e);
      }
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shapeKey]);

  const c = size / 2;
  const r = size / 2 - 62;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" role="img" aria-label={`Radar comparing ${series.map((s) => s.label).join(', ')}`}>
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} points={poly(axes.map(() => ring))} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={ring === 100 ? 1 : 0.75} />
      ))}
      {axes.map((label, i) => {
        const [x, y] = pt(i, 100);
        const [lx, ly] = pt(i, 118);
        const lines = wrap(label);
        const anchor = Math.abs(lx - c) < 4 ? 'middle' : lx > c ? 'start' : 'end';
        return (
          <g key={label}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="rgba(0,0,0,0.08)" strokeWidth={0.75} />
            <text x={lx} y={ly - ((lines.length - 1) * 13) / 2} textAnchor={anchor} dominantBaseline="middle" className="fill-[#5f5f66] text-[11.5px] font-medium">
              {lines.map((line, k) => (
                <tspan key={k} x={lx} dy={k === 0 ? 0 : 13}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      {series.map((s) => {
        const vals = shown[s.id];
        if (!vals) return null;
        return (
          <g key={s.id}>
            <polygon
              points={poly(vals)}
              fill={s.dashed ? 'none' : s.color}
              fillOpacity={0.08}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeDasharray={s.dashed ? '4 4' : undefined}
              strokeLinejoin="round"
            />
            {!s.dashed &&
              vals.map((v, i) => {
                const [x, y] = pt(i, v);
                return <circle key={i} cx={x} cy={y} r={2.6} fill="#fff" stroke={s.color} strokeWidth={1.6} />;
              })}
          </g>
        );
      })}
    </svg>
  );
}
