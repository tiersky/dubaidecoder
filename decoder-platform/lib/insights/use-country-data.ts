'use client';

import { useEffect, useState } from 'react';
import type { CountryDataResponse } from './facts';

/** One request per slug per page session, shared by every component. */
const requests = new Map<string, Promise<CountryDataResponse | null>>();

function load(slug: string): Promise<CountryDataResponse | null> {
  let p = requests.get(slug);
  if (!p) {
    p = fetch(`/${encodeURIComponent(slug)}/country-data`)
      .then((r) => (r.ok ? (r.json() as Promise<CountryDataResponse>) : null))
      .catch(() => null);
    p.then((v) => v === null && requests.delete(slug));
    requests.set(slug, p);
  }
  return p;
}

export type CountryDataState =
  | { status: 'loading' }
  | { status: 'ready'; data: CountryDataResponse }
  | { status: 'unavailable' };

/** An empty slug turns the hook off (e.g. draft previews). */
export function useCountryData(slug: string): CountryDataState {
  const [state, setState] = useState<CountryDataState>(() => (slug ? { status: 'loading' } : { status: 'unavailable' }));
  useEffect(() => {
    if (!slug) return;
    let live = true;
    load(slug).then((data) => {
      if (live) setState(data ? { status: 'ready', data } : { status: 'unavailable' });
    });
    return () => {
      live = false;
    };
  }, [slug]);
  return state;
}
