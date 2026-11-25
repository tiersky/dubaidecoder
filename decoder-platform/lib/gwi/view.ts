/**
 * What the dashboard shows of a decoder's GWI results for one market. Pure,
 * so the card stays a thin renderer and the sample rules are tested once.
 */
import { GWI_LOCATIONS, gwiCountry } from './locations';
import { GWI_LOW_SAMPLE, GWI_MIN_SAMPLE, type GwiConfig, type GwiSize } from './types';

export interface GwiBar {
  label: string;
  pct: number;
  /** Mean across the decoder's countries (reference countries excluded); null with fewer than two. */
  avg: number | null;
  index: number;
}

export interface GwiPanelView {
  key: string;
  title: string;
  audience: string;
  sample: number;
  /** Fewer than GWI_LOW_SAMPLE respondents: shown, marked indicative. */
  low: boolean;
  bars: GwiBar[];
}

export interface GwiMarketView {
  /** The country the numbers describe. */
  country: { iso2: string; name: string };
  /** Set when the market reads another country's numbers (Monaco → France). */
  proxyOf?: string;
  audience: { key: string; name: string; description?: string; size: GwiSize | null; low: boolean };
  /** The other audiences' sizes in the same country. */
  others: Array<{ key: string; name: string; size: GwiSize }>;
  /** The primary audience in the reference countries, for comparison. */
  reference: Array<{ iso2: string; name: string; size: GwiSize }>;
  panels: GwiPanelView[];
  /** Panels GWI hasn't surveyed in this country (or too few respondents to show). */
  missing: string[];
  waves: string[];
  fetchedAt: string;
  /** Countries the index and average are measured across. */
  baseCountries: number;
}

const shown = (sample: number) => sample >= GWI_MIN_SAMPLE;

export function gwiMarketView(gwi: GwiConfig | undefined, marketIso2: string | null, marketIso2s: Array<string | null>): GwiMarketView | null {
  const r = gwi?.results;
  const iso2 = gwiCountry(marketIso2);
  if (!gwi || !r || !iso2 || !r.locations[iso2]) return null;

  const ref = new Set((gwi.reference ?? []).map((c) => c.toLowerCase()));
  const decoderCountries = [...new Set(marketIso2s.map(gwiCountry).filter((c): c is string => Boolean(c && r.locations[c])))];
  const primary = gwi.audiences.find((a) => a.key === gwi.primaryAudience) ?? gwi.audiences[0];
  const size = r.sizes[primary.key]?.[iso2];

  const panels: GwiPanelView[] = [];
  const missing: string[] = [];
  for (const p of gwi.panels) {
    const cells = r.panels[p.key]?.[iso2];
    const refs = p.datapoints.filter((d) => d.home?.toLowerCase() !== iso2 && cells?.[d.code]);
    const sample = refs.length ? Math.max(...refs.map((d) => cells![d.code].sample)) : 0;
    if (!refs.length || !shown(sample)) {
      missing.push(p.title);
      continue;
    }
    const bars = refs.map((d) => {
      const peers = decoderCountries
        .filter((c) => d.home?.toLowerCase() !== c)
        .map((c) => r.panels[p.key]?.[c]?.[d.code])
        .filter((c) => c && shown(c.sample))
        .map((c) => c!.pct);
      return {
        label: d.label,
        pct: cells![d.code].pct,
        avg: peers.length >= 2 ? peers.reduce((a, b) => a + b, 0) / peers.length : null,
        index: cells![d.code].index,
      };
    });
    bars.sort((a, b) => b.pct - a.pct);
    const audience = gwi.audiences.find((a) => a.key === p.audience)?.name ?? p.audience;
    panels.push({ key: p.key, title: p.title, audience, sample, low: sample < GWI_LOW_SAMPLE, bars });
  }

  return {
    country: { iso2, name: r.locations[iso2].name ?? GWI_LOCATIONS[iso2]?.name },
    ...(marketIso2 && marketIso2.toLowerCase() !== iso2 && { proxyOf: marketIso2.toLowerCase() }),
    audience: {
      key: primary.key,
      name: primary.name,
      ...(primary.description && { description: primary.description }),
      size: size && shown(size.sample) ? size : null,
      low: Boolean(size && size.sample < GWI_LOW_SAMPLE),
    },
    others: gwi.audiences
      .filter((a) => a.key !== primary.key)
      .flatMap((a) => {
        const s = r.sizes[a.key]?.[iso2];
        return s && shown(s.sample) ? [{ key: a.key, name: a.name, size: s }] : [];
      }),
    reference: [...ref]
      .filter((c) => c !== iso2)
      .flatMap((c) => {
        const s = r.sizes[primary.key]?.[c];
        return s && shown(s.sample) ? [{ iso2: c, name: r.locations[c]?.name ?? c.toUpperCase(), size: s }] : [];
      }),
    panels,
    missing,
    waves: r.waves,
    fetchedAt: r.fetchedAt,
    baseCountries: Object.keys(r.locations).length,
  };
}

/** "q4_2025" … "q3_2026" → "Q4 2025 – Q3 2026". */
export function waveSpan(waves: string[]): string {
  const label = (w: string) => w.replace(/^q(\d)_(\d{4})$/, 'Q$1 $2');
  const sorted = [...waves].sort((a, b) => {
    const [qa, ya] = a.slice(1).split('_').map(Number);
    const [qb, yb] = b.slice(1).split('_').map(Number);
    return ya - yb || qa - qb;
  });
  return sorted.length > 1 ? `${label(sorted[0])} – ${label(sorted[sorted.length - 1])}` : label(sorted[0] ?? '');
}

/** 1_797_197 → "1.8M", 92_100 → "92k". */
export function compactPeople(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}
