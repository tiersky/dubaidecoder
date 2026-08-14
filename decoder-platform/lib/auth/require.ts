import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/server';
import { parseAccess, authorize, type Access } from './access';

export async function getAccess(): Promise<Access | null> {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const access = parseAccess(data.claims);
  return access.role === null ? null : access;
}

/** Defense in depth behind the proxy — pages must not rely on the proxy alone. */
export async function requireSlugAccess(slug: string): Promise<Access> {
  const access = await getAccess();
  const decision = authorize(`/${slug}`, access);
  if (decision === 'allow' && access) return access;
  redirect(decision === 'login' ? '/login' : '/select');
}
