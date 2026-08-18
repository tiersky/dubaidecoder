// Server-only (service role / Auth admin API)
import { randomBytes } from 'node:crypto';
import { serviceClient } from '../supabase/admin';

const SLUG_RE = /^[a-z0-9-]+$/;

export interface PlatformUser {
  id: string;
  email: string | null;
  role: 'admin' | 'viewer' | null;
  slugs: string[];
  banned: boolean;
  lastSignInAt: string | null;
}

export function generatePassword(): string {
  return randomBytes(12).toString('base64url'); // 16 chars, no padding
}

function toPlatformUser(u: {
  id: string; email?: string | null; last_sign_in_at?: string | null;
  app_metadata?: { role?: unknown; allowed_slugs?: unknown };
  banned_until?: string | null;
}): PlatformUser {
  const role =
    u.app_metadata?.role === 'admin' || u.app_metadata?.role === 'viewer'
      ? u.app_metadata.role : null;
  const slugs = Array.isArray(u.app_metadata?.allowed_slugs)
    ? u.app_metadata!.allowed_slugs.filter((s): s is string => typeof s === 'string')
    : [];
  const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
  return {
    id: u.id, email: u.email ?? null, role,
    slugs: role === 'viewer' ? slugs : [],
    banned, lastSignInAt: u.last_sign_in_at ?? null,
  };
}

function assertSlugs(slugs: string[]) {
  for (const s of slugs) if (!SLUG_RE.test(s)) throw new Error(`invalid slug: "${s}"`);
}

export async function listUsers(): Promise<PlatformUser[]> {
  const { data, error } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`list users failed: ${error.message}`);
  return data.users.map((u) => toPlatformUser(u as Parameters<typeof toPlatformUser>[0]));
}

export async function createViewer(input: { email: string; password: string; slugs: string[] }) {
  assertSlugs(input.slugs);
  const { data, error } = await serviceClient().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: 'viewer', allowed_slugs: input.slugs },
  });
  if (error || !data.user) throw new Error(`create failed: ${error?.message ?? 'no user'}`);
  return toPlatformUser(data.user as Parameters<typeof toPlatformUser>[0]);
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const { error } = await serviceClient().auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`password reset failed: ${error.message}`);
}

export async function setSlugs(userId: string, slugs: string[]): Promise<void> {
  assertSlugs(slugs);
  const db = serviceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(`user lookup failed: ${error?.message ?? 'not found'}`);
  const { error: upErr } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, allowed_slugs: slugs },
  });
  if (upErr) throw new Error(`slug update failed: ${upErr.message}`);
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  const { error } = await serviceClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h', // ~100 years
  });
  if (error) throw new Error(`${active ? 'unban' : 'ban'} failed: ${error.message}`);
}
