import { NextResponse, type NextRequest } from 'next/server';
import { serviceClient } from '@/lib/supabase/admin';
import { safeEqual } from '@/lib/auth/safe-equal';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || !safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { error, count } = await serviceClient()
    .from('versions')
    .select('id', { count: 'exact', head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, versions: count ?? 0 });
}
