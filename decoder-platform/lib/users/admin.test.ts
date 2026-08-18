import { describe, it, expect, vi, beforeEach } from 'vitest';

const adminApi = {
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getUserById: vi.fn(),
};
vi.mock('../supabase/admin', () => ({
  serviceClient: () => ({ auth: { admin: adminApi } }),
}));

import { listUsers, createViewer, setSlugs, setActive, generatePassword } from './admin';

const rawUser = (over: object = {}) => ({
  id: 'u1', email: 'v@x.test', last_sign_in_at: '2026-08-01T00:00:00Z',
  app_metadata: { role: 'viewer', allowed_slugs: ['egypt'] }, banned_until: null, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('generatePassword', () => {
  it('is long and random', () => {
    const p = generatePassword();
    expect(p.length).toBeGreaterThanOrEqual(16);
    expect(generatePassword()).not.toBe(p);
  });
});

describe('listUsers', () => {
  it('maps role, slugs, and banned state', async () => {
    adminApi.listUsers.mockResolvedValue({
      data: { users: [rawUser(), rawUser({ id: 'u2', banned_until: '2099-01-01T00:00:00Z', app_metadata: { role: 'admin' } })] },
      error: null,
    });
    const users = await listUsers();
    expect(users[0]).toMatchObject({ id: 'u1', role: 'viewer', slugs: ['egypt'], banned: false });
    expect(users[1]).toMatchObject({ id: 'u2', role: 'admin', slugs: [], banned: true });
  });
});

describe('createViewer', () => {
  it('creates with viewer role and slugs in app_metadata, email confirmed', async () => {
    adminApi.createUser.mockResolvedValue({ data: { user: rawUser() }, error: null });
    await createViewer({ email: 'v@x.test', password: 'pw-123456789012345', slugs: ['egypt'] });
    expect(adminApi.createUser).toHaveBeenCalledWith({
      email: 'v@x.test',
      password: 'pw-123456789012345',
      email_confirm: true,
      app_metadata: { role: 'viewer', allowed_slugs: ['egypt'] },
    });
  });
  it('rejects malformed slugs', async () => {
    await expect(createViewer({ email: 'v@x.test', password: 'x'.repeat(16), slugs: ['Bad Slug!'] }))
      .rejects.toThrow(/slug/i);
  });
});

describe('setSlugs', () => {
  it('preserves the existing role in app_metadata', async () => {
    adminApi.getUserById.mockResolvedValue({ data: { user: rawUser() }, error: null });
    await setSlugs('u1', ['egypt', 'alula']);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', {
      app_metadata: { role: 'viewer', allowed_slugs: ['egypt', 'alula'] },
    });
  });
});

describe('setActive', () => {
  it('bans with a long duration and unbans with none', async () => {
    await setActive('u1', false);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' });
    await setActive('u1', true);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: 'none' });
  });
});
