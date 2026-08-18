import { authorize, type Access } from './access';

/** Where to send a just-authenticated user. `next` must be a same-site
 * path the user is actually allowed to visit; anything else falls back
 * to the role default. */
export function postLoginPath(access: Access, next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    if (authorize(next, access) === 'allow') return next;
  }
  if (access.role === 'admin') return '/admin';
  if (access.role === 'viewer' && access.slugs.length === 1) return '/' + access.slugs[0];
  return '/select';
}
