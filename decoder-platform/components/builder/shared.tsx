'use client';

import type { ReactNode } from 'react';
import type { UniverseCountry } from '@/lib/recommend/universe';
import type { MetricDef } from '@/lib/model/score';
import { catalogById } from '@/lib/builder/catalog';

export type Universe = Map<string, UniverseCountry>;

/** Ratios typed as percentages (12 for 0.12). */
export const isPercent = (m: Pick<MetricDef, 'key' | 'kind' | 'unit'>) =>
  Boolean(catalogById.get(m.key)?.percentInput) || (m.kind === 'ratio' && m.unit === '%');

export function formatValue(v: number | null | undefined, m: Pick<MetricDef, 'key' | 'kind' | 'unit'>): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  if (isPercent(m)) return `${+(v * 100).toFixed(2)}%`;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${+(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return Math.round(v).toLocaleString('en-US');
  return String(+v.toFixed(abs < 1 ? 3 : 2));
}

export function formatMoney(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${Math.round(v).toLocaleString('en-US')}`;
  }
}

/** A titled section of a step. */
export function Section({ title, hint, children, aside }: { title: string; hint?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="glass-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{hint}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-2">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'glass-input w-full rounded-[10px] px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-3';

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'warn' | 'good'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-black/[0.05] text-ink-2',
    accent: 'bg-[rgba(0,113,227,0.1)] text-accent',
    warn: 'bg-amber-500/15 text-amber-800',
    good: 'bg-emerald-500/15 text-emerald-800',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
