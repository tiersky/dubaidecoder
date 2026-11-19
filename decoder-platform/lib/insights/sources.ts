/**
 * Server-side fetchers for country context. Every source is free and needs
 * no key. Responses go through Next's data cache for a day, so a dashboard
 * visit normally makes no outbound call, and a failed source only drops its
 * own facts.
 */
import { whereAlpha2 } from 'iso-3166-1';
import type { CountryData, CountryDataResponse, FactKey, FactValue, SeriesPoint } from './facts';

const DAY = 60 * 60 * 24;
const TIMEOUT_MS = 8000;

export const iso3Of = (iso2: string) => whereAlpha2(iso2.toUpperCase())?.alpha3 ?? null;

async function get(url: string, accept?: string, opts: { large?: boolean } = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'country-decoder/1.0', ...(accept && { Accept: accept }) },
    // Responses over 2 MB can't enter Next's data cache; callers cache those in memory.
    ...(opts.large ? { cache: 'no-store' as const } : { next: { revalidate: DAY } }),
    signal: AbortSignal.timeout(opts.large ? TIMEOUT_MS * 4 : TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.text();
}

/** Minimal CSV line split that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ---------- IMF World Economic Outlook (SDMX 3.0, CSV) ----------

const IMF_INDICATORS = { NGDP_RPCH: 'gdpGrowth', PCPIPCH: 'inflation', PPPPC: 'gdpPppPerHead' } as const;
type ImfIndicator = keyof typeof IMF_INDICATORS;

/** Parses WEO CSV into iso3 -> indicator -> year -> value. */
export function parseImfCsv(csv: string): Map<string, Map<ImfIndicator, Map<number, number>>> {
  const lines = csv.trim().split(/\r?\n/);
  const head = splitCsvLine(lines[0] ?? '');
  const iC = head.indexOf('COUNTRY');
  const iI = head.indexOf('INDICATOR');
  const iT = head.indexOf('TIME_PERIOD');
  const iV = head.indexOf('OBS_VALUE');
  const out = new Map<string, Map<ImfIndicator, Map<number, number>>>();
  if ([iC, iI, iT, iV].includes(-1)) return out;
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const indicator = cells[iI] as ImfIndicator;
    if (!(indicator in IMF_INDICATORS)) continue;
    const year = Number(cells[iT]);
    const value = Number(cells[iV]);
    if (!Number.isFinite(year) || cells[iV] === '' || !Number.isFinite(value)) continue;
    const byInd = out.get(cells[iC]) ?? new Map();
    const byYear = byInd.get(indicator) ?? new Map<number, number>();
    byYear.set(year, value);
    byInd.set(indicator, byYear);
    out.set(cells[iC], byInd);
  }
  return out;
}

/** 'all' fetches every country (~3 MB, uncacheable by Next; see loadAllCountryData). */
async function imf(iso3s: string[] | 'all') {
  const url =
    'https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/~/' +
    `${iso3s === 'all' ? '*' : iso3s.join('+')}.${Object.keys(IMF_INDICATORS).join('+')}.A`;
  return parseImfCsv(await get(url, 'application/vnd.sdmx.data+csv;version=2.0.0', { large: iso3s === 'all' }));
}

// ---------- World Bank Indicators (JSON) ----------

/** 'spendTotal' is divided by population below: the per-head series
 * (NE.CON.PRVT.PC.KD) stalls on the World Bank side. */
const WB_INDICATORS: Array<[string, FactKey | 'spendTotal']> = [
  ['NY.GDP.PCAP.CD', 'gdpPerHead'],
  ['NE.CON.PRVT.CD', 'spendTotal'],
  ['SP.POP.TOTL', 'population'],
  ['IT.NET.USER.ZS', 'internet'],
  ['SP.URB.TOTL.IN.ZS', 'urban'],
  ['SP.POP.65UP.TO.ZS', 'over65'],
];

type WbRow = { countryiso3code: string; date: string; value: number | null };

/** Latest non-empty value per iso3 from a World Bank `mrnev=1` response. */
export function parseWorldBank(json: unknown): Map<string, FactValue> {
  const out = new Map<string, FactValue>();
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as WbRow[]) : [];
  for (const r of rows) {
    if (r.value === null || !Number.isFinite(r.value)) continue;
    const year = Number(r.date);
    const prev = out.get(r.countryiso3code);
    if (!prev || year > prev.year) out.set(r.countryiso3code, { value: r.value, year });
  }
  return out;
}

/** The all-countries query is CDN-cached and fast; country lists can hang. */
async function worldBank(indicator: string) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&mrnev=1&per_page=400`;
  return parseWorldBank(JSON.parse(await get(url)));
}

/** One indicator at a time: the API stalls on bursts of parallel requests. */
async function worldBankAll(settle: <T>(source: string, p: Promise<T>) => Promise<T | null>) {
  const out: Array<readonly [FactKey | 'spendTotal', Map<string, FactValue> | null]> = [];
  for (const [code, key] of WB_INDICATORS) out.push([key, await settle('World Bank', worldBank(code))] as const);
  return out;
}

// ---------- Our World in Data grapher CSV ----------

/** Latest value per iso3 from an OWID grapher CSV (Entity,Code,Year,value,...). */
export function parseOwidCsv(csv: string): Map<string, FactValue> {
  const out = new Map<string, FactValue>();
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [, code, year, value] = splitCsvLine(line);
    const y = Number(year);
    const v = Number(value);
    if (!code || value === '' || !Number.isFinite(v) || !Number.isFinite(y)) continue;
    const prev = out.get(code);
    if (!prev || y > prev.year) out.set(code, { value: v, year: y });
  }
  return out;
}

async function owid(slug: string) {
  return parseOwidCsv(await get(`https://ourworldindata.org/grapher/${slug}.csv?csvType=filtered`));
}

// ---------- assembly ----------

const OUTLOOK_FROM = -3;
const OUTLOOK_TO = 3;

function outlook(byYear: Map<number, number> | undefined, thisYear: number): SeriesPoint[] {
  if (!byYear) return [];
  const pts: SeriesPoint[] = [];
  for (let y = thisYear + OUTLOOK_FROM; y <= thisYear + OUTLOOK_TO; y++) {
    const v = byYear.get(y);
    if (v !== undefined) pts.push({ year: y, value: v, projected: y >= thisYear });
  }
  return pts;
}

/** Fetches every source in parallel for the given markets. Never throws. */
export async function loadCountryData(iso2s: string[], thisYear = new Date().getUTCFullYear()): Promise<CountryDataResponse> {
  const markets = [...new Set(iso2s.map((c) => c.toLowerCase()))]
    .map((iso2) => ({ iso2, iso3: iso3Of(iso2) }))
    .filter((m): m is { iso2: string; iso3: string } => Boolean(m.iso3));
  return assemble(markets, markets.length ? markets.map((m) => m.iso3) : null, thisYear);
}

/**
 * Every country at once, for the recommender universe. IMF is fetched with a
 * wildcard (one ~3 MB response); the result should be cached by the caller.
 */
export async function loadAllCountryData(iso2s: string[], thisYear = new Date().getUTCFullYear()): Promise<CountryDataResponse> {
  const markets = [...new Set(iso2s.map((c) => c.toLowerCase()))]
    .map((iso2) => ({ iso2, iso3: iso3Of(iso2) }))
    .filter((m): m is { iso2: string; iso3: string } => Boolean(m.iso3));
  return assemble(markets, 'all', thisYear);
}

async function assemble(
  markets: Array<{ iso2: string; iso3: string }>,
  imfQuery: string[] | 'all' | null,
  thisYear: number
): Promise<CountryDataResponse> {
  const unavailable = new Set<string>();

  const settle = async <T>(source: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      unavailable.add(source);
      console.warn(`[country-data] ${source} failed:`, err instanceof Error ? err.message : err);
      return null;
    }
  };

  const [imfData, wb, life, hdi] = await Promise.all([
    imfQuery ? settle('IMF', imf(imfQuery)) : null,
    worldBankAll(settle),
    settle('Our World in Data', owid('happiness-cantril-ladder')),
    settle('Our World in Data', owid('human-development-index')),
  ]);

  const countries: Record<string, CountryData> = {};
  for (const { iso2, iso3 } of markets) {
    const facts: CountryData['facts'] = {};
    const imfRow = imfData?.get(iso3);
    for (const [code, key] of Object.entries(IMF_INDICATORS) as Array<[ImfIndicator, FactKey]>) {
      const v = imfRow?.get(code)?.get(thisYear);
      if (v !== undefined) facts[key] = { value: v, year: thisYear, projected: true };
    }
    let spendTotal: FactValue | undefined;
    for (const [key, map] of wb) {
      const v = map?.get(iso3);
      if (!v) continue;
      if (key === 'spendTotal') spendTotal = v;
      else facts[key] = v;
    }
    if (spendTotal && facts.population && facts.population.value > 0) {
      facts.spendPerHead = { value: spendTotal.value / facts.population.value, year: spendTotal.year };
    }
    const l = life?.get(iso3);
    if (l) facts.lifeSatisfaction = l;
    const h = hdi?.get(iso3);
    if (h) facts.hdi = h;

    countries[iso2] = {
      iso2,
      facts,
      outlook: {
        gdpGrowth: outlook(imfRow?.get('NGDP_RPCH'), thisYear),
        inflation: outlook(imfRow?.get('PCPIPCH'), thisYear),
      },
    };
  }
  return { countries, unavailable: [...unavailable] };
}
