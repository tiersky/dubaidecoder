import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAccess } from '@/lib/auth/require';
import { listVersions, listDrafts } from '@/lib/versions/store';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Defense in depth: the proxy already gates /admin, but this page checks again.
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const [versions, drafts] = await Promise.all([listVersions(), listDrafts()]);
  const published = versions.filter((v) => v.status === 'published');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-2xl p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">Admin</h1>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link
            href="/admin/upload"
            className="glass-input glass-card-hover rounded-lg px-4 py-2 font-medium text-slate-800"
          >
            New version / update
          </Link>
          <Link
            href="/admin/users"
            className="glass-input glass-card-hover rounded-lg px-4 py-2 font-medium text-slate-800"
          >
            Users
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-600">Published versions</h2>
          <ul className="mt-3 space-y-2">
            {published.length === 0 && (
              <li className="text-sm text-slate-500 text-center">No published versions yet.</li>
            )}
            {published.map((v) => (
              <li
                key={v.slug}
                className="glass-input flex items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm text-slate-800"
              >
                <span className="font-medium">{v.name}</span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{v.slug}</span>
                  <span>{v.currency}</span>
                  <span>{new Date(v.updatedAt).toLocaleDateString()}</span>
                  <Link
                    href={`/${v.slug}`}
                    className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                  >
                    Open
                  </Link>
                  <Link
                    href={`/admin/${v.slug}/tweaks`}
                    className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                  >
                    Tweaks
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {drafts.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-slate-600">Drafts</h2>
            <ul className="mt-3 space-y-2">
              {drafts.map((d) => (
                <li
                  key={d.slug}
                  className="glass-input flex items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm text-slate-800"
                >
                  <span className="font-medium">{d.name}</span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{d.slug}</span>
                    <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
                    <Link
                      href={`/admin/${d.slug}/confirm`}
                      className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                    >
                      Resume
                    </Link>
                    <Link
                      href={`/admin/${d.slug}/preview`}
                      className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                    >
                      Preview
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
