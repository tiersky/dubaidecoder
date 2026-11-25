'use client';

import type { GwiConfig } from '@/lib/gwi/types';
import { compactPeople, gwiMarketView, waveSpan, type GwiPanelView } from '@/lib/gwi/view';

const pct = (n: number) => `${n < 10 ? n.toFixed(1) : Math.round(n)}%`;
/** Percentage points above the decoder average that make a bar stand out. */
const STANDOUT = 5;

/**
 * Who the decoder's GWI audience is in a market's country: its size, then
 * one minimal bar list per panel. A tick marks the average across the
 * decoder's countries; bars 5+ points above it turn ink, the rest stay grey.
 */
export default function GwiAudienceCard({
  gwi,
  iso2,
  marketIso2s,
  countryLabel,
}: {
  gwi: GwiConfig | undefined;
  iso2: string | null;
  marketIso2s: Array<string | null>;
  /** Set for city markets: the heading names the country. */
  countryLabel?: string;
}) {
  const v = gwiMarketView(gwi, iso2, marketIso2s);
  if (!v) return null;
  const { audience } = v;
  const country = v.country.name;

  return (
    <section aria-label="Audience from GWI" className="glass-card materialize p-5 sm:p-6" style={{ ['--i' as string]: 2 }}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Audience · GWI
            <span className="font-normal text-ink-2">
              {' '}
              · {countryLabel || v.proxyOf ? `${country}, country level` : country}
            </span>
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-ink-2">
            {audience.name}
            {audience.description ? `. ${audience.description}` : ''}
            {v.proxyOf && ` GWI doesn’t survey ${v.proxyOf === 'mc' ? 'Monaco' : v.proxyOf.toUpperCase()}, so these are ${country}’s figures.`}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className="text-[11.5px] text-ink-2">{audience.name}</dt>
          <dd className="num display mt-0.5 text-[22px] font-semibold leading-tight text-ink">
            {audience.size ? compactPeople(audience.size.size) : '—'}
          </dd>
          <dd className="text-[11px] text-ink-2">
            {audience.size
              ? `${pct(audience.size.share)} of internet users${audience.low ? ' · indicative' : ''}`
              : 'too few respondents'}
          </dd>
        </div>
        {v.others.map((o) => (
          <div key={o.key}>
            <dt className="text-[11.5px] text-ink-2">{o.name}</dt>
            <dd className="num display mt-0.5 text-[22px] font-semibold leading-tight text-ink">{compactPeople(o.size.size)}</dd>
            <dd className="text-[11px] text-ink-2">
              {pct(o.size.share)} of internet users{o.size.sample < 100 ? ' · indicative' : ''}
            </dd>
          </div>
        ))}
        {v.reference.map((r) => (
          <div key={r.iso2}>
            <dt className="text-[11.5px] text-ink-2">Same audience in {r.name}</dt>
            <dd className="num display mt-0.5 text-[22px] font-semibold leading-tight text-ink-2">{compactPeople(r.size.size)}</dd>
            <dd className="text-[11px] text-ink-2">{pct(r.size.share)} of internet users</dd>
          </div>
        ))}
      </dl>

      {v.panels.length > 0 && (
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {v.panels.map((p) => (
            <Panel key={p.key} panel={p} />
          ))}
        </div>
      )}

      <p className="mt-5 border-t border-black/[0.06] pt-4 text-[11.5px] leading-relaxed text-ink-2">
        GWI Core survey, internet users 16–64, {waveSpan(v.waves)}. Shares are of the audience in {country}. The tick is the average across the
        decoder’s countries; darker bars are {STANDOUT}+ points above it. Indicative = fewer than 100 respondents.
        {v.missing.length > 0 && ` Not surveyed here, or too few respondents: ${v.missing.join(', ').toLowerCase()}.`}
      </p>
    </section>
  );
}

function Panel({ panel }: { panel: GwiPanelView }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink">{panel.title}</h3>
      <p className="mt-0.5 text-[11.5px] text-ink-2">
        <span className="num">{panel.sample.toLocaleString('en-US')}</span> respondents{panel.low && ' · indicative'}
      </p>
      <ul className="mt-3 space-y-2">
        {panel.bars.map((b) => (
          <li key={b.label} className="grid grid-cols-[minmax(0,10rem)_1fr_2.75rem] items-center gap-3 text-[12px]">
            <span className="truncate text-ink-2" title={b.label}>
              {b.label}
            </span>
            <span className="relative h-[7px] rounded-full bg-black/[0.06]" aria-hidden>
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-out)]"
                style={{ width: `${Math.min(100, b.pct)}%`, background: b.avg != null && b.pct - b.avg >= STANDOUT ? 'var(--color-ink)' : '#9aa3b2' }}
              />
              {b.avg != null && (
                <span
                  className="absolute -top-[3px] h-[13px] w-[2px] rounded-full bg-ink/70"
                  style={{ left: `calc(${Math.min(100, b.avg)}% - 1px)` }}
                  title={`Average across the decoder’s countries: ${pct(b.avg)}`}
                />
              )}
            </span>
            <span className="num text-right font-semibold text-ink">{pct(b.pct)}</span>
            <span className="sr-only">
              {b.label}: {pct(b.pct)}
              {b.avg != null && `, decoder average ${pct(b.avg)}`}, index {Math.round(b.index)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
