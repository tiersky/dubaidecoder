import { NextResponse } from 'next/server';
import { getAccess } from '@/lib/auth/require';
import { authorize } from '@/lib/auth/access';
import { getPublishedConfig } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import { loadCountryData } from '@/lib/insights/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /[slug]/country-data
 * Public macro and socio context (IMF, World Bank, Our World in Data) for
 * every market in the published decoder. Upstream responses are cached for a
 * day in Next's data cache, so most requests make no outbound call.
 */
export async function GET(_req: Request, ctx: RouteContext<'/[slug]/country-data'>) {
  const { slug } = await ctx.params;
  const access = await getAccess();
  const decision = authorize(`/${slug}`, access);
  if (decision !== 'allow' || !access) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: decision === 'login' ? 401 : 403 });
  }

  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) return NextResponse.json({ error: 'No published decoder here.' }, { status: 404 });

  const iso2s = deriveDashboard(config)
    .markets.map((m) => m.iso2)
    .filter((c): c is string => Boolean(c));
  const data = await loadCountryData(iso2s);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
