import { notFound } from 'next/navigation';
import { getPublishedConfig } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import { requireSlugAccess } from '@/lib/auth/require';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getPublishedConfig(slug).catch(() => null);
  return { title: config ? `${config.name} — Market Intelligence` : 'Not found' };
}

export default async function VersionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireSlugAccess(slug);
  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) notFound();
  return <DashboardClient vm={deriveDashboard(config)} />;
}
