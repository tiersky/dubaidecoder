import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getAccess } from '@/lib/auth/require';
import { getDraft } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import DashboardClient from '@/app/[slug]/dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DraftPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');
  const draft = await getDraft(slug);
  if (!draft) notFound();
  return (
    <div>
      <div className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white">
        Draft preview — not live.{' '}
        <Link href={`/admin/${slug}/confirm`} className="underline">Back to confirm</Link>
      </div>
      <DashboardClient vm={deriveDashboard(draft.config)} />
    </div>
  );
}
