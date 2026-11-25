/**
 * Builds GWI Platform API stats queries for a decoder and turns the answers
 * into GwiResults. Pure apart from the injected `post`, so it's tested
 * against recorded responses and the server client does the HTTP.
 */
import { gwiCountry, gwiLocation } from './locations';
import type { GwiAudience, GwiCell, GwiConfig, GwiPanel, GwiResults, GwiSize } from './types';

export interface StatsRow {
  datapoint: string;
  segment?: string | null;
  audience?: string | null;
  suffix?: string | number | null;
  metrics: {
    positive_sample: number;
    positive_size: number;
    audience_sample: number;
    audience_size: number;
    audience_percentage: number;
    audience_index: number;
    datapoint_sample: number;
    datapoint_size: number;
    datapoint_percentage: number;
  };
}
export interface StatsResponse {
  meta?: { type?: string; question?: string; splitter?: string };
  data: StatsRow[];
}

export type StatsPost = (body: Record<string, unknown>) => Promise<StatsResponse>;

const inline = (a: GwiAudience) => ({ id: a.key, name: a.name, expression: a.expression });

/** Locations for a decoder's markets: one per country, cities folded into their country. */
export function decoderLocations(iso2s: Array<string | null>): { locations: GwiResults['locations']; unsupported: string[] } {
  const locations: GwiResults['locations'] = {};
  const unsupported = new Set<string>();
  for (const raw of iso2s) {
    if (!raw) continue;
    const iso2 = raw.toLowerCase();
    const country = gwiCountry(iso2);
    if (country) locations[country] = gwiLocation(country)!;
    else unsupported.add(iso2);
  }
  return { locations, unsupported: [...unsupported].sort() };
}

/** One call: every audience's size in every country (question s2 = country of residence). */
export function sizeQuery(audiences: GwiAudience[], codes: string[], waves: string[]) {
  return { question: 's2', datapoints: codes, waves, audiences: audiences.map(inline) };
}

export function parseSizes(res: StatsResponse, codeToIso: Map<string, string>): GwiResults['sizes'] {
  const out: GwiResults['sizes'] = {};
  for (const r of res.data) {
    const iso2 = codeToIso.get(r.datapoint);
    if (!iso2 || !r.audience) continue;
    const m = r.metrics;
    // Sample 0 means the audience's questions weren't asked there in these waves.
    if (!m.positive_sample) continue;
    const size: GwiSize = {
      size: Math.round(m.positive_size),
      sample: m.positive_sample,
      universe: Math.round(m.datapoint_size),
      share: m.datapoint_percentage,
    };
    (out[r.audience] ??= {})[iso2] = size;
  }
  return out;
}

/** One call per panel: the audience's answers to one question, split by country. */
export function panelQuery(panel: GwiPanel, audience: GwiAudience, codes: string[], waves: string[]) {
  return {
    question: panel.question,
    datapoints: panel.datapoints.map((d) => d.code),
    ...(panel.suffix && { suffixes: [panel.suffix] }),
    waves,
    locations: codes,
    splitter: 's2',
    segments: codes,
    audiences: [inline(audience)],
  };
}

export function parsePanel(res: StatsResponse, panel: GwiPanel, codeToIso: Map<string, string>): Record<string, Record<string, GwiCell>> {
  const wanted = new Set(panel.datapoints.map((d) => d.code));
  const out: Record<string, Record<string, GwiCell>> = {};
  for (const r of res.data) {
    const iso2 = r.segment ? codeToIso.get(r.segment) : undefined;
    if (!iso2 || !wanted.has(r.datapoint)) continue;
    if (panel.suffix && r.suffix != null && String(r.suffix) !== panel.suffix) continue;
    const m = r.metrics;
    if (!m.audience_sample) continue; // not asked in this country
    (out[iso2] ??= {})[r.datapoint] = { pct: m.audience_percentage, index: m.audience_index, sample: m.audience_sample };
  }
  return out;
}

/**
 * Fetches everything a decoder's GWI config needs: 1 call for sizes plus 1
 * per panel. A failing panel is recorded in `errors` and the rest still land;
 * a failing size call throws, since the dashboard leads with it.
 */
export async function fetchGwiResults(
  gwi: GwiConfig,
  marketIso2s: Array<string | null>,
  post: StatsPost,
  now = () => new Date()
): Promise<GwiResults> {
  const { locations, unsupported } = decoderLocations([...marketIso2s, ...(gwi.reference ?? [])]);
  const codes = Object.values(locations).map((l) => l.code);
  if (!codes.length) throw new Error('None of the markets is a country GWI surveys.');
  if (!gwi.audiences.length) throw new Error('Define at least one audience.');
  const codeToIso = new Map(Object.entries(locations).map(([iso2, l]) => [l.code, iso2]));
  const byKey = new Map(gwi.audiences.map((a) => [a.key, a]));

  let calls = 0;
  const counted: StatsPost = async (body) => {
    const r = await post(body);
    calls++;
    return r;
  };

  const sizes = parseSizes(await counted(sizeQuery(gwi.audiences, codes, gwi.waves)), codeToIso);
  const panels: GwiResults['panels'] = {};
  const errors: Record<string, string> = {};
  for (const panel of gwi.panels) {
    const audience = byKey.get(panel.audience);
    if (!audience) {
      errors[panel.key] = `unknown audience "${panel.audience}"`;
      continue;
    }
    try {
      panels[panel.key] = parsePanel(await counted(panelQuery(panel, audience, codes, gwi.waves)), panel, codeToIso);
    } catch (e) {
      errors[panel.key] = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    fetchedAt: now().toISOString(),
    calls,
    waves: gwi.waves,
    locations,
    unsupported,
    sizes,
    panels,
    ...(Object.keys(errors).length && { errors }),
  };
}

/** The latest `n` quarterly waves, newest last, e.g. ["q4_2025", …, "q3_2026"]. */
export function latestQuarters(latest: string, n = 4): string[] {
  const m = /^q([1-4])_(\d{4})$/.exec(latest);
  if (!m) throw new Error(`not a quarterly wave: ${latest}`);
  let q = Number(m[1]);
  let y = Number(m[2]);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`q${q}_${y}`);
    if (--q === 0) {
      q = 4;
      y--;
    }
  }
  return out;
}
