import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getPublishedConfig } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import { requireSlugAccess } from '@/lib/auth/require';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

const loadConfig = cache(async (slug: string) => {
  try {
    return await getPublishedConfig(slug);
  } catch (e) {
    console.error(`[dashboard] config load failed for slug=${slug}:`, e);
    throw e; // outage -> Next error page, NOT notFound()
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await loadConfig(slug).catch(() => null);
  return { title: config ? `${config.name} — Market Intelligence` : 'Not found' };
}

export default async function VersionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireSlugAccess(slug);
  const config = await loadConfig(slug);
  if (!config) notFound();
  return <DashboardClient vm={deriveDashboard(config)} />;
}
