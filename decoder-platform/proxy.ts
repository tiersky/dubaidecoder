import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parseAccess, authorize } from './lib/auth/access';

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    }
  );

  // Refreshes the token when needed; never use getSession() here.
  const { data } = await supabase.auth.getClaims();
  const access = data?.claims ? parseAccess(data.claims) : null;

  const decision = authorize(request.nextUrl.pathname, access);
  if (decision === 'allow') return response;
  const url = request.nextUrl.clone();
  if (decision === 'login') {
    url.pathname = '/login';
    url.search = '';
    if (request.method === 'GET' && !request.nextUrl.pathname.startsWith('/api/')) {
      url.searchParams.set('next', request.nextUrl.pathname);
    }
  } else {
    url.pathname = '/select'; // forbidden: send them to their own project list
    url.search = '';
  }
  // Carry any refreshed session cookies (token rotation from setAll above)
  // onto the redirect response — a fresh NextResponse.redirect() otherwise
  // drops them, which can silently log the user out after rotation.
  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|css|js\\.map)$).*)'],
};
