export interface Access {
  role: 'admin' | 'viewer' | null;
  slugs: string[];
}

/** app_metadata is server-controlled (never user_metadata). Claims can be
 * stale until the JWT refreshes (≤1h) — slug changes apply on next refresh. */
export function parseAccess(claims: unknown): Access {
  const meta =
    claims && typeof claims === 'object'
      ? (claims as { app_metadata?: unknown }).app_metadata
      : undefined;
  if (!meta || typeof meta !== 'object') return { role: null, slugs: [] };
  const m = meta as { role?: unknown; allowed_slugs?: unknown };
  const role = m.role === 'admin' || m.role === 'viewer' ? m.role : null;
  const slugs =
    role !== null && Array.isArray(m.allowed_slugs)
      ? m.allowed_slugs.filter((s): s is string => typeof s === 'string')
      : [];
  return role === null ? { role: null, slugs: [] } : { role, slugs };
}

const PUBLIC_EXACT = new Set(['/']);
const PUBLIC_PREFIXES = ['/login', '/select', '/auth', '/api/keepalive'];

export type Decision = 'allow' | 'login' | 'forbidden';

export function authorize(pathname: string, access: Access | null): Decision {
  if (PUBLIC_EXACT.has(pathname)) return 'allow';
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')))
    return 'allow';
  if (!access || access.role === null) return 'login';
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return access.role === 'admin' ? 'allow' : 'forbidden';
  const slug = pathname.split('/')[1] ?? '';
  if (access.role === 'admin' || access.slugs.includes(slug)) return 'allow';
  return 'forbidden';
}
