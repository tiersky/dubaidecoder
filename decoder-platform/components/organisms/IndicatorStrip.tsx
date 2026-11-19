'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AnimatedNumber from '@/components/atoms/AnimatedNumber';
import MetricInfo from '@/components/atoms/MetricInfo';
import { MarketVm } from '@/lib/dashboard/derive';
import { MetricDef } from '@/lib/model/score';

interface IndicatorStripProps {
  market: MarketVm;
  markets: MarketVm[];
  metrics: MetricDef[];
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Formatter fixed to the final value's precision, so a count-up never jitters
 * between decimal lengths: 2,900,000 · 776.5 · 1.93 · 0.42.
 */
export function precisionFormat(final: number): (v: number) => string {
  const a = Math.abs(final);
  const decimals = a >= 1000 ? 0 : a >= 100 ? 1 : 2;
  const raw = final.toFixed(decimals);
  const needed = raw.includes('.') ? raw.replace(/0+$/, '').split('.')[1]?.length ?? 0 : 0;
  const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: needed, maximumFractionDigits: needed });
  return (v: number) => nf.format(v);
}

/** Position of this market's raw value among all markets that report it. */
function peerPosition(key: string, market: MarketVm, markets: MarketVm[]) {
  const own = market.values[key];
  const values = markets
    .map((m) => m.values[key])
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (own === null || own === undefined || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const rank = values.filter((v) => v > own).length + 1;
  return { fraction: max === min ? 1 : (own - min) / (max - min), rank, of: values.length };
}

/**
 * The market's workbook indicators as one horizontal glass strip that sticks
 * under the toolbar. Cells are divided by hairlines; numbers count up on
 * arrival and the peer bars grow from their leading edge.
 */
export default function IndicatorStrip({ market, markets, metrics }: IndicatorStripProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: '-72px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cells = useMemo(
    () =>
      metrics.map((metric) => {
        const raw = market.values[metric.key];
        const value = raw === null || raw === undefined || !Number.isFinite(raw) ? null : raw;
        return { metric, value, peer: peerPosition(metric.key, market, markets) };
      }),
    [metrics, market, markets]
  );

  if (!cells.length) return null;

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <section
        aria-label="Market indicators"
        data-stuck={stuck}
        className="indicator-strip glass-card sticky top-[70px] z-20 -mt-px lg:top-[66px]"
      >
        <div className="flex overflow-x-auto overscroll-x-contain">
          {cells.map(({ metric, value, peer }, i) => (
            <div
              key={metric.key}
              className="strip-cell materialize flex min-w-[148px] flex-1 flex-col justify-center px-4 py-3 first:pl-5 last:pr-5"
              style={{ ['--i' as string]: Math.min(i, 10) + 1 }}
            >
              <div className="flex min-w-0 items-center gap-1">
                <p className="truncate text-[11.5px] font-medium text-ink-2" title={metric.label}>
                  {metric.label}
                </p>
                <MetricInfo metric={metric} label={metric.label} />
              </div>
              <p className="display mt-0.5 text-[19px] font-semibold leading-tight text-ink">
                {value === null ? (
                  <span className="num">—</span>
                ) : (
                  <AnimatedNumber value={value} from={0} duration={900} format={precisionFormat(value)} />
                )}
              </p>
              {peer && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="strip-track" aria-hidden>
                    <span
                      className="strip-fill"
                      style={{ transform: `scaleX(${Math.round(peer.fraction * 1000) / 1000})` }}
                    />
                  </span>
                  <span className="num whitespace-nowrap text-[11px] text-ink-2">
                    {ordinal(peer.rank)} of {peer.of}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
