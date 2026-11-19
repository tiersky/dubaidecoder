'use client';

import { useMemo, useState } from 'react';
import AnimatedNumber from '@/components/atoms/AnimatedNumber';
import MetricInfo from '@/components/atoms/MetricInfo';
import Flag from '@/components/atoms/Flag';
import ScrollRow from '@/components/atoms/ScrollRow';
import { MarketVm } from '@/lib/dashboard/derive';
import { DIMENSIONS, cultureProfile, fitScore, type CultureProfile, type Scores } from '@/lib/insights/hofstede';

interface CultureProfileCardProps {
  market: MarketVm;
  markets: MarketVm[];
  onOpenExplorer: () => void;
}

const AVERAGE = '__average__';
const EQUAL = Object.fromEntries(DIMENSIONS.map((d) => [d.key, 1])) as Record<(typeof DIMENSIONS)[number]['key'], number>;

/**
 * The market's six Hofstede dimensions as bars, with a marker for whichever
 * market (or the decoder average) it is compared against.
 */
export default function CultureProfileCard({ market, markets, onOpenExplorer }: CultureProfileCardProps) {
  const profiles = useMemo(
    () =>
      markets
        .map((m) => ({ m, p: cultureProfile(m.iso2) }))
        .filter((x): x is { m: MarketVm; p: CultureProfile } => x.p !== null),
    [markets]
  );
  const own = profiles.find((x) => x.m.name === market.name)?.p ?? null;
  const others = profiles.filter((x) => x.m.name !== market.name);
  const [target, setTarget] = useState<string>(AVERAGE);

  const average = useMemo(() => {
    const s = {} as Scores;
    for (const d of DIMENSIONS) s[d.key] = profiles.reduce((t, x) => t + x.p.scores[d.key], 0) / Math.max(1, profiles.length);
    return s;
  }, [profiles]);

  if (!own) return null;
  const targetEntry = others.find((x) => x.m.name === target);
  const compareScores = targetEntry?.p.scores ?? average;
  const compareLabel = targetEntry ? targetEntry.m.name : 'Decoder average';
  const fit = fitScore(own.scores, compareScores, EQUAL);
  const widest = DIMENSIONS.map((d) => ({ d, gap: own.scores[d.key] - compareScores[d.key] })).sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap)
  )[0];

  return (
    <section aria-label={`${market.name} culture profile`} className="glass-card materialize p-5 sm:p-6" style={{ ['--i' as string]: 3 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Culture profile</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-2">Hofstede&apos;s six dimensions, 0 to 100. The tick marks {compareLabel}.</p>
        </div>
        <div className="text-right">
          <p className="text-[11.5px] text-ink-2">Similarity to {compareLabel}</p>
          <p className="display text-[24px] font-semibold leading-tight text-ink">
            <AnimatedNumber value={fit} from={0} duration={700} format={(v) => `${Math.round(v)}%`} />
          </p>
        </div>
      </div>

      <ScrollRow label="Compare culture with" className="mt-4">
        <button type="button" className="chip flex-shrink-0 whitespace-nowrap" aria-pressed={target === AVERAGE} onClick={() => setTarget(AVERAGE)}>
          Decoder average
        </button>
        {others.map(({ m }) => (
          <button
            key={m.name}
            type="button"
            className="chip flex-shrink-0 whitespace-nowrap"
            aria-pressed={target === m.name}
            onClick={() => setTarget(m.name)}
          >
            <Flag iso2={m.iso2} name={m.name} size="sm" />
            {m.name}
          </button>
        ))}
      </ScrollRow>

      <div className="mt-5 grid gap-x-10 gap-y-4 md:grid-cols-2">
        {DIMENSIONS.map((d, i) => {
          const v = own.scores[d.key];
          const c = compareScores[d.key];
          const regional = own.regional.includes(d.key);
          return (
            <div key={d.key} className="materialize" style={{ ['--i' as string]: i + 4 }}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{d.label}</p>
                  <MetricInfo metric={{ label: d.label, description: `${d.about} Low: ${d.low.toLowerCase()}. High: ${d.high.toLowerCase()}.` }} />
                  {regional && <span className="whitespace-nowrap text-[10.5px] font-medium text-ink-2">· regional estimate</span>}
                </div>
                <p className="num text-[13px] font-semibold text-ink">
                  <AnimatedNumber value={v} from={0} duration={800} format={(x) => String(Math.round(x))} />
                  <span className="ml-1.5 text-[11.5px] font-medium text-ink-2">vs {Math.round(c)}</span>
                </p>
              </div>
              <div className="relative mt-2 h-[6px] rounded-full bg-black/[0.07]">
                <span
                  className="bar-h absolute inset-y-0 left-0 w-full rounded-full"
                  style={{ transform: `scaleX(${v / 100})`, background: 'var(--color-accent)', opacity: regional ? 0.5 : 1 }}
                />
                <span
                  aria-hidden
                  className="marker-x absolute -top-[4px] h-[14px] w-[2.5px] -translate-x-1/2 rounded-full bg-ink shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)]"
                  style={{ left: `${c}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10.5px] text-ink-2">
                <span>{d.low}</span>
                <span>{d.high}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <p className="text-[12.5px] text-ink-2">
          Widest gap: <span className="font-medium text-ink">{widest.d.label.toLowerCase()}</span>,{' '}
          {Math.abs(Math.round(widest.gap))} points {widest.gap > 0 ? 'higher' : 'lower'} than {compareLabel}.
        </p>
        <button type="button" onClick={onOpenExplorer} className="press text-[13px] font-medium text-accent">
          Rank all markets by culture
        </button>
      </div>
    </section>
  );
}
