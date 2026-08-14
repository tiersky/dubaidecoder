import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAccess } from '@/lib/auth/require';
import { serviceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface VersionRow {
  slug: string;
  name: string;
  currency: string;
  status: string;
  updated_at: string;
}

async function loadVersions(): Promise<VersionRow[]> {
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('slug, name, currency, status, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`admin page: failed to load versions: ${error.message}`);
  return data ?? [];
}

export default async function AdminPage() {
  // Defense in depth: the proxy already gates /admin, but this page checks again.
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const versions = await loadVersions();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-2xl p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Admin</h1>
        <p className="mt-2 text-sm text-slate-500 text-center">All versions</p>

        <ul className="mt-8 space-y-2">
          {versions.length === 0 && (
            <li className="text-sm text-slate-500 text-center">No versions yet.</li>
          )}
          {versions.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/${v.slug}`}
                className="glass-input glass-card-hover flex items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm text-slate-800"
              >
                <span className="font-medium underline decoration-slate-300 underline-offset-4">
                  {v.name}
                </span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{v.slug}</span>
                  <span>{v.currency}</span>
                  <span className="capitalize">{v.status}</span>
                  <span>{new Date(v.updated_at).toLocaleDateString()}</span>
                  <span className="font-semibold text-slate-700">Open dashboard →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-slate-400">
          Version management arrives in the next release.
        </p>

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
