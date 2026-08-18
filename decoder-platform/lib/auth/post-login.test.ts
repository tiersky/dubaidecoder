import { describe, it, expect } from 'vitest';
import { postLoginPath } from './post-login';

const admin = { role: 'admin' as const, slugs: [] };
const viewer = (slugs: string[]) => ({ role: 'viewer' as const, slugs });

describe('postLoginPath', () => {
  it('honors a safe next path the user may access', () => {
    expect(postLoginPath(admin, '/admin/upload')).toBe('/admin/upload');
    expect(postLoginPath(viewer(['egypt']), '/egypt')).toBe('/egypt');
  });
  it('ignores next the user may not access', () => {
    expect(postLoginPath(viewer(['egypt']), '/admin')).toBe('/egypt');
  });
  it('rejects absolute/protocol-relative next (open redirect)', () => {
    expect(postLoginPath(admin, 'https://evil.example')).toBe('/admin');
    expect(postLoginPath(admin, '//evil.example')).toBe('/admin');
  });
  it('falls back by role when next is null', () => {
    expect(postLoginPath(admin, null)).toBe('/admin');
    expect(postLoginPath(viewer(['egypt']), null)).toBe('/egypt');
    expect(postLoginPath(viewer(['egypt', 'alula']), null)).toBe('/select');
  });
});
