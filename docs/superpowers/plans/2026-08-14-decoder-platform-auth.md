# Decoder Platform — Plan 4: Auth, Access & Ops

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate every dashboard behind login (admins see everything; viewers see only their assigned project slugs), create real users, keep the Supabase free tier alive with a daily cron, and deploy the platform to its own Vercel project.

**Architecture:** Supabase Auth with `app_metadata` carrying `role` (`admin`|`viewer`) and `allowed_slugs` (server-controlled — never `user_metadata`, which is user-editable). @supabase/ssr cookie-based sessions; a Next proxy/middleware refreshes tokens via `supabase.auth.getClaims()` and enforces route access; pages re-check server-side (defense in depth). Login is a server action so sessions are set server-side (also makes curl-with-cookie-jar smoke tests possible). Admin UI itself is Plan 5 — this plan ships a placeholder admin page, the user-creation script, keepalive, and the deployment.

**Tech Stack:** @supabase/ssr (pinned), Supabase Auth admin API, Vercel (project + cron).

**Spec:** `docs/superpowers/specs/2026-08-14-decoder-platform-design.md` (Auth + Operations sections). Suite before this plan: 61/61.

## Global Constraints

- Authorization data lives in `app_metadata` ONLY (`raw_app_meta_data`) — never `user_metadata`. JWT claims are stale until token refresh (≤1h): changing a viewer's `allowed_slugs` takes effect on their next refresh/sign-in; document this in code comments where slugs are read.
- Server-side auth checks use `supabase.auth.getClaims()` — never trust `getSession()` in server code.
- The service-role key stays server-only. The browser client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (add it to `.env.local` as a duplicate of the existing anon value — the sb_publishable key IS the publishable key). Never print any env value in logs, reports, or commits.
- Next 16 renamed middleware → proxy. Create `decoder-platform/proxy.ts` with the code below; if a behavioral check shows it isn't invoked (unauthenticated `/egypt` not redirecting in `next dev`), rename the file to `middleware.ts` and the export to `middleware` — same body — and note which form worked in your report.
- Public paths: `/login`, `/select`, `/api/keepalive`, `/` (root landing), Next static assets. Everything else requires a session; `/admin*` additionally requires role admin; `/{slug}` requires admin or slug ∈ allowed_slugs.
- Pin `@supabase/ssr` to an exact minor when installing and commit the lockfile.
- TDD for pure logic (claims parsing, route authorization). Flows verified by live integration scripts and HTTP smoke with a cookie jar.
- Commit after every task.

---

### Task 1: SSR clients and access rules

**Files:**
- Create: `decoder-platform/lib/supabase/browser.ts`
- Create: `decoder-platform/lib/supabase/server.ts`
- Create: `decoder-platform/lib/auth/access.ts`
- Test: `decoder-platform/lib/auth/access.test.ts`
- Modify: `decoder-platform/.env.local` (append `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` with the same value as the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` line — copy the value with shell, do not retype or print it)

**Interfaces:**

```ts
// lib/supabase/browser.ts
export function browserClient(): SupabaseClient;

// lib/supabase/server.ts  (server components / actions / route handlers)
export async function serverClient(): Promise<SupabaseClient>; // wraps next/headers cookies with getAll/setAll

// lib/auth/access.ts — PURE, no imports beyond types
export interface Access { role: 'admin' | 'viewer' | null; slugs: string[] }
export function parseAccess(claims: unknown): Access;            // reads app_metadata.role / allowed_slugs, tolerant of malformed input
export type Decision = 'allow' | 'login' | 'forbidden';
export function authorize(pathname: string, access: Access | null): Decision;
```

`authorize` rules: public paths (exact `/`, prefixes `/login`, `/select`, `/api/keepalive`) → `allow` regardless. No access (null / role null) → `login`. `/admin` prefix → `allow` iff role admin else `forbidden`. Anything else is `/{slug}[/...]`: take the first path segment; `allow` iff admin or slugs includes it, else `forbidden`.

- [ ] **Step 1: Install** — `cd decoder-platform && npm install @supabase/ssr@^0.7 && npm ls @supabase/ssr` (record the exact version; if ^0.7 does not exist, install latest and record — the cookie API required is `getAll`/`setAll`).

- [ ] **Step 2: Failing tests** — `lib/auth/access.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAccess, authorize } from './access';

describe('parseAccess', () => {
  it('reads role and slugs from app_metadata', () => {
    expect(
      parseAccess({ app_metadata: { role: 'viewer', allowed_slugs: ['qatar', 'egypt'] } })
    ).toEqual({ role: 'viewer', slugs: ['qatar', 'egypt'] });
  });
  it('tolerates malformed claims', () => {
    expect(parseAccess(null)).toEqual({ role: null, slugs: [] });
    expect(parseAccess({})).toEqual({ role: null, slugs: [] });
    expect(parseAccess({ app_metadata: { role: 'nonsense', allowed_slugs: 'x' } })).toEqual({
      role: null,
      slugs: [],
    });
  });
});

describe('authorize', () => {
  const admin = { role: 'admin' as const, slugs: [] };
  const viewer = { role: 'viewer' as const, slugs: ['egypt'] };

  it('public paths always allowed', () => {
    expect(authorize('/', null)).toBe('allow');
    expect(authorize('/login', null)).toBe('allow');
    expect(authorize('/api/keepalive', null)).toBe('allow');
    expect(authorize('/select', viewer)).toBe('allow');
  });
  it('signed-out users are sent to login', () => {
    expect(authorize('/egypt', null)).toBe('login');
    expect(authorize('/admin', null)).toBe('login');
  });
  it('admin area is admin-only', () => {
    expect(authorize('/admin', admin)).toBe('allow');
    expect(authorize('/admin/users', admin)).toBe('allow');
    expect(authorize('/admin', viewer)).toBe('forbidden');
  });
  it('slug pages respect allowed_slugs', () => {
    expect(authorize('/egypt', viewer)).toBe('allow');
    expect(authorize('/qatar', viewer)).toBe('forbidden');
    expect(authorize('/qatar', admin)).toBe('allow');
  });
});
```

- [ ] **Step 3: Implement** —

`lib/supabase/browser.ts`:

```ts
'use client' file consumers only — but the factory itself has no directive.
import { createBrowserClient } from '@supabase/ssr';

export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

(Remove the stray first line above — it is a note, not code.)

`lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when the
            // proxy/middleware is refreshing sessions.
          }
        },
      },
    }
  );
}
```

`lib/auth/access.ts`:

```ts
export interface Access {
  role: 'admin' | 'viewer' | null;
  slugs: string[];
}

/** app_metadata is server-controlled (never user_metadata). Claims can be
 * stale until the JWT refreshes (≤1h) — slug changes apply on next refresh. */
export function parseAccess(claims: unknown): Access {
  const meta =
    claims && typeof claims === 'object'
      ? (claims as { app_metadata?: unknown }).app_metadata
      : undefined;
  if (!meta || typeof meta !== 'object') return { role: null, slugs: [] };
  const m = meta as { role?: unknown; allowed_slugs?: unknown };
  const role = m.role === 'admin' || m.role === 'viewer' ? m.role : null;
  const slugs =
    role !== null && Array.isArray(m.allowed_slugs)
      ? m.allowed_slugs.filter((s): s is string => typeof s === 'string')
      : [];
  return role === null ? { role: null, slugs: [] } : { role, slugs };
}

const PUBLIC_EXACT = new Set(['/']);
const PUBLIC_PREFIXES = ['/login', '/select', '/api/keepalive'];

export type Decision = 'allow' | 'login' | 'forbidden';

export function authorize(pathname: string, access: Access | null): Decision {
  if (PUBLIC_EXACT.has(pathname)) return 'allow';
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')))
    return 'allow';
  if (!access || access.role === null) return 'login';
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return access.role === 'admin' ? 'allow' : 'forbidden';
  const slug = pathname.split('/')[1] ?? '';
  if (access.role === 'admin' || access.slugs.includes(slug)) return 'allow';
  return 'forbidden';
}
```

- [ ] **Step 4: Append the publishable-key line to `.env.local`** with shell (no printing):

```bash
cd decoder-platform && grep -q NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY .env.local || \
  awk -F= '/^NEXT_PUBLIC_SUPABASE_ANON_KEY=/{print "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" $2}' .env.local >> .env.local
```

- [ ] **Step 5: Run tests** — expect 61 + 6 new = 67 green; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** (never `git add .env.local` — verify with `git status` that it is untracked/ignored):

```bash
git add decoder-platform/lib/supabase decoder-platform/lib/auth decoder-platform/package.json decoder-platform/package-lock.json
git commit -m "Add SSR Supabase clients and pure route-access rules"
```

---

### Task 2: Session proxy and server-side page guard

**Files:**
- Create: `decoder-platform/proxy.ts` (fallback `middleware.ts` per Global Constraints)
- Create: `decoder-platform/lib/auth/require.ts`
- Modify: `decoder-platform/app/[slug]/page.tsx` (add the guard call)

**Interfaces:**

```ts
// lib/auth/require.ts (server-only)
export async function getAccess(): Promise<Access | null>;        // getClaims() → parseAccess, null when signed out
export async function requireSlugAccess(slug: string): Promise<Access>; // redirects to /login or /select when not allowed
```

- [ ] **Step 1: Implement the proxy** — `decoder-platform/proxy.ts`:

```ts
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
  } else {
    url.pathname = '/select'; // forbidden: send them to their own project list
    url.search = '';
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|ico|css|js\\.map)$).*)'],
};
```

- [ ] **Step 2: Implement the server guard** — `lib/auth/require.ts`:

```ts
import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/server';
import { parseAccess, authorize, type Access } from './access';

export async function getAccess(): Promise<Access | null> {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const access = parseAccess(data.claims);
  return access.role === null ? null : access;
}

/** Defense in depth behind the proxy — pages must not rely on the proxy alone. */
export async function requireSlugAccess(slug: string): Promise<Access> {
  const access = await getAccess();
  const decision = authorize(`/${slug}`, access);
  if (decision === 'allow' && access) return access;
  redirect(decision === 'login' ? '/login' : '/select');
}
```

In `app/[slug]/page.tsx`, call `await requireSlugAccess(slug);` as the first statement of `VersionPage` (before fetching the config). Leave `generateMetadata` as is.

- [ ] **Step 3: Behavioral check** — `npm run build` then `PORT=3199 npm run start &`; `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3199/egypt` → expect `307`/`308`/`302` redirecting to `/login`. `curl /login` → 200. `curl /` → 200. Kill the server. If `/egypt` returns 200 (proxy not invoked), apply the middleware.ts fallback and re-check.

- [ ] **Step 4: Verify suite** — `npx vitest run` green; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add decoder-platform/proxy.ts decoder-platform/middleware.ts decoder-platform/lib/auth decoder-platform/app 2>/dev/null || git add -A decoder-platform
git commit -m "Gate routes with session proxy and server-side slug guard"
```

---

### Task 3: Login, select, sign-out

**Files:**
- Create: `decoder-platform/app/login/page.tsx` (form, client-light)
- Create: `decoder-platform/app/login/actions.ts` (server action)
- Create: `decoder-platform/app/select/page.tsx`
- Create: `decoder-platform/app/auth/signout/route.ts`

**Behavior:**
- `actions.ts` — `'use server'`; `signIn(prevState, formData)`: email+password → `(await serverClient()).auth.signInWithPassword(...)`. On error return `{ error: 'Invalid email or password' }` (never echo raw Supabase errors to the form). On success, `getClaims` → `parseAccess` → `redirect('/admin')` for admins; viewers with exactly one slug → `redirect('/' + slug)`; otherwise `redirect('/select')`.
- `login/page.tsx` — minimal glass-card form (email, password, submit) using `useActionState` with the action; shows the returned error; styled with the existing globals.css classes (`glass-card`, `glass-input`). Product copy: title "Country Decoder", subtitle "Sign in to view your dashboard".
- `select/page.tsx` — server component; `getAccess()`; null → redirect `/login`. Admin: list ALL versions (slug + name via `serviceClient` query on `versions`, published only) as links. Viewer: list only `access.slugs` (look up names for those slugs; slugs whose version vanished render as plain text "not yet published"). Include a sign-out button (form POST to `/auth/signout`).
- `signout/route.ts` — POST handler: `(await serverClient()).auth.signOut()` then redirect to `/login` (303).

- [ ] **Step 1: Implement the four files.**
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build`; `npx vitest run` green. (Interactive login is smoke-tested for real in Task 5 after users exist.)
- [ ] **Step 3: Commit**

```bash
git add decoder-platform/app && git commit -m "Add login flow, project selector, and sign-out"
```

---

### Task 4: Admin placeholder and keepalive cron

**Files:**
- Create: `decoder-platform/app/admin/page.tsx`
- Create: `decoder-platform/app/api/keepalive/route.ts`
- Create: `decoder-platform/vercel.json`
- Modify: `decoder-platform/.env.local` (append `CRON_SECRET=` with `openssl rand -hex 32` — generate directly into the file, never print)

**Behavior:**
- `admin/page.tsx` — server component; first statement: `const access = await getAccess(); if (!access || access.role !== 'admin') redirect('/login');` (defense in depth behind the proxy). Render a glass-card listing all versions (slug, name, currency, status, updated_at via serviceClient) with links to `/{slug}`, a sign-out button, and the note "Version management arrives in the next release." No mutations in this plan.
- `keepalive/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { serviceClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { error, count } = await serviceClient()
    .from('versions')
    .select('id', { count: 'exact', head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, versions: count ?? 0 });
}
```

- `vercel.json`:

```json
{
  "crons": [{ "path": "/api/keepalive", "schedule": "0 6 * * *" }]
}
```

(Vercel invokes cron paths with `Authorization: Bearer $CRON_SECRET` automatically when the env var exists on the project.)

- [ ] **Step 1: Implement; append CRON_SECRET to .env.local via `printf 'CRON_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local`.**
- [ ] **Step 2: Verify** — build; start on 3199; `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3199/api/keepalive` → 401; with the header (`set -a; source .env.local; set +a; curl -H "Authorization: Bearer $CRON_SECRET" ...`) → 200 with `{"ok":true,...}`; `/admin` unauthenticated → redirect to /login. Kill server. Vitest green.
- [ ] **Step 3: Commit** (vercel.json + app only — `.env.local` stays untracked)

```bash
git add decoder-platform/app decoder-platform/vercel.json && git commit -m "Add admin placeholder and keepalive cron endpoint"
```

---

### Task 5: User creation script + live auth verification

**Files:**
- Create: `decoder-platform/scripts/create-user.ts`
- Create: `decoder-platform/scripts/check-auth.ts`

**`create-user.ts`** — usage: `npx tsx --env-file=.env.local scripts/create-user.ts <email> <password> <admin|viewer> [slug ...]`:

```ts
import { serviceClient } from '../lib/supabase/admin';

async function main() {
  const [email, password, role, ...slugs] = process.argv.slice(2);
  if (!email || !password || (role !== 'admin' && role !== 'viewer')) {
    console.error('usage: create-user.ts <email> <password> <admin|viewer> [slug ...]');
    process.exit(1);
  }
  const db = serviceClient();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role, allowed_slugs: role === 'viewer' ? slugs : [] },
  });
  if (error) throw new Error(error.message);
  console.log(`created ${role} ${email} (id ${data.user?.id}) slugs=[${slugs.join(', ')}]`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**`check-auth.ts`** — signs in with supabase-js using the PUBLISHABLE key (real client path) and asserts the JWT claims carry the access data; usage `npx tsx --env-file=.env.local scripts/check-auth.ts <email> <password> <expected-role> [expected-slug]`:

```ts
import { createClient } from '@supabase/supabase-js';

async function main() {
  const [email, password, expectedRole, expectedSlug] = process.argv.slice(2);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const meta = data.user?.app_metadata as { role?: string; allowed_slugs?: string[] };
  if (meta?.role !== expectedRole) throw new Error(`role: expected ${expectedRole}, got ${meta?.role}`);
  if (expectedSlug && !meta?.allowed_slugs?.includes(expectedSlug))
    throw new Error(`allowed_slugs missing ${expectedSlug}: ${JSON.stringify(meta?.allowed_slugs)}`);
  await supabase.auth.signOut();
  console.log(`auth OK: ${email} role=${meta.role} slugs=${JSON.stringify(meta.allowed_slugs)}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 1: Implement both scripts.**
- [ ] **Step 2: Create the real users against live Supabase** (generate passwords with `openssl rand -base64 18`; write them to `/Users/emre.kaya/Desktop/projects/abudhabi/.superpowers/credentials-plan4.txt` — a path OUTSIDE the repo's tracked tree (the .superpowers dir is git-ignored) — as `email password role` lines; do NOT put passwords in your report or commit them):
  - `npx tsx --env-file=.env.local scripts/create-user.ts emredplc@gmail.com <gen-pw> admin`
  - `npx tsx --env-file=.env.local scripts/create-user.ts viewer-egypt@decoders.test <gen-pw> viewer egypt`
- [ ] **Step 3: Verify live** — `check-auth.ts` for both users (admin expects role admin; viewer expects viewer + egypt). Then the full HTTP session smoke with a cookie jar: build + start on 3199; POST the login form is a server action (not plain form-encodable) — instead verify the gate end-to-end at the auth level: confirm `/egypt` unauthenticated redirects to `/login` and `/login` renders 200 (the action-based login is exercised in the deployed smoke of Task 6 via browser). Kill server.
- [ ] **Step 4: Commit** (scripts only)

```bash
git add decoder-platform/scripts && git commit -m "Add user-creation and auth-verification scripts"
```

---

### Task 6: Deploy to Vercel

**Files:**
- Modify: `README.md` (repo root — add the platform row to the registry table)

No app-code changes; this task is operations, executed with the Vercel CLI + API exactly as follows.

- [ ] **Step 1: Create + link the Vercel project** —

```bash
cd decoder-platform && npx vercel link --yes --project country-decoders
```

If the global name `country-decoders` is taken, retry with `decoder-hub`, then `country-decoder-platform`; record which name won (it determines the URL `<name>.vercel.app`).

- [ ] **Step 2: Connect git + set root directory + ignore step** — read the token the CLI itself uses (`~/Library/Application Support/com.vercel.cli/auth.json`, key `token`; if the API returns invalidToken, run `npx vercel whoami` once to refresh and re-read; never print the token). With `teamId=team_4Q9yq2w1kAETSQMERMxXAzym`:

```bash
npx vercel git connect https://github.com/tiersky/dubaidecoder.git --yes
# PROJECT_ID from decoder-platform/.vercel/project.json
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"rootDirectory":"decoder-platform","commandForIgnoringBuildStep":"git diff --quiet HEAD^ HEAD -- ."}'
```

Verify the PATCH response echoes both settings.

- [ ] **Step 3: Set env vars on the project** (production + preview) from `.env.local`, piping values so they are never printed:

```bash
set -a; source .env.local; set +a
for VAR in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY CRON_SECRET; do
  printf '%s' "${!VAR}" | npx vercel env add "$VAR" production
  printf '%s' "${!VAR}" | npx vercel env add "$VAR" preview
done
```

(`SUPABASE_DB_URL` stays local-only — the app never needs it at runtime.)

- [ ] **Step 4: Production deploy** — from the REPO ROOT (root-directory projects deploy from the root): `cp -r decoder-platform/.vercel .vercel && npx vercel deploy --prod --yes; rm -rf .vercel`. Record the production URL.

- [ ] **Step 5: Remote smoke** — against the production URL: `/login` → 200; `/egypt` → redirect to `/login`; `/api/keepalive` without header → 401; `/` → 200. Also confirm in the deploy output or via `curl -X GET https://api.vercel.com/v1/projects/$PROJECT_ID/crons?teamId=$TEAM` (if available) that the cron registered — otherwise note that vercel.json crons register on deploy and verify presence in the deploy build logs.

- [ ] **Step 6: Update the root README registry** — change the decoder-platform row situation: add a row `| Decoder Platform (all new versions) | multi-client | decoder-platform/ | <project-name> | <url> | dynamic |` to the registry table.

- [ ] **Step 7: Commit**

```bash
git add README.md && git commit -m "Register deployed decoder platform in README"
```

---

## Self-review notes

- Spec coverage (Auth + Operations): admin/viewer roles in app_metadata ✓ (T1/T5), login page + post-login routing ✓ (T3), middleware/proxy protection + no public client list ✓ (T2/T3), keepalive cron with CRON_SECRET ✓ (T4), deployment ✓ (T6). Admin user management UI + upload/confirm/publish: Plan 5 (the created scripts are its temporary stand-in).
- Security checklist applied: app_metadata not user_metadata; getClaims not getSession; service key server-only; publishable key for browser; no secrets printed or committed; login errors are generic.
- Type consistency: `Access`/`parseAccess`/`authorize` defined once (T1), consumed by proxy (T2), require.ts (T2), actions (T3), pages (T3/T4).
- Deferred-in: page.tsx outage logging, React cache() double-fetch — NOT included here deliberately; they ride with Plan 5's admin work unless the final review of this plan overrules.
