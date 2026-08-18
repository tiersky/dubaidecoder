import { redirect, notFound } from 'next/navigation';
import { getAccess } from '@/lib/auth/require';
import { getPublishedConfig } from '@/lib/versions/store';
import { TweaksForm } from './tweaks-form';

export const dynamic = 'force-dynamic';

export default async function TweaksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');

  const { slug } = await params;
  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) notFound();

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        <TweaksForm slug={slug} config={config} />
      </div>
    </main>
  );
}
