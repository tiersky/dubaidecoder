import { redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { downloadDraftWorkbook } from '@/lib/storage/workbooks';
import { detectCandidates, candidateSummaries } from '@/lib/admin/upload-core';
import { pickCandidateAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ChooseCandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const { slug } = await params;
  const { name } = await searchParams;

  const bytes = await downloadDraftWorkbook(slug);
  const { candidates } = detectCandidates(bytes);
  const summaries = candidateSummaries(candidates);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card w-full max-w-2xl p-8">
        <h1 className="text-2xl font-semibold text-slate-800 text-center">
          Multiple model blocks found
        </h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          Choose which one to use for &quot;{slug}&quot;
        </p>

        <div className="mt-8 space-y-3">
          {summaries.map((c) => (
            <form key={c.index} action={pickCandidateAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="name" value={name ?? ''} />
              <input type="hidden" name="index" value={c.index} />
              <button
                type="submit"
                className="glass-input glass-card-hover w-full rounded-lg px-4 py-3 text-left text-sm text-slate-800"
              >
                <div className="font-medium">{c.sheetName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.marketCount} markets · {c.metricCount} metrics
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.headers.slice(0, 6).join(', ')}
                </div>
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
