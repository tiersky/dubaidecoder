import { notFound, redirect } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { getDraft, getPublishedConfig } from '@/lib/versions/store';
import { stateFromConfig } from '@/lib/builder/build';
import Builder from '@/components/builder/Builder';

export const dynamic = 'force-dynamic';

/** Opens a guided draft, or a published version, in the builder. */
export default async function BuildPage({ params }: { params: Promise<{ slug: string }> }) {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');
  const { slug } = await params;

  const [draft, published] = await Promise.all([getDraft(slug).catch(() => null), getPublishedConfig(slug).catch(() => null)]);
  // A workbook upload in progress is finished on its own confirm page.
  if (draft?.workbookPath) redirect(`/admin/${slug}/confirm`);
  const config = draft?.config ?? published;
  if (!config) notFound();

  const state = { ...stateFromConfig(config), mode: published ? ('edit' as const) : ('new' as const) };
  return (
    <main className="min-h-screen">
      <Builder key={slug} initial={state} resumeLocal={false} />
    </main>
  );
}
