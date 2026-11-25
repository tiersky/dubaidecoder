import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validateConfig } from '../lib/config/validate';
import { publishVersion } from '../lib/versions/store';
import type { MarketRow, SummerTraffic, VersionConfig } from '../lib/config/types';
import type { MetricDef } from '../lib/model/score';
import { gwiStats } from '../lib/gwi/client';
import { fetchGwiResults } from '../lib/gwi/query';
import type { GwiResults } from '../lib/gwi/types';
import { OMNIYAT_GWI } from './omniyat-gwi';

// Omniyat summer decoder: city and resort markets scored on where
// ultra-high-net-worth audiences spend June–September. Built from the
// OpenSky / EUROCONTROL / EMODnet study in tools/summer-jets (run cities.py
// first). Re-run this script after the data refreshes; each run publishes a
// new revision of the same slug.
//
// GWI numbers are cached in tools/summer-jets/out/gwi.json, so re-seeding
// after the flight data refreshes costs no GWI calls. --refresh-gwi fetches
// them again (1 call for audience sizes + 1 per panel).
//
// Usage (from decoder-platform/): npx tsx --env-file=.env.local scripts/seed-omniyat.ts [--dry-run [config.json]] [--refresh-gwi]

const SLUG = 'omniyat-decoder';
const BUDGET = 1_000_000; // placeholder until the pitch budget is known
/** Winter destination kept as a contrast; off by default. */
const OFF_BY_DEFAULT = new Set(['Miami']);

const METRICS: MetricDef[] = [
  {
    key: 'jets_summer',
    label: 'Summer private jets',
    weight: 35,
    direction: 'higher',
    unit: 'per 2 days',
    source: 'OpenSky Network arrivals, corrected with EUROCONTROL airport traffic (summer 2025)',
    description: 'Private-jet arrivals (business jets and VIP airliners) per two days, June–September average.',
  },
  {
    key: 'jets_uplift',
    label: 'Private-jet summer uplift',
    weight: 15,
    direction: 'higher',
    unit: '×',
    source: 'OpenSky Network (summer 2025 vs Nov 2024, Feb and Apr 2025)',
    description: 'Summer private-jet arrivals divided by off-season arrivals: how much of a summer place it is.',
  },
  {
    key: 'yacht_summer',
    label: 'Summer yacht activity',
    weight: 20,
    direction: 'higher',
    unit: 'hours/month',
    source: 'EMODnet Human Activities vessel density, pleasure craft (2023)',
    description: 'Hours AIS-tracked pleasure craft spent in the waters around the city per month, June–September.',
  },
  {
    key: 'yacht_uplift',
    label: 'Yacht summer uplift',
    weight: 20,
    direction: 'higher',
    unit: '×',
    source: 'EMODnet Human Activities vessel density, pleasure craft (2023)',
    description: 'Summer yacht activity divided by the rest of the year: anchorages that fill up for summer score high.',
  },
  {
    key: 'gcc_share',
    label: 'GCC-registered jets',
    weight: 10,
    direction: 'higher',
    unit: '%',
    source: 'OpenSky Network aircraft registrations (summer 2025)',
    description: 'Share of summer private arrivals on aircraft registered in the GCC. A floor: many Gulf jets are registered offshore.',
  },
];

interface CityRecord {
  name: string;
  country: string;
  iso2: string;
  lat: number;
  lng: number;
  values: Record<string, number | null>;
  summer: SummerTraffic;
}

async function main() {
  const file = path.resolve(process.cwd(), '../tools/summer-jets/out/cities.json');
  const cities = JSON.parse(readFileSync(file, 'utf-8')) as CityRecord[];

  const markets: MarketRow[] = cities.map((c) => ({
    name: c.name,
    iso2: c.iso2,
    lat: c.lat,
    lng: c.lng,
    enabled: !OFF_BY_DEFAULT.has(c.name),
    values: Object.fromEntries(METRICS.map((m) => [m.key, c.values[m.key] ?? null])),
    place: { kind: 'city', country: c.country },
    summer: c.summer,
  }));

  const gwiFile = path.resolve(process.cwd(), '../tools/summer-jets/out/gwi.json');
  let results: GwiResults;
  if (process.argv.includes('--refresh-gwi') || !existsSync(gwiFile)) {
    results = await fetchGwiResults(OMNIYAT_GWI, markets.map((m) => m.iso2), gwiStats);
    writeFileSync(gwiFile, JSON.stringify(results, null, 1));
    console.log(`GWI: ${results.calls} calls, ${Object.keys(results.locations).length} countries${results.errors ? `, errors ${JSON.stringify(results.errors)}` : ''}`);
  } else {
    results = JSON.parse(readFileSync(gwiFile, 'utf-8')) as GwiResults;
    console.log(`GWI: cached from ${results.fetchedAt}`);
  }

  const config: VersionConfig = {
    name: 'Omniyat Decoder',
    slug: SLUG,
    currency: 'USD',
    defaultBudget: BUDGET,
    model: 'workbook',
    metrics: METRICS,
    markets,
    context: {
      industry: 'Real estate development',
      brief:
        'OMNIYAT wants to be present where UHNW audiences from the GCC and its international buyer markets spend the summer (June–September): ' +
        'the cities and resort destinations with the highest concentration of UHNW visitors, their peak weeks, the best premium environments ' +
        '(private terminals, lounges, luxury hotels, marinas, events, premium media) and the audience size and cost-efficiency behind each.',
      objective: 'Summer presence among UHNW buyers of Dubai luxury real estate',
      destination: { iso2: 'ae', name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    },
    gwi: { ...OMNIYAT_GWI, results },
  };

  const v = validateConfig(config);
  if (!v.ok) throw new Error(`invalid config: ${v.errors.join('; ')}`);
  const kept = v.config.markets.filter((m) => m.summer).length;
  console.log(`${v.config.markets.length} markets, ${kept} with summer data`);
  if (process.argv.includes('--dry-run')) {
    const out = process.argv[process.argv.indexOf('--dry-run') + 1];
    if (out && !out.startsWith('--')) writeFileSync(out, JSON.stringify(v.config));
    return;
  }

  const { id, revision } = await publishVersion(v.config);
  console.log(`published slug=${SLUG} id=${id} revision=${revision}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
