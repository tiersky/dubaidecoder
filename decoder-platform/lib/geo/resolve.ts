import { countries, aliases } from './countries';

export interface GeoEntry {
  iso2: string;
  lat: number;
  lng: number;
}

const byIso = new Map(countries.map((c) => [c.iso2, c]));
const byName = new Map(countries.map((c) => [normalize(c.name), c]));

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveCountry(name: string): GeoEntry | null {
  const n = normalize(name);
  if (!n) return null;
  const direct = byName.get(n);
  if (direct) return { iso2: direct.iso2, lat: direct.lat, lng: direct.lng };
  const alias = aliases[n];
  if (alias) {
    const c = byIso.get(alias);
    if (c) return { iso2: c.iso2, lat: c.lat, lng: c.lng };
  }
  return null;
}
