import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAccess } from '@/lib/auth/require';
import { serviceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface VersionEntry {
  slug: string;
  name: string;
}

async function loadAdminVersions(): Promise<VersionEntry[]> {
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('slug, name')
    .eq('status', 'published')
    .order('name', { ascending: true });
  if (error) throw new Error(`select page: failed to load versions: ${error.message}`);
  return data ?? [];
}

async function loadViewerVersions(slugs: string[]): Promise<VersionEntry[]> {
  if (slugs.length === 0) return [];
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('slug, name')
    .eq('status', 'published')
    .in('slug', slugs);
  if (error) throw new Error(`select page: failed to load versions: ${error.message}`);
  return data ?? [];
}

export default async function SelectPage() {
  const access = await getAccess();
  if (!access) redirect('/login');

  const isAdmin = access.role === 'admin';
  const versions = isAdmin ? await loadAdminVersions() : await loadViewerVersions(access.slugs);
  const versionsBySlug = new Map(versions.map((v) => [v.slug, v]));

  // For viewers, preserve their slug order and surface slugs that no longer
  // resolve to a published version instead of silently dropping them.
  const rows: { slug: string; name: string | null }[] = isAdmin
    ? versions.map((v) => ({ slug: v.slug, name: v.name }))
    : access.slugs.map((slug) => ({ slug, name: versionsBySlug.get(slug)?.name ?? null }));

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Country Decoder</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          {isAdmin ? 'All published projects' : 'Your projects'}
        </p>

        <ul className="mt-8 space-y-2">
          {rows.length === 0 && (
            <li className="text-sm text-slate-500 text-center">No projects available yet.</li>
          )}
          {rows.map(({ slug, name }) =>
            name ? (
              <li key={slug}>
                <Link
                  href={`/${slug}`}
                  className="glass-input glass-card-hover block rounded-lg px-4 py-3 text-sm font-medium text-slate-800"
                >
                  {name}
                </Link>
              </li>
            ) : (
              <li
                key={slug}
                className="glass-input block rounded-lg px-4 py-3 text-sm text-slate-400"
              >
                {slug} — not yet published
              </li>
            )
          )}
        </ul>

        <form action="/auth/signout" method="post" className="mt-8">
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
