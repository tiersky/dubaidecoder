/**
 * The recommender's country universe: every country with a name, a map
 * position, its public facts and its Hofstede profile. Server-only. Loaded
 * once and kept in memory for a day (the IMF all-countries response is ~3 MB,
 * too large for Next's data cache).
 */
import { feature } from 'topojson-client';
import { geoCentroid } from 'd3-geo';
import { whereNumeric } from 'iso-3166-1';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { countries as curated } from '@/lib/geo/countries';
import { cultureProfile, type Scores } from '@/lib/insights/hofstede';
import { loadAllCountryData, iso3Of } from '@/lib/insights/sources';
import type { FactKey, FactValue } from '@/lib/insights/facts';

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UniverseCountry {
  iso2: string;
  name: string;
  lat: number;
  lng: number;
  facts: Partial<Record<FactKey, FactValue>>;
  culture: Scores | null;
  /** True when the culture scores are the "Arab countries" regional estimate. */
  cultureRegional: boolean;
}

export interface Universe {
  countries: UniverseCountry[];
  unavailable: string[];
  loadedAt: string;
}

/** Display names where the map file's name is formal or abbreviated. */
const NAME_FIXES: Record<string, string> = {
  us: 'USA',
  gb: 'UK',
  ae: 'UAE',
  cd: 'DR Congo',
  cf: 'Central African Republic',
  ba: 'Bosnia and Herzegovina',
  do: 'Dominican Republic',
  gq: 'Equatorial Guinea',
  ss: 'South Sudan',
  kr: 'South Korea',
  kp: 'North Korea',
  la: 'Laos',
  ci: "Côte d'Ivoire",
  cz: 'Czech Republic',
  mk: 'North Macedonia',
  sz: 'Eswatini',
};

interface MapCountry {
  iso2: string;
  name: string;
  lat: number;
  lng: number;
}

/** Countries from the world map geometry; curated coordinates win where they exist. */
export function countriesFromTopology(topology: Topology): MapCountry[] {
  const curatedBy = new Map(curated.map((c) => [c.iso2.toLowerCase(), c]));
  const fc = feature(topology, topology.objects.countries as GeometryCollection);
  const out = new Map<string, MapCountry>();
  for (const f of fc.features) {
    const id = String(f.id ?? '').padStart(3, '0');
    const iso2 = whereNumeric(id)?.alpha2?.toLowerCase();
    if (!iso2 || out.has(iso2)) continue;
    const known = curatedBy.get(iso2);
    const [lng, lat] = known ? [known.lng, known.lat] : geoCentroid(f);
    const mapName = String((f.properties as { name?: string } | null)?.name ?? iso2.toUpperCase());
    out.set(iso2, { iso2, name: NAME_FIXES[iso2] ?? known?.name ?? mapName, lat, lng });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function loadTopology(): Promise<Topology> {
  const res = await fetch(WORLD_URL, { next: { revalidate: 60 * 60 * 24 * 7 }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${res.status} from world-atlas`);
  return (await res.json()) as Topology;
}

let cached: { at: number; value: Promise<Universe> } | null = null;

/** Every country with its facts. Cached in memory for a day; failures aren't cached. */
export function getUniverse(): Promise<Universe> {
  if (cached && Date.now() - cached.at < DAY_MS) return cached.value;
  const value = build().catch((err) => {
    cached = null;
    throw err;
  });
  cached = { at: Date.now(), value };
  return value;
}

async function build(): Promise<Universe> {
  const map = countriesFromTopology(await loadTopology()).filter((c) => iso3Of(c.iso2));
  const data = await loadAllCountryData(map.map((c) => c.iso2));
  const countries: UniverseCountry[] = map
    .map((c) => {
      const profile = cultureProfile(c.iso2);
      return {
        ...c,
        facts: data.countries[c.iso2]?.facts ?? {},
        culture: profile?.scores ?? null,
        cultureRegional: Boolean(profile && profile.regional.length > 0),
      };
    })
    // Territories with no economic or population data can't be assessed.
    .filter((c) => c.facts.population || c.facts.gdpPerHead || c.facts.gdpPppPerHead);
  return { countries, unavailable: data.unavailable, loadedAt: new Date().toISOString() };
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough non-stop flight time from great-circle distance: cruise ~800 km/h plus ~40 min. */
export const flightHours = (km: number) => km / 800 + 0.7;
