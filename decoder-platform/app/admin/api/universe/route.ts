import { NextResponse } from 'next/server';
import { getUniverse } from '@/lib/recommend/universe';
import { isAdmin } from '@/lib/recommend/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /admin/api/universe: every country with its public facts, for the builder. */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  try {
    const u = await getUniverse();
    return NextResponse.json(u, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch (err) {
    console.error('[universe]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Country data is unavailable right now. Try again shortly.' }, { status: 502 });
  }
}
