/** Server-side glue shared by the admin routes and actions. */
import { getAccess } from '@/lib/auth/require';
import { getUniverse, type UniverseCountry } from './universe';
import type { UniverseLookup } from '@/lib/builder/build';

export async function isAdmin(): Promise<boolean> {
  const access = await getAccess();
  return access?.role === 'admin';
}

export async function universeLookup(): Promise<{ lookup: UniverseLookup; byIso: Map<string, UniverseCountry> }> {
  const u = await getUniverse();
  const byIso = new Map(u.countries.map((c) => [c.iso2, c]));
  return { lookup: { get: (iso2) => byIso.get(iso2.toLowerCase()) }, byIso };
}
