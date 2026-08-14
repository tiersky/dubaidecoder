import { describe, it, expect } from 'vitest';
import { parseAccess, authorize } from './access';

describe('parseAccess', () => {
  it('reads role and slugs from app_metadata', () => {
    expect(
      parseAccess({ app_metadata: { role: 'viewer', allowed_slugs: ['qatar', 'egypt'] } })
    ).toEqual({ role: 'viewer', slugs: ['qatar', 'egypt'] });
  });
  it('tolerates malformed claims', () => {
    expect(parseAccess(null)).toEqual({ role: null, slugs: [] });
    expect(parseAccess({})).toEqual({ role: null, slugs: [] });
    expect(parseAccess({ app_metadata: { role: 'nonsense', allowed_slugs: 'x' } })).toEqual({
      role: null,
      slugs: [],
    });
  });
});

describe('authorize', () => {
  const admin = { role: 'admin' as const, slugs: [] };
  const viewer = { role: 'viewer' as const, slugs: ['egypt'] };

  it('public paths always allowed', () => {
    expect(authorize('/', null)).toBe('allow');
    expect(authorize('/login', null)).toBe('allow');
    expect(authorize('/api/keepalive', null)).toBe('allow');
    expect(authorize('/select', viewer)).toBe('allow');
  });
  it('signed-out users are sent to login', () => {
    expect(authorize('/egypt', null)).toBe('login');
    expect(authorize('/admin', null)).toBe('login');
  });
  it('admin area is admin-only', () => {
    expect(authorize('/admin', admin)).toBe('allow');
    expect(authorize('/admin/users', admin)).toBe('allow');
    expect(authorize('/admin', viewer)).toBe('forbidden');
  });
  it('slug pages respect allowed_slugs', () => {
    expect(authorize('/egypt', viewer)).toBe('allow');
    expect(authorize('/qatar', viewer)).toBe('forbidden');
    expect(authorize('/qatar', admin)).toBe('allow');
  });
});
