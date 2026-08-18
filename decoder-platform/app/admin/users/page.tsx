import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { listUsers } from '@/lib/users/admin';
import { listVersions } from '@/lib/versions/store';
import { UsersClient } from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  // Defense in depth: the proxy already gates /admin, but this page checks again.
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const [users, versions] = await Promise.all([listUsers(), listVersions()]);
  const publishedSlugs = versions.filter((v) => v.status === 'published').map((v) => v.slug);

  return <UsersClient users={users} publishedSlugs={publishedSlugs} />;
}
