import { authorize, type Access } from './access';

/** Where to send a just-authenticated user. `next` must be a same-site
 * path the user is actually allowed to visit; anything else falls back
 * to the role default. Rejects paths containing backslashes or control
 * characters (U+0000..U+001F) to defend against browser URL normalization
 * attacks. */
export function postLoginPath(access: Access, next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    // Reject paths with backslash or control chars (browser normalization attack)
    if (!/[\\\x00-\x1f]/.test(next)) {
      if (authorize(next, access) === 'allow') return next;
    }
  }
  if (access.role === 'admin') return '/admin';
  if (access.role === 'viewer' && access.slugs.length === 1) return '/' + access.slugs[0];
  return '/select';
}
