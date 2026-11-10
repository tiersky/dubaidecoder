import { redirect } from 'next/navigation';
import Image from 'next/image';
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
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="glass materialize w-full max-w-[440px] rounded-[28px] px-6 pb-6 pt-8 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <Image src="/Country Decoder Logo.png" alt="" width={125} height={48} className="h-12 w-auto" priority />
          <h1 className="display mt-4 text-[24px] font-semibold text-ink">Country Decoder</h1>
          <p className="mt-1 text-[14px] text-ink-2">{isAdmin ? 'All published projects' : 'Your projects'}</p>
        </div>

        <ul className="well mt-7 divide-y divide-black/[0.06] overflow-hidden p-1">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-[14px] text-ink-2">No projects available yet.</li>
          )}
          {rows.map(({ slug, name }, i) =>
            name ? (
              <li key={slug} className="materialize" style={{ ['--i' as string]: i + 2 }}>
                <Link
                  href={`/${slug}`}
                  className="press flex items-center justify-between gap-3 rounded-[11px] px-4 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-white/80"
                >
                  <span className="truncate">{name}</span>
                  <svg className="h-4 w-4 flex-shrink-0 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ) : (
              <li key={slug} className="px-4 py-3 text-[14px] text-ink-2">
                {slug} — not yet published
              </li>
            )
          )}
        </ul>

        <form action="/auth/signout" method="post" className="mt-5 flex justify-center">
          <button
            type="submit"
            className="press rounded-full px-4 py-2 text-[14px] font-medium text-accent hover:bg-accent/[0.08]"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
