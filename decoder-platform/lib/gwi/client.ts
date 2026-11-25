/**
 * GWI Platform API client. Server-only: GWI_PLATFORM_API_KEY never reaches
 * the browser. Every successful request counts against the contract
 * allowance (4xx/5xx don't), so callers fetch once and store the result.
 */
import type { StatsPost, StatsResponse } from './query';

const BASE = 'https://api.globalwebindex.com';
const apiKey = () => process.env.GWI_PLATFORM_API_KEY?.trim() || '';
export const gwiConfigured = () => Boolean(apiKey());

export class GwiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One request with up to `retries` retries on 429 and 5xx, honouring
 * Retry-After (capped at 30 s so a request can't outlive a serverless route).
 */
export async function gwiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  opts: { retries?: number; fetchImpl?: typeof fetch; sleep?: Sleep } = {}
): Promise<T> {
  const key = apiKey();
  if (!key) throw new GwiError('GWI is not configured (GWI_PLATFORM_API_KEY).', 0);
  const { retries = 3, fetchImpl = fetch, sleep = realSleep } = opts;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const after = Number(res.headers.get('Retry-After'));
      await sleep(Math.min(30_000, Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt));
      continue;
    }
    let detail = '';
    try {
      const j = (await res.json()) as { message?: string; error?: string; detail?: string };
      detail = j.message ?? j.detail ?? j.error ?? '';
    } catch {
      /* no JSON body */
    }
    throw new GwiError(`GWI ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status);
  }
}

export const gwiStats: StatsPost = (body) => gwiRequest<StatsResponse>('POST', '/v2/query/stats', body);
