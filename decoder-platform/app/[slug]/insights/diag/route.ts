// TEMPORARY admin-only diagnostic for the Interact 403. Delete after use.
import { NextResponse } from 'next/server';
import { request as httpsRequest } from 'node:https';
import { getAccess } from '@/lib/auth/require';

export const dynamic = 'force-dynamic';

const URL_ = 'https://interact.interpublic.com/api/token';

function basic() {
  return `Basic ${Buffer.from(`${process.env.INTERACT_CLIENT_ID}:${process.env.INTERACT_CLIENT_SECRET}`).toString('base64')}`;
}

async function viaFetch(extra: Record<string, string>) {
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded', ...extra },
      body: 'grant_type=client_credentials',
      cache: 'no-store',
    });
    const text = await res.text();
    return { status: res.status, server: res.headers.get('server'), gotToken: text.includes('access_token'), snippet: text.includes('access_token') ? '' : text.slice(0, 160) };
  } catch (e) {
    return { error: String((e as { cause?: unknown })?.cause ?? e) };
  }
}

function viaHttps(): Promise<unknown> {
  return new Promise((resolve) => {
    const body = 'grant_type=client_credentials';
    const req = httpsRequest(URL_, { method: 'POST', headers: { Authorization: basic(), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, server: res.headers.server, gotToken: text.includes('access_token'), snippet: text.includes('access_token') ? '' : text.slice(0, 160) }));
    });
    req.on('error', (e) => resolve({ error: String(e) }));
    req.end(body);
  });
}

export async function GET() {
  const access = await getAccess();
  if (access?.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 });
  const egress = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  return NextResponse.json({
    region: process.env.VERCEL_REGION,
    node: process.version,
    egressIp: egress?.ip ?? null,
    credsPresent: Boolean(process.env.INTERACT_CLIENT_ID && process.env.INTERACT_CLIENT_SECRET),
    nextFetchDefault: await viaFetch({}),
    nextFetchWithUA: await viaFetch({ 'User-Agent': 'country-decoders/1.0 (+https://country-decoders.vercel.app)' }),
    nodeHttps: await viaHttps(),
  });
}
