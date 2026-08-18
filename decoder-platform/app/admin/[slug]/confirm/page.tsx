import { redirect, notFound } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { getDraft } from '@/lib/versions/store';
import { ConfirmForm } from './confirm-form';

export const dynamic = 'force-dynamic';

export default async function ConfirmDraftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const { slug } = await params;
  const draft = await getDraft(slug);
  if (!draft) notFound();

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        <ConfirmForm draft={draft} />
      </div>
    </main>
  );
}
