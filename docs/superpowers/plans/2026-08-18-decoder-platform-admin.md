# Decoder Platform Admin UI (Plan 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin surface — workbook upload → detect → confirm → publish with drafts, full dashboard preview, quick tweaks, user management UI, workbook storage — plus the deferred hardening items carried from plan 4.

**Architecture:** Server actions everywhere; the `version_drafts` row in Supabase *is* the upload wizard's state (resumable by construction). Drafts live in their own admin-only table (RLS is row-level — a draft column on `versions` would leak to viewers). Publish upserts `versions`, appends `version_revisions` (with race retry), promotes the workbook file, deletes the draft.

**Tech Stack:** Next 16 (App Router, `proxy.ts` not middleware), @supabase/ssr, Supabase (Postgres/Auth/Storage), SheetJS (CDN build), vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-decoder-platform-admin-design.md` (refines `2026-08-14-decoder-platform-design.md`).

## Global Constraints

- All work in `decoder-platform/`; run commands from that directory unless noted.
- Branch `decoder-platform-admin`; merge to `main` with `--no-ff` at the end (fast-forward + README-tail commit would make the ignore-build-step skip the Vercel deploy).
- Next 16 has breaking changes vs training data — read the relevant guide in `node_modules/next/dist/docs/` before writing route/action code. `proxy.ts`, not `middleware.ts`.
- Service-role key server-only; never in a `'use client'` file. Auth reads use `getClaims()`, never `getSession()`. Role/slugs live in `app_metadata` only.
- Every admin server action and page re-checks `role === 'admin'` server-side (defense in depth behind the proxy).
- Existing vitest suite (61 tests) must stay green after every task: `npx vitest run`.
- Login errors stay generic; never echo raw Supabase auth errors; never log or commit passwords/keys.
- Live Supabase project: `country-decoder` (orsmdwcubohcaretyatl.supabase.co); credentials in `decoder-platform/.env.local` (gitignored). Scripts run via `npx tsx --env-file=.env.local <script>`.

---

### Task 1: Swap xlsx to the SheetJS CDN build

The npm `xlsx@0.18.5` package has open advisories and is stale. The official distribution is the CDN tarball. This must land before any upload-endpoint code.

**Files:**
- Modify: `decoder-platform/package.json` (the `"xlsx"` dependency line)

**Interfaces:**
- Produces: same `xlsx` module API (`read`, `utils`) — `lib/parser/grid.ts` keeps working unchanged.

- [ ] **Step 1: Find the current latest CDN version**

Run: `curl -s https://cdn.sheetjs.com/ | grep -oE 'xlsx-[0-9]+\.[0-9]+\.[0-9]+' | sort -Vu | tail -1`
Expected: something like `xlsx-0.20.3` (use whatever is actually latest; pin that exact version below — do not use the floating `xlsx-latest` URL in package.json).

- [ ] **Step 2: Swap the dependency**

```bash
npm rm xlsx
npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz   # substitute the version from Step 1
```

- [ ] **Step 3: Run the full suite as the regression gate**

Run: `npx vitest run`
Expected: all 61 tests PASS (the parser suite exercises `read`/grid loading against the real Egypt and AlUla workbooks — this is the compatibility proof).

- [ ] **Step 4: Verify the audit is clean**

Run: `npm audit --omit=dev`
Expected: no advisories for xlsx.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: replace npm xlsx with pinned SheetJS CDN build"
```

---

### Task 2: Migration 0002 — `version_drafts` table

**Files:**
- Create: `decoder-platform/supabase/migrations/0002_version_drafts.sql`

**Interfaces:**
- Produces: table `public.version_drafts` (columns below) — consumed by Task 7's store functions. `versions.status` stops being written as `'draft'`; the column stays.

- [ ] **Step 1: Write the migration**

```sql
-- Drafts are wizard state: one pending draft per slug, admin-only.
-- Separate table (not a column on versions) because RLS is row-level:
-- a draft column on a published row would be readable by that
-- project's viewers. versions now only ever holds published content.

create table public.version_drafts (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  config jsonb not null,
  workbook_path text not null,
  source_sheet text,
  source_index integer not null default 0,
  verify jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger version_drafts_set_updated_at
  before update on public.version_drafts
  for each row
  execute function public.set_updated_at();

alter table public.version_drafts enable row level security;
alter table public.version_drafts force row level security;

-- Admin-only reads; writes go through the service role (bypasses RLS),
-- so no insert/update/delete policies for authenticated.
create policy version_drafts_admin_read on public.version_drafts
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

- [ ] **Step 2: Apply to the live project**

Paste the file into the Supabase SQL editor for project `orsmdwcubohcaretyatl` and run it (same procedure as migration 0001; there is no local supabase CLI link in this repo).

- [ ] **Step 3: Verify it applied**

In the SQL editor: `select count(*) from public.version_drafts;`
Expected: `0` (table exists, empty). Also confirm in Table Editor that RLS shows enabled.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_version_drafts.sql
git commit -m "db: add version_drafts table (admin-only wizard state)"
```

---

### Task 3: Login routing — `?next=` and already-authed redirect

Carried deferreds. The proxy sends unauthenticated users to `/login` losing their destination; authed users who open `/login` see the form again.

**Files:**
- Modify: `decoder-platform/proxy.ts` (login redirect branch)
- Modify: `decoder-platform/app/login/actions.ts`
- Modify: `decoder-platform/app/login/page.tsx` (hidden `next` field from searchParams; authed redirect)
- Create: `decoder-platform/lib/auth/post-login.ts`
- Test: `decoder-platform/lib/auth/post-login.test.ts`

**Interfaces:**
- Consumes: `parseAccess`, `authorize`, `Access` from `lib/auth/access.ts`; `getAccess` from `lib/auth/require.ts`.
- Produces: `postLoginPath(access: Access, next: string | null): string` — pure, used by the login action and the login page's authed redirect.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/auth/post-login.test.ts
import { describe, it, expect } from 'vitest';
import { postLoginPath } from './post-login';

const admin = { role: 'admin' as const, slugs: [] };
const viewer = (slugs: string[]) => ({ role: 'viewer' as const, slugs });

describe('postLoginPath', () => {
  it('honors a safe next path the user may access', () => {
    expect(postLoginPath(admin, '/admin/upload')).toBe('/admin/upload');
    expect(postLoginPath(viewer(['egypt']), '/egypt')).toBe('/egypt');
  });
  it('ignores next the user may not access', () => {
    expect(postLoginPath(viewer(['egypt']), '/admin')).toBe('/egypt');
  });
  it('rejects absolute/protocol-relative next (open redirect)', () => {
    expect(postLoginPath(admin, 'https://evil.example')).toBe('/admin');
    expect(postLoginPath(admin, '//evil.example')).toBe('/admin');
  });
  it('falls back by role when next is null', () => {
    expect(postLoginPath(admin, null)).toBe('/admin');
    expect(postLoginPath(viewer(['egypt']), null)).toBe('/egypt');
    expect(postLoginPath(viewer(['egypt', 'alula']), null)).toBe('/select');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/auth/post-login.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/auth/post-login.ts
import { authorize, type Access } from './access';

/** Where to send a just-authenticated user. `next` must be a same-site
 * path the user is actually allowed to visit; anything else falls back
 * to the role default. */
export function postLoginPath(access: Access, next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    if (authorize(next, access) === 'allow') return next;
  }
  if (access.role === 'admin') return '/admin';
  if (access.role === 'viewer' && access.slugs.length === 1) return '/' + access.slugs[0];
  return '/select';
}
```

In `proxy.ts`, the `decision === 'login'` branch — carry the destination (page requests only, drop any prior query):

```ts
if (decision === 'login') {
  url.pathname = '/login';
  url.search = '';
  if (request.method === 'GET' && !request.nextUrl.pathname.startsWith('/api/')) {
    url.searchParams.set('next', request.nextUrl.pathname);
  }
}
```

In `app/login/actions.ts`, replace the three-way redirect tail of `signIn` with:

```ts
const next = String(formData.get('next') ?? '') || null;
redirect(postLoginPath(access, next));
```

(`access.role === null` after successful sign-in should keep the existing behavior of falling through to `/select`; `postLoginPath` only accepts a non-null-role `Access`, so guard: `if (access.role === null) redirect('/select');` first.)

In `app/login/page.tsx`: make the page async, accept `searchParams: Promise<{ next?: string }>`, and (a) if `await getAccess()` returns a role, `redirect(postLoginPath(access, next ?? null))` — already-authed users never see the form; (b) pass `next` into the form as `<input type="hidden" name="next" value={next ?? ''} />`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts app/login lib/auth/post-login.ts lib/auth/post-login.test.ts
git commit -m "feat: ?next= post-login routing and authed /login redirect"
```

---

### Task 4: Hardening bundle — timing-safe cron auth, secure cookies, cache(), outage logging

Four small carried deferreds, each one file.

**Files:**
- Modify: `decoder-platform/app/api/keepalive/route.ts`
- Modify: `decoder-platform/lib/supabase/server.ts` and `decoder-platform/proxy.ts` (cookieOptions)
- Modify: `decoder-platform/app/[slug]/page.tsx`
- Test: `decoder-platform/app/api/keepalive/safe-equal.test.ts` (plus a tiny extracted helper)

**Interfaces:**
- Produces: `safeEqual(a: string, b: string): boolean` in `lib/auth/safe-equal.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/auth/safe-equal.test.ts  (place next to the helper, not under app/)
import { describe, it, expect } from 'vitest';
import { safeEqual } from './safe-equal';

describe('safeEqual', () => {
  it('matches equal strings', () => expect(safeEqual('abc', 'abc')).toBe(true));
  it('rejects different strings of any length', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run lib/auth/safe-equal.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement all four changes**

```ts
// lib/auth/safe-equal.ts
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string compare; hashing first equalizes lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
```

`app/api/keepalive/route.ts` — replace the `auth !== ...` comparison:

```ts
const auth = request.headers.get('authorization') ?? '';
if (!process.env.CRON_SECRET || !safeEqual(auth, `Bearer ${process.env.CRON_SECRET}`)) {
  return NextResponse.json({ ok: false }, { status: 401 });
}
```

`lib/supabase/server.ts` and `proxy.ts` — add to the `createServerClient` options object (both call sites):

```ts
cookieOptions: { secure: process.env.NODE_ENV === 'production' },
```

`app/[slug]/page.tsx` — deduplicate the config fetch with React `cache()` and log outages instead of swallowing them (a DB outage must not render as "project not found" without a trace):

```ts
import { cache } from 'react';

const loadConfig = cache(async (slug: string) => {
  try {
    return await getPublishedConfig(slug);
  } catch (e) {
    console.error(`[dashboard] config load failed for slug=${slug}:`, e);
    throw e; // outage -> Next error page, NOT notFound()
  }
});
```

Both `generateMetadata` and `VersionPage` call `loadConfig(slug)`; `generateMetadata` keeps its own `.catch(() => null)` (metadata must not crash the error page), the page body does not catch — `null` → `notFound()`, throw → error boundary.

- [ ] **Step 4: Run suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/safe-equal.ts lib/auth/safe-equal.test.ts app/api/keepalive/route.ts lib/supabase/server.ts proxy.ts app/\[slug\]/page.tsx
git commit -m "fix: timing-safe cron auth, secure cookies, cached config fetch, outage logging"
```

---

### Task 5: Parser diagnostics — near-misses and verify reasons

Carried deferreds. `findModelBlocks` silently drops almost-blocks; `VerificationReport` says `ok: false` without saying why.

**Files:**
- Modify: `decoder-platform/lib/parser/detect.ts`
- Modify: `decoder-platform/lib/parser/verify.ts`
- Test: extend `decoder-platform/lib/parser/detect.test.ts` and `decoder-platform/lib/parser/verify.test.ts`

**Interfaces:**
- Produces:
  - `export interface NearMiss { sheetName: string; row: number; reason: string }`
  - `export function findModelBlocksDetailed(grids: SheetGrid[]): { candidates: ModelBlockCandidate[]; nearMisses: NearMiss[] }` — `findModelBlocks` becomes a thin wrapper returning `.candidates` (existing callers/tests untouched).
  - `VerificationReport` gains `reasons: string[]` (empty when `ok`).

- [ ] **Step 1: Write the failing tests** (append to the existing test files, reusing their grid/workbook helpers)

```ts
// detect.test.ts additions — build a tiny in-memory grid the same way the
// file's existing synthetic-grid tests do (SheetGrid: {name, hidden, cells, formatted}).
it('reports a near-miss when Avg has no St.Dev beneath it', () => {
  const grid = gridFromRows('Sheet1', [
    ['Country', 'Metric A', 'Metric B'],
    ['Germany', 1, 2],
    ['France', 3, 4],
    ['Avg.', 2, 3],
    ['Something else', 0, 0],
  ]);
  const { candidates, nearMisses } = findModelBlocksDetailed([grid]);
  expect(candidates).toHaveLength(0);
  expect(nearMisses).toHaveLength(1);
  expect(nearMisses[0].reason).toMatch(/St\.?Dev/i);
});

it('reports a near-miss when the weight row is missing', () => {
  const grid = gridFromRows('Sheet1', [
    ['Country', 'Metric A', 'Metric B'],
    ['Germany', 1, 2],
    ['France', 3, 4],
    ['Avg.', 2, 3],
    ['St.Dev', 1, 1],
  ]);
  const { candidates, nearMisses } = findModelBlocksDetailed([grid]);
  expect(candidates).toHaveLength(0);
  expect(nearMisses[0].reason).toMatch(/model weight/i);
});

it('oracle workbooks produce no near-miss noise alongside their candidates', () => {
  const { candidates, nearMisses } = findModelBlocksDetailed(egyptGrids); // file's existing fixture
  expect(candidates.length).toBeGreaterThan(0);
  // near-misses may exist on scratch sheets; every reason must be non-empty text
  for (const m of nearMisses) expect(m.reason.length).toBeGreaterThan(5);
});
```

If `detect.test.ts` has no synthetic-grid helper, add `gridFromRows(name, rows)` locally: map rows to `cells`, `formatted` as string forms, `hidden: false`.

```ts
// verify.test.ts additions
it('explains failures in reasons', () => {
  // Take the file's existing passing Egypt config/candidate fixture and
  // corrupt one weight so scores drift past tolerance.
  const bad = structuredClone(egyptConfig);
  bad.metrics[0].weight += 25;
  const report = verifyAgainstWorkbook(bad, egyptCandidate);
  expect(report.ok).toBe(false);
  expect(report.reasons.length).toBeGreaterThan(0);
  expect(report.reasons.join(' ')).toMatch(/exceeds/);
});

it('reports empty-comparison as a reason', () => {
  const noOutputs = { ...egyptCandidate, outputs: null, indexTable: null };
  const report = verifyAgainstWorkbook(egyptConfig, noOutputs);
  expect(report.ok).toBe(false);
  expect(report.reasons[0]).toMatch(/nothing to compare/i);
});
```

- [ ] **Step 2: Run them to verify failure**

Run: `npx vitest run lib/parser/detect.test.ts lib/parser/verify.test.ts`
Expected: FAIL — `findModelBlocksDetailed` not exported; `reasons` undefined.

- [ ] **Step 3: Implement detect near-misses**

Restructure `findModelBlocks` into `findModelBlocksDetailed`. At each rejection point, record why:

```ts
export interface NearMiss { sheetName: string; row: number; reason: string }

export function findModelBlocksDetailed(
  grids: SheetGrid[]
): { candidates: ModelBlockCandidate[]; nearMisses: NearMiss[] } {
  const candidates: ModelBlockCandidate[] = [];
  const nearMisses: NearMiss[] = [];
  for (const grid of grids) {
    if (grid.hidden) continue;
    const { cells } = grid;
    for (let r = 0; r < cells.length; r++) {
      const row = cells[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (!AVG_RE.test(norm(row[c]))) continue;
        const miss = (reason: string) => nearMisses.push({ sheetName: grid.name, row: r, reason });
        if (!STDEV_RE.test(norm(cells[r + 1]?.[c] ?? null))) {
          miss(`found "Avg." but no "St.Dev" on the next row`);
          continue;
        }
        let weightRow = -1;
        for (let w = r + 2; w <= r + 6 && w < cells.length; w++) {
          if (WEIGHT_RE.test(norm(cells[w]?.[c] ?? null))) { weightRow = w; break; }
        }
        if (weightRow === -1) {
          miss(`found Avg/St.Dev but no "Model weight" row within 4 rows below`);
          continue;
        }
        const built = buildCandidate(grid, r, c, weightRow);
        if (typeof built === 'string') { miss(built); continue; }
        candidates.push(built);
      }
    }
  }
  return { candidates: candidates.sort((a, b) => b.markets.length - a.markets.length), nearMisses };
}

export function findModelBlocks(grids: SheetGrid[]): ModelBlockCandidate[] {
  return findModelBlocksDetailed(grids).candidates;
}
```

Change `buildCandidate`'s return type to `ModelBlockCandidate | string` — each of its three `return null` sites returns the reason instead:
- header walk: `` `block header not found: need a header row plus at least 2 market rows above "Avg."` ``
- metric columns: `` `only ${metricCols.length} metric column(s) right of the label column; need at least 2` ``
- markets: `` `only ${markets.length} market row(s) with numeric data between header and "Avg."; need at least 2` ``

- [ ] **Step 4: Implement verify reasons**

In `verify.ts`, extend `VerificationReport` with `reasons: string[]` and build them in the return:

```ts
const reasons: string[] = [];
if (checks.length === 0) {
  reasons.push('nothing to compare: workbook has no readable outputs or index table');
}
const worst = (kind: VerificationCheck['kind']) =>
  checks.filter((c) => c.kind === kind).sort((a, b) => b.delta - a.delta)[0];
for (const [kind, tol, max] of [
  ['index', TOLERANCES.index, maxIndexDelta],
  ['score', TOLERANCES.score, maxScoreDelta],
  ['split', TOLERANCES.split, maxSplitDelta],
] as const) {
  if (max > tol) {
    const w = worst(kind)!;
    reasons.push(
      `${kind}: max delta ${max.toFixed(4)} exceeds tolerance ${tol}` +
        ` (${w.market}${w.metricKey ? ' · ' + w.metricKey : ''}:` +
        ` computed ${w.computed.toFixed(4)} vs workbook ${w.workbook.toFixed(4)})`
    );
  }
}
return { checks, maxIndexDelta, maxScoreDelta, maxSplitDelta, ok: reasons.length === 0, reasons };
```

(Note `ok` is now derived from `reasons` — identical truth table to the old expression.)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run` — all tests (old + new) PASS. The Egypt/AlUla oracle tests are the proof the refactor changed nothing.

- [ ] **Step 6: Commit**

```bash
git add lib/parser/detect.ts lib/parser/detect.test.ts lib/parser/verify.ts lib/parser/verify.test.ts
git commit -m "feat(parser): near-miss diagnostics and verify failure reasons"
```

---

### Task 6: Workbook storage helpers

**Files:**
- Create: `decoder-platform/lib/storage/workbooks.ts`
- Test: `decoder-platform/lib/storage/workbooks.test.ts`

**Interfaces:**
- Consumes: `serviceClient()` from `lib/supabase/admin.ts`.
- Produces:
  - `validateWorkbookFile(bytes: Uint8Array): string | null` — pure; returns an error message or null.
  - `draftWorkbookPath(slug: string): string` → `` `${slug}/draft.xlsx` ``
  - `putDraftWorkbook(slug: string, bytes: Uint8Array): Promise<string>` — validates, uploads (upsert), returns the path.
  - `downloadDraftWorkbook(slug: string): Promise<Uint8Array>`
  - `copyDraftToRevision(slug: string, revision: number): Promise<string>` — returns `` `${slug}/rev-${revision}.xlsx` ``
  - `removeDraftWorkbook(slug: string): Promise<void>`
  - `MAX_WORKBOOK_BYTES = 10 * 1024 * 1024`

- [ ] **Step 1: Write the failing tests** (pure validation + mocked storage)

```ts
// lib/storage/workbooks.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storageApi = {
  upload: vi.fn().mockResolvedValue({ error: null }),
  download: vi.fn(),
  copy: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
};
vi.mock('../supabase/admin', () => ({
  serviceClient: () => ({ storage: { from: () => storageApi } }),
}));

import {
  validateWorkbookFile, putDraftWorkbook, copyDraftToRevision, MAX_WORKBOOK_BYTES,
} from './workbooks';

const XLSX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);

describe('validateWorkbookFile', () => {
  it('accepts zip-magic bytes', () => expect(validateWorkbookFile(XLSX_BYTES)).toBeNull());
  it('rejects wrong magic', () =>
    expect(validateWorkbookFile(new Uint8Array([1, 2, 3, 4]))).toMatch(/not an \.xlsx/i));
  it('rejects oversize', () => {
    const big = new Uint8Array(MAX_WORKBOOK_BYTES + 1);
    big.set(XLSX_BYTES);
    expect(validateWorkbookFile(big)).toMatch(/10 ?MB/i);
  });
});

describe('putDraftWorkbook', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uploads to <slug>/draft.xlsx with upsert', async () => {
    const path = await putDraftWorkbook('egypt', XLSX_BYTES);
    expect(path).toBe('egypt/draft.xlsx');
    expect(storageApi.upload).toHaveBeenCalledWith('egypt/draft.xlsx', XLSX_BYTES, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });
  });
  it('throws on invalid bytes before touching storage', async () => {
    await expect(putDraftWorkbook('egypt', new Uint8Array([9]))).rejects.toThrow(/not an \.xlsx/i);
    expect(storageApi.upload).not.toHaveBeenCalled();
  });
});

describe('copyDraftToRevision', () => {
  it('removes any stale target then copies', async () => {
    const path = await copyDraftToRevision('egypt', 3);
    expect(path).toBe('egypt/rev-3.xlsx');
    expect(storageApi.remove).toHaveBeenCalledWith(['egypt/rev-3.xlsx']);
    expect(storageApi.copy).toHaveBeenCalledWith('egypt/draft.xlsx', 'egypt/rev-3.xlsx');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/storage/workbooks.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/storage/workbooks.ts — server-only (service role)
import { serviceClient } from '../supabase/admin';

export const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
const BUCKET = 'workbooks';
const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function validateWorkbookFile(bytes: Uint8Array): string | null {
  // xlsx is a zip: PK\x03\x04
  const [a, b, c, d] = bytes;
  if (a !== 0x50 || b !== 0x4b || c !== 0x03 || d !== 0x04)
    return 'not an .xlsx file (bad file signature)';
  if (bytes.length > MAX_WORKBOOK_BYTES) return 'file exceeds the 10 MB limit';
  return null;
}

export function draftWorkbookPath(slug: string): string {
  return `${slug}/draft.xlsx`;
}

function bucket() {
  return serviceClient().storage.from(BUCKET);
}

export async function putDraftWorkbook(slug: string, bytes: Uint8Array): Promise<string> {
  const invalid = validateWorkbookFile(bytes);
  if (invalid) throw new Error(invalid);
  const path = draftWorkbookPath(slug);
  const { error } = await bucket().upload(path, bytes, {
    contentType: XLSX_CONTENT_TYPE,
    upsert: true,
  });
  if (error) throw new Error(`workbook upload failed: ${error.message}`);
  return path;
}

export async function downloadDraftWorkbook(slug: string): Promise<Uint8Array> {
  const { data, error } = await bucket().download(draftWorkbookPath(slug));
  if (error || !data) throw new Error(`workbook download failed: ${error?.message ?? 'no data'}`);
  return new Uint8Array(await data.arrayBuffer());
}

export async function copyDraftToRevision(slug: string, revision: number): Promise<string> {
  const target = `${slug}/rev-${revision}.xlsx`;
  await bucket().remove([target]); // stale target from a failed prior attempt; ignore result
  const { error } = await bucket().copy(draftWorkbookPath(slug), target);
  if (error) throw new Error(`workbook promote failed: ${error.message}`);
  return target;
}

export async function removeDraftWorkbook(slug: string): Promise<void> {
  await bucket().remove([draftWorkbookPath(slug)]); // best-effort cleanup
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/storage/workbooks.test.ts` — PASS. Then `npx vitest run` — suite green.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/workbooks.ts lib/storage/workbooks.test.ts
git commit -m "feat: workbook storage helpers (draft put/download/promote)"
```

---

### Task 7: Store — drafts, race-safe publish, tweaks

**Files:**
- Modify: `decoder-platform/lib/versions/store.ts`
- Test: extend `decoder-platform/lib/versions/store.test.ts` (follow its existing `vi.mock('../supabase/admin', ...)` pattern — read the file first and reuse its mock builder)

**Interfaces:**
- Consumes: `copyDraftToRevision`, `removeDraftWorkbook` from `lib/storage/workbooks.ts`; `validateConfig`; `VerificationReport` from `lib/parser/verify.ts`.
- Produces (all in `lib/versions/store.ts`):

```ts
export interface DraftRecord {
  slug: string;
  name: string;
  config: VersionConfig;
  workbookPath: string;
  sourceSheet: string | null;
  sourceIndex: number;
  verify: VerificationReport | null;
  updatedAt: string;
}
export interface VersionSummary {
  slug: string; name: string; currency: string; status: string; updatedAt: string;
}
export interface TweakInput {
  defaultBudget?: number;
  currency?: string;
  marketEnabled?: Record<string, boolean>;   // by market name
  weights?: Record<string, number>;          // by metric key
}
export async function saveDraft(d: Omit<DraftRecord, 'updatedAt'> & { createdBy?: string | null }): Promise<void>
export async function getDraft(slug: string): Promise<DraftRecord | null>
export async function listDrafts(): Promise<DraftRecord[]>
export async function deleteDraft(slug: string): Promise<void>          // row + draft workbook file
export async function listVersions(): Promise<VersionSummary[]>
export async function publishDraft(slug: string, opts?: { createdBy?: string | null }): Promise<{ revision: number }>
export async function applyTweaks(slug: string, tweaks: TweakInput, opts?: { createdBy?: string | null }): Promise<{ revision: number }>
// publishVersion gains a per-revision workbook path hook:
export async function publishVersion(
  config: VersionConfig,
  opts?: {
    workbookPath?: string | null;
    createdBy?: string | null;
    workbookPathFor?: (revision: number) => Promise<string | null>;
  }
): Promise<{ id: number; revision: number }>
```

- [ ] **Step 1: Write the failing tests** (extend `store.test.ts`; use its existing supabase mock, adding `version_drafts` table handling and a way to make the first `version_revisions` insert fail with `{ code: '23505' }`)

Cases to cover — write each as real test code against the mock:

```ts
it('saveDraft upserts by slug and getDraft round-trips the config');
it('getDraft returns null for a missing slug');
it('publishDraft publishes the draft config, names the workbook rev-<n>, and deletes the draft', async () => {
  // seed mock: draft for 'egypt' with valid config; versions empty
  const { revision } = await publishDraft('egypt');
  expect(revision).toBe(1);
  // assert: versions upserted with status published; revision row has
  // workbook_path 'egypt/rev-1.xlsx'; draft row deleted; removeDraftWorkbook called
});
it('publishDraft throws and leaves the draft row intact when the version upsert fails');
it('publishVersion retries once on a 23505 revision race and lands on the next number', async () => {
  // mock: revision select returns 1; first insert rejects {code:'23505'},
  // second select returns 2, second insert succeeds
  const { revision } = await publishVersion(validConfig, {});
  expect(revision).toBe(3);
});
it('applyTweaks toggles markets, patches weights/budget/currency, and appends a revision carrying the previous workbook_path');
it('applyTweaks rejects an unknown metric key or market name', async () => {
  await expect(applyTweaks('egypt', { weights: { nope: 5 } })).rejects.toThrow(/unknown metric/i);
});
```

Mock `../storage/workbooks` in this file (`copyDraftToRevision: vi.fn(async (s, n) => `${s}/rev-${n}.xlsx`)`, `removeDraftWorkbook: vi.fn()`), so store tests never touch real storage.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/versions/store.test.ts` — FAIL on the new cases (existing cases still pass).

- [ ] **Step 3: Implement**

Key implementation code (row mapping is `snake_case` ↔ `camelCase`):

```ts
function draftFromRow(row: Record<string, unknown>): DraftRecord {
  const v = validateConfig(row.config);
  if (!v.ok) throw new Error(`stored draft config for "${row.slug}" is invalid: ${v.errors.join('; ')}`);
  return {
    slug: row.slug as string,
    name: row.name as string,
    config: v.config,
    workbookPath: row.workbook_path as string,
    sourceSheet: (row.source_sheet as string) ?? null,
    sourceIndex: (row.source_index as number) ?? 0,
    verify: (row.verify as VerificationReport) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export async function saveDraft(d: Omit<DraftRecord, 'updatedAt'> & { createdBy?: string | null }) {
  const db = serviceClient();
  const { error } = await db.from('version_drafts').upsert(
    {
      slug: d.slug,
      name: d.name,
      config: d.config,
      workbook_path: d.workbookPath,
      source_sheet: d.sourceSheet,
      source_index: d.sourceIndex,
      verify: d.verify,
      created_by: d.createdBy ?? null,
    },
    { onConflict: 'slug' }
  );
  if (error) throw new Error(`draft save failed: ${error.message}`);
}
```

`publishVersion` — wrap the revision lookup+insert in an attempt loop:

```ts
for (let attempt = 0; attempt < 2; attempt++) {
  const { data: last, error: lastErr } = await db
    .from('version_revisions')
    .select('revision')
    .eq('version_id', version.id)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`revision lookup failed: ${lastErr.message}`);
  const revision = (last?.revision ?? 0) + 1;
  const workbookPath = opts.workbookPathFor
    ? await opts.workbookPathFor(revision)
    : opts.workbookPath ?? null;
  const { error: revErr } = await db.from('version_revisions').insert({
    version_id: version.id,
    revision,
    config,
    workbook_path: workbookPath,
    created_by: opts.createdBy ?? null,
  });
  if (!revErr) return { id: version.id as number, revision };
  if (revErr.code !== '23505' || attempt === 1)
    throw new Error(`revision insert failed: ${revErr.message}`);
  // 23505: another publish landed this revision number first — retry once.
}
```

```ts
export async function publishDraft(slug: string, opts: { createdBy?: string | null } = {}) {
  const draft = await getDraft(slug);
  if (!draft) throw new Error(`no draft for "${slug}"`);
  const { revision } = await publishVersion(draft.config, {
    createdBy: opts.createdBy,
    workbookPathFor: (rev) => copyDraftToRevision(slug, rev),
  });
  // Only after the publish fully succeeded: clean up. Failures above leave
  // the draft untouched for retry.
  await removeDraftWorkbook(slug);
  await deleteDraftRow(slug); // helper: delete from version_drafts by slug, throw on error
  return { revision };
}

export async function applyTweaks(slug: string, tweaks: TweakInput, opts: { createdBy?: string | null } = {}) {
  const config = await getPublishedConfig(slug);
  if (!config) throw new Error(`no published version for "${slug}"`);
  const next: VersionConfig = structuredClone(config);
  if (tweaks.defaultBudget !== undefined) next.defaultBudget = tweaks.defaultBudget;
  if (tweaks.currency !== undefined) next.currency = tweaks.currency;
  for (const [key, w] of Object.entries(tweaks.weights ?? {})) {
    const m = next.metrics.find((m) => m.key === key);
    if (!m) throw new Error(`unknown metric key: ${key}`);
    m.weight = w;
  }
  for (const [name, enabled] of Object.entries(tweaks.marketEnabled ?? {})) {
    const mk = next.markets.find((m) => m.name === name);
    if (!mk) throw new Error(`unknown market: ${name}`);
    mk.enabled = enabled;
  }
  const v = validateConfig(next);
  if (!v.ok) throw new Error(`tweaked config invalid: ${v.errors.join('; ')}`);

  // Carry the last revision's workbook forward — tweaks have no new file.
  const db = serviceClient();
  const { data: verRow } = await db.from('versions').select('id').eq('slug', slug).single();
  const { data: lastRev } = await db
    .from('version_revisions')
    .select('workbook_path')
    .eq('version_id', verRow!.id)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  return publishVersion(v.config, {
    createdBy: opts.createdBy,
    workbookPath: lastRev?.workbook_path ?? null,
  }).then(({ revision }) => ({ revision }));
}
```

`listVersions` absorbs the query currently inlined in `app/admin/page.tsx` (select `slug, name, currency, status, updated_at` ordered by `updated_at` desc, mapped to `VersionSummary`).

- [ ] **Step 4: Run the suite**

Run: `npx vitest run` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/versions/store.ts lib/versions/store.test.ts
git commit -m "feat(store): drafts, race-safe publish with workbook promotion, tweaks"
```

---

### Task 8: Upload core — pure detect/assemble/edit functions

The server actions must stay thin; everything testable lives here. This is where the Egypt-workbook oracle proves the whole upload path.

**Files:**
- Create: `decoder-platform/lib/admin/upload-core.ts`
- Test: `decoder-platform/lib/admin/upload-core.test.ts`

**Interfaces:**
- Consumes: `loadWorkbookGrids` (`lib/parser/grid.ts`), `findModelBlocksDetailed`, `NearMiss` (`lib/parser/detect.ts`), `assembleConfig`, `AssembleOptions` (`lib/parser/assemble.ts`), `verifyAgainstWorkbook`, `VerificationReport` (`lib/parser/verify.ts`), `validateConfig`.
- Produces:

```ts
export interface CandidateSummary {
  index: number; sheetName: string; marketCount: number; metricCount: number; headers: string[];
}
export interface DraftBase {
  slug: string; name: string; currency?: string; defaultBudget?: number;
}
export interface BuiltDraft {
  config: VersionConfig;
  warnings: string[];
  verify: VerificationReport;
  sourceSheet: string;
  sourceIndex: number;
}
export interface DraftEdits {
  name?: string; currency?: string; defaultBudget?: number;
  weights?: Record<string, number>;
  directions?: Record<string, 'higher' | 'lower'>;
  labels?: Record<string, string>;
  marketEnabled?: Record<string, boolean>;
}
export function detectCandidates(bytes: Uint8Array): { candidates: ModelBlockCandidate[]; nearMisses: NearMiss[] }
export function candidateSummaries(candidates: ModelBlockCandidate[]): CandidateSummary[]
export function buildDraft(candidates: ModelBlockCandidate[], index: number, base: DraftBase):
  { ok: true; draft: BuiltDraft } | { ok: false; errors: string[] }
export function applyDraftEdits(config: VersionConfig, edits: DraftEdits):
  { ok: true; config: VersionConfig } | { ok: false; errors: string[] }
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/admin/upload-core.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectCandidates, candidateSummaries, buildDraft, applyDraftEdits } from './upload-core';

// Reuse the exact workbook paths the parser tests already use — copy the
// path constants from lib/parser/assemble.test.ts rather than inventing new ones.
const egyptBytes = new Uint8Array(
  readFileSync(join(__dirname, '../../../egypt-decoder/source/Egypt_decoder.xlsx'))
);

describe('detectCandidates + buildDraft (Egypt oracle)', () => {
  it('detects at least one block and assembles a valid config', () => {
    const { candidates } = detectCandidates(egyptBytes);
    expect(candidates.length).toBeGreaterThan(0);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.draft.config.slug).toBe('egypt');
    expect(built.draft.config.markets.length).toBeGreaterThanOrEqual(15);
    expect(built.draft.verify.ok).toBe(true);          // reproduces the workbook
    expect(built.draft.sourceIndex).toBe(0);
  });
  it('defaults budget/currency from the workbook when base omits them', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    expect(built.draft.config.defaultBudget).toBeGreaterThan(0);
    expect(built.draft.config.currency).toMatch(/^[A-Z]{3}$/);
  });
});

describe('detectCandidates on garbage', () => {
  it('yields no candidates and does not throw on a minimal non-model xlsx', async () => {
    // Build a real tiny xlsx in-memory with SheetJS so the zip signature is valid.
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['hello', 'world']]), 'S');
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    const { candidates, nearMisses } = detectCandidates(bytes);
    expect(candidates).toHaveLength(0);
    expect(Array.isArray(nearMisses)).toBe(true);
  });
});

describe('applyDraftEdits', () => {
  it('patches weight/direction/enabled and re-validates', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const key = built.draft.config.metrics[0].key;
    const marketName = built.draft.config.markets[0].name;
    const edited = applyDraftEdits(built.draft.config, {
      weights: { [key]: 42 },
      directions: { [key]: 'lower' },
      marketEnabled: { [marketName]: false },
      defaultBudget: 5_000_000,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.config.metrics[0].weight).toBe(42);
    expect(edited.config.metrics[0].direction).toBe('lower');
    expect(edited.config.markets[0].enabled).toBe(false);
    expect(edited.config.defaultBudget).toBe(5_000_000);
  });
  it('rejects unknown keys', () => {
    const { candidates } = detectCandidates(egyptBytes);
    const built = buildDraft(candidates, 0, { slug: 'egypt', name: 'Egypt Decoder' });
    if (!built.ok) throw new Error('build failed');
    const edited = applyDraftEdits(built.draft.config, { weights: { doesNotExist: 1 } });
    expect(edited.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/admin/upload-core.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/admin/upload-core.ts — pure functions; no supabase, no next.
import { loadWorkbookGrids } from '../parser/grid';
import { findModelBlocksDetailed, ModelBlockCandidate, NearMiss } from '../parser/detect';
import { assembleConfig } from '../parser/assemble';
import { verifyAgainstWorkbook, VerificationReport } from '../parser/verify';
import { validateConfig } from '../config/validate';
import { VersionConfig } from '../config/types';

// (interfaces exactly as in the Interfaces block above)

export function detectCandidates(bytes: Uint8Array) {
  return findModelBlocksDetailed(loadWorkbookGrids(bytes));
}

export function candidateSummaries(candidates: ModelBlockCandidate[]): CandidateSummary[] {
  return candidates.map((c, index) => ({
    index,
    sheetName: c.sheetName,
    marketCount: c.markets.length,
    metricCount: c.headers.length,
    headers: c.headers,
  }));
}

export function buildDraft(
  candidates: ModelBlockCandidate[],
  index: number,
  base: DraftBase
): { ok: true; draft: BuiltDraft } | { ok: false; errors: string[] } {
  const candidate = candidates[index];
  if (!candidate) return { ok: false, errors: [`no candidate at index ${index}`] };
  const result = assembleConfig(candidate, {
    slug: base.slug,
    name: base.name,
    currency: base.currency ?? candidate.budget?.currency ?? 'USD',
    defaultBudget: base.defaultBudget ?? candidate.budget?.amount ?? 1_000_000,
  });
  if (!result.config) return { ok: false, errors: result.errors };
  return {
    ok: true,
    draft: {
      config: result.config,
      warnings: result.warnings,
      verify: verifyAgainstWorkbook(result.config, candidate),
      sourceSheet: candidate.sheetName,
      sourceIndex: index,
    },
  };
}

export function applyDraftEdits(
  config: VersionConfig,
  edits: DraftEdits
): { ok: true; config: VersionConfig } | { ok: false; errors: string[] } {
  const next: VersionConfig = structuredClone(config);
  if (edits.name !== undefined) next.name = edits.name;
  if (edits.currency !== undefined) next.currency = edits.currency;
  if (edits.defaultBudget !== undefined) next.defaultBudget = edits.defaultBudget;
  for (const [key, patch] of [
    ['weights', (m: (typeof next.metrics)[0], v: number) => (m.weight = v)],
    ['directions', (m: (typeof next.metrics)[0], v: 'higher' | 'lower') => (m.direction = v)],
    ['labels', (m: (typeof next.metrics)[0], v: string) => (m.label = v)],
  ] as const) {
    for (const [k, v] of Object.entries(edits[key] ?? {})) {
      const metric = next.metrics.find((m) => m.key === k);
      if (!metric) return { ok: false, errors: [`unknown metric key: ${k}`] };
      patch(metric, v as never);
    }
  }
  for (const [name, enabled] of Object.entries(edits.marketEnabled ?? {})) {
    const market = next.markets.find((m) => m.name === name);
    if (!market) return { ok: false, errors: [`unknown market: ${name}`] };
    market.enabled = enabled;
  }
  const v = validateConfig(next);
  return v.ok ? { ok: true, config: v.config } : { ok: false, errors: v.errors };
}
```

- [ ] **Step 4: Run the suite**

Run: `npx vitest run` — all PASS (Egypt oracle proves upload-path fidelity end to end).

- [ ] **Step 5: Commit**

```bash
git add lib/admin/upload-core.ts lib/admin/upload-core.test.ts
git commit -m "feat(admin): pure upload core — detect, build draft, apply edits"
```

---

### Task 9: Admin home — versions + drafts list

Replaces the placeholder page. UI-only task; logic already exists in the store.

**Files:**
- Modify: `decoder-platform/app/admin/page.tsx`

**Interfaces:**
- Consumes: `listVersions()`, `listDrafts()` from `lib/versions/store.ts`; `getAccess` from `lib/auth/require.ts`; `deleteDraftAction` comes later (Task 10's actions file) — for now render drafts without the delete button if the action doesn't exist yet, and add the button in Task 10.

- [ ] **Step 1: Rewrite the page**

Keep the existing glass-card styling idiom and the admin check verbatim (`getAccess()` → `redirect('/login')`). Structure:

```tsx
// app/admin/page.tsx (server component; keep `export const dynamic = 'force-dynamic'`)
// - heading "Admin"
// - action row: <Link href="/admin/upload">New version / update</Link>, <Link href="/admin/users">Users</Link>
// - section "Published versions": rows from listVersions().filter(v => v.status === 'published')
//     each row: name, slug, currency, updated date, links:
//       Open → /{slug}   ·   Tweaks → /admin/{slug}/tweaks
// - section "Drafts" (only when listDrafts() non-empty): rows: name, slug, updated date, links:
//       Resume → /admin/{slug}/confirm   ·   Preview → /admin/{slug}/preview
// - the existing sign-out form stays at the bottom
```

Remove the page's inline `loadVersions()` and its "Version management arrives in the next release" line — `listVersions()` from the store replaces the query.

- [ ] **Step 2: Verify it renders**

Run: `npm run dev` and open http://localhost:3000/admin (sign in as the admin user). Expected: the egypt version listed under Published with Open/Tweaks links (Tweaks 404s until Task 13 — fine), empty Drafts section hidden, no console errors.

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc --noEmit && npx vitest run` — clean.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): versions and drafts list replaces placeholder"
```

---

### Task 10: Upload flow — form, action, candidate picker

**Files:**
- Create: `decoder-platform/app/admin/actions.ts` (shared `'use server'` file for all admin actions; later tasks extend it)
- Create: `decoder-platform/app/admin/upload/page.tsx`
- Create: `decoder-platform/app/admin/[slug]/choose/page.tsx`
- Modify: `decoder-platform/app/admin/page.tsx` (add draft Delete button)

**Interfaces:**
- Consumes: `putDraftWorkbook`, `downloadDraftWorkbook` (Task 6); `detectCandidates`, `candidateSummaries`, `buildDraft` (Task 8); `saveDraft`, `getDraft`, `deleteDraft`, `listVersions`, `getPublishedConfig` (Task 7); `getAccess` (existing).
- Produces (in `app/admin/actions.ts`):

```ts
export interface AdminActionState { error?: string; nearMisses?: { sheetName: string; row: number; reason: string }[] }
export async function uploadWorkbookAction(prev: AdminActionState, formData: FormData): Promise<AdminActionState>
export async function pickCandidateAction(formData: FormData): Promise<void>  // redirects
export async function deleteDraftAction(formData: FormData): Promise<void>    // redirects
async function requireAdmin(): Promise<{ userId: string }>                    // shared guard, not exported
```

- [ ] **Step 1: Implement the shared guard and upload action**

```ts
// app/admin/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getAccess } from '@/lib/auth/require';
import { serverClient } from '@/lib/supabase/server';
import { putDraftWorkbook, downloadDraftWorkbook } from '@/lib/storage/workbooks';
import { detectCandidates, buildDraft } from '@/lib/admin/upload-core';
import { saveDraft, deleteDraft, getPublishedConfig } from '@/lib/versions/store';

const SLUG_RE = /^[a-z0-9-]+$/;

async function requireAdmin(): Promise<{ userId: string }> {
  const access = await getAccess();
  if (!access || access.role !== 'admin') redirect('/login');
  const supabase = await serverClient();
  const { data } = await supabase.auth.getClaims();
  return { userId: String(data?.claims?.sub ?? '') };
}

export async function uploadWorkbookAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();

  const target = String(formData.get('target') ?? 'new');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an .xlsx file.' };

  let slug: string;
  let name: string;
  let base: { currency?: string; defaultBudget?: number } = {};
  if (target === 'existing') {
    slug = String(formData.get('existingSlug') ?? '');
    const published = await getPublishedConfig(slug).catch(() => null);
    if (!published) return { error: `No published version "${slug}".` };
    name = published.name;
    base = { currency: published.currency, defaultBudget: published.defaultBudget };
  } else {
    slug = String(formData.get('slug') ?? '').trim();
    name = String(formData.get('name') ?? '').trim();
    if (!SLUG_RE.test(slug)) return { error: 'Slug must match a-z, 0-9, hyphens.' };
    if (!name) return { error: 'Name is required.' };
    if (await getPublishedConfig(slug).catch(() => null))
      return { error: `"${slug}" is already published — use "Update existing".` };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    await putDraftWorkbook(slug, bytes);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' };
  }

  const { candidates, nearMisses } = detectCandidates(bytes);
  if (candidates.length === 0)
    return { error: 'No model block found in this workbook.', nearMisses };
  if (candidates.length > 1)
    redirect(`/admin/${slug}/choose?name=${encodeURIComponent(name)}`);

  const built = buildDraft(candidates, 0, { slug, name, ...base });
  if (!built.ok) return { error: `Workbook parsed but config invalid: ${built.errors.join('; ')}` };
  await saveDraft({
    slug,
    name,
    config: built.draft.config,
    workbookPath: `${slug}/draft.xlsx`,
    sourceSheet: built.draft.sourceSheet,
    sourceIndex: built.draft.sourceIndex,
    verify: built.draft.verify,
    createdBy: userId || null,
  });
  redirect(`/admin/${slug}/confirm`);
}

export async function pickCandidateAction(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');
  const name = String(formData.get('name') ?? '');
  const index = Number(formData.get('index') ?? 0);
  const bytes = await downloadDraftWorkbook(slug);
  const { candidates } = detectCandidates(bytes);
  const published = await getPublishedConfig(slug).catch(() => null);
  const built = buildDraft(candidates, index, {
    slug,
    name: name || published?.name || slug,
    currency: published?.currency,
    defaultBudget: published?.defaultBudget,
  });
  if (!built.ok) throw new Error(built.errors.join('; '));
  await saveDraft({
    slug,
    name: name || published?.name || slug,
    config: built.draft.config,
    workbookPath: `${slug}/draft.xlsx`,
    sourceSheet: built.draft.sourceSheet,
    sourceIndex: built.draft.sourceIndex,
    verify: built.draft.verify,
    createdBy: userId || null,
  });
  redirect(`/admin/${slug}/confirm`);
}

export async function deleteDraftAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteDraft(String(formData.get('slug') ?? ''));
  revalidatePath('/admin');
  redirect('/admin');
}
```

- [ ] **Step 2: Build the upload page**

`app/admin/upload/page.tsx` — server component wrapping a small client form (`useActionState(uploadWorkbookAction, {})`, pattern copied from `app/login/page.tsx`'s form). Fields:
- radio `target`: **New version** (text inputs `slug`, `name`) / **Update existing** (`<select name="existingSlug">` fed by `listVersions()` passed from the server component; note next to it: "uploading replaces any pending draft for that slug")
- `<input type="file" name="file" accept=".xlsx" />`
- error display: `state.error`, and when `state.nearMisses` is set, a list: `Sheet "X" row N: reason` under the heading "Where detection almost matched:".

- [ ] **Step 3: Build the candidate picker page**

`app/admin/[slug]/choose/page.tsx` — server component: admin check, `const bytes = await downloadDraftWorkbook(slug)` → `candidateSummaries(detectCandidates(bytes).candidates)`; render each as a card: sheet name, `N markets · M metrics`, first ~6 headers joined; each card is a form posting `pickCandidateAction` with hidden `slug`, `name` (from `searchParams`), `index`.

- [ ] **Step 4: Add the Delete button to draft rows in `/admin`**

Each draft row gets a small form posting `deleteDraftAction` with hidden `slug` and `formAction` confirm styling consistent with the sign-out button.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, sign in as admin:
1. Upload `../egypt-decoder/source/Egypt_decoder.xlsx` as new slug `egypt-test`, name "Egypt Test". Expected: lands on `/admin/egypt-test/confirm` (404 until Task 11 — the redirect itself plus a `version_drafts` row in Supabase proves the action; check the table and the `workbooks` bucket for `egypt-test/draft.xlsx`).
2. Upload a random non-model xlsx. Expected: error with near-miss list (or plain "no model block"), no draft row.
3. Delete the `egypt-test` draft from `/admin`. Expected: row and workbook gone.

- [ ] **Step 6: Typecheck + suite, commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/admin
git commit -m "feat(admin): upload flow with candidate picker and draft delete"
```

---

### Task 11: Confirm screen — edit, save draft, publish

**Files:**
- Create: `decoder-platform/app/admin/[slug]/confirm/page.tsx`
- Create: `decoder-platform/app/admin/[slug]/confirm/confirm-form.tsx` (client component)
- Modify: `decoder-platform/app/admin/actions.ts` (two actions)

**Interfaces:**
- Consumes: `getDraft`, `saveDraft`, `publishDraft` (Task 7); `applyDraftEdits`, `detectCandidates` (Task 8); `downloadDraftWorkbook` (Task 6); `verifyAgainstWorkbook` (Task 5).
- Produces (in `app/admin/actions.ts`):

```ts
export async function saveDraftEditsAction(prev: AdminActionState, formData: FormData): Promise<AdminActionState>
export async function publishDraftAction(prev: AdminActionState, formData: FormData): Promise<AdminActionState>
```

- [ ] **Step 1: Implement the two actions**

Both share an edit-collection helper in the actions file:

```ts
function editsFromForm(formData: FormData, config: VersionConfig): DraftEdits {
  const edits: DraftEdits = {
    name: String(formData.get('name') ?? '') || undefined,
    currency: String(formData.get('currency') ?? '') || undefined,
    defaultBudget: Number(formData.get('defaultBudget')) || undefined,
    weights: {}, directions: {}, labels: {}, marketEnabled: {},
  };
  for (const m of config.metrics) {
    edits.weights![m.key] = Number(formData.get(`weight:${m.key}`) ?? m.weight);
    const dir = String(formData.get(`direction:${m.key}`) ?? m.direction);
    edits.directions![m.key] = dir === 'lower' ? 'lower' : 'higher';
    edits.labels![m.key] = String(formData.get(`label:${m.key}`) ?? m.label);
  }
  for (const mk of config.markets) {
    // checkboxes: present in formData only when checked
    edits.marketEnabled![mk.name] = formData.get(`market:${mk.name}`) === 'on';
  }
  return edits;
}
```

`saveDraftEditsAction`: `requireAdmin` → `getDraft(slug)` (error if gone) → `applyDraftEdits(draft.config, editsFromForm(...))` (return `{error}` on `!ok`) → recompute verify against the stored workbook:

```ts
const bytes = await downloadDraftWorkbook(slug);
const { candidates } = detectCandidates(bytes);
const candidate = candidates[draft.sourceIndex];
const verify = candidate ? verifyAgainstWorkbook(edited.config, candidate) : null;
await saveDraft({ ...draft, name: edited.config.name, config: edited.config, verify });
redirect('/admin');
```

`publishDraftAction`: `requireAdmin` → run the same edit-apply-and-save as above (so unsaved form edits are never silently dropped on publish), then:

```ts
try {
  await publishDraft(slug, { createdBy: userId || null });
} catch (e) {
  // Draft row is intact by construction (publishDraft cleans up only after success).
  return { error: e instanceof Error ? e.message : 'Publish failed.' };
}
revalidatePath('/' + slug);
revalidatePath('/admin');
redirect('/' + slug);
```

- [ ] **Step 2: Build the confirm page**

`page.tsx` (server): admin check → `getDraft(slug)` → `notFound()` if none → render `<ConfirmForm draft={...} />` passing the draft plus `verify`.

`confirm-form.tsx` (client, `useActionState` twice — one per button is simplest: two `<form>`s sharing inputs via `form` attribute, or a single form with two submit buttons and a hidden `intent` field routed inside one action; **use the two-action pattern with `formAction={...}` submit buttons on one form** — App Router supports per-button `formAction` with server actions). Sections:
- Header: name (text input), slug (read-only), currency (text input, 3 chars), defaultBudget (number input).
- Metrics table: one row per metric — label input `label:<key>`, weight input `weight:<key>` (step any), direction select `direction:<key>` (`higher` / `lower`), source (read-only text). A footnote: "Direction was auto-guessed — a wrong direction silently poisons scores."
- Markets: checkbox grid `market:<name>`, checked from `enabled`, name + resolved iso2 (or "no map pin" badge when `iso2 === null`).
- Verify panel: when `verify.ok` → "matches workbook ✓ (N checks)". When not → the `reasons` list, then a details table of the worst 20 checks sorted by delta desc: market, kind, metricKey, computed vs workbook, delta. Note under it: "Diffs are expected after you edit weights — the comparison is against the workbook as uploaded."
- Buttons: **Save draft** (`formAction={saveDraftEditsAction}`) · **Publish** (`formAction={publishDraftAction}`) · link "Preview dashboard" → `/admin/{slug}/preview`.

- [ ] **Step 3: Manual verification**

Dev server, as admin: upload Egypt workbook as `egypt-test` → confirm screen shows ~25 markets, metrics with weights, "matches workbook ✓". Toggle a market off, Save draft → back on `/admin`, Resume shows the toggle persisted. Publish → redirected to `/egypt-test` rendering the dashboard; Supabase: `versions` row published, `version_revisions` rev 1 with `workbook_path egypt-test/rev-1.xlsx`, bucket has `rev-1.xlsx`, no `draft.xlsx`, draft row gone.

- [ ] **Step 4: Typecheck + suite, commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/admin
git commit -m "feat(admin): confirm screen with edits, verify panel, save-draft and publish"
```

---

### Task 12: Draft preview — the real dashboard on the draft config

**Files:**
- Create: `decoder-platform/app/admin/[slug]/preview/page.tsx`

**Interfaces:**
- Consumes: `getDraft` (Task 7), `deriveDashboard` (`lib/dashboard/derive.ts`), `DashboardClient` (`app/[slug]/dashboard-client.tsx`), `getAccess`.

- [ ] **Step 1: Implement**

```tsx
// app/admin/[slug]/preview/page.tsx
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
```

(If `DashboardClient`'s default export isn't importable across route groups, re-export it from a shared location — but it's a plain component file, so the direct import works.)

- [ ] **Step 2: Manual verification**

With an `egypt-test` draft pending: `/admin/egypt-test/preview` renders the full dashboard (tabs, charts, allocations) under the amber banner; `/egypt-test` still 404s (not published). A viewer account gets bounced by the proxy.

- [ ] **Step 3: Typecheck, commit**

```bash
npx tsc --noEmit
git add app/admin
git commit -m "feat(admin): full dashboard preview of draft configs"
```

---

### Task 13: Quick tweaks page

**Files:**
- Create: `decoder-platform/app/admin/[slug]/tweaks/page.tsx` (server) + `tweaks-form.tsx` (client)
- Modify: `decoder-platform/app/admin/actions.ts` (one action)

**Interfaces:**
- Consumes: `getPublishedConfig`, `applyTweaks` (Task 7).
- Produces: `export async function applyTweaksAction(prev: AdminActionState, formData: FormData): Promise<AdminActionState>`

- [ ] **Step 1: Implement the action**

```ts
export async function applyTweaksAction(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { userId } = await requireAdmin();
  const slug = String(formData.get('slug') ?? '');
  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) return { error: `No published version "${slug}".` };
  const tweaks: TweakInput = {
    defaultBudget: Number(formData.get('defaultBudget')) || undefined,
    currency: String(formData.get('currency') ?? '') || undefined,
    weights: Object.fromEntries(
      config.metrics.map((m) => [m.key, Number(formData.get(`weight:${m.key}`) ?? m.weight)])
    ),
    marketEnabled: Object.fromEntries(
      config.markets.map((m) => [m.name, formData.get(`market:${m.name}`) === 'on'])
    ),
  };
  try {
    await applyTweaks(slug, tweaks, { createdBy: userId || null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Tweak failed.' };
  }
  revalidatePath('/' + slug);
  redirect('/' + slug);
}
```

- [ ] **Step 2: Build the page**

Server component: admin check → `getPublishedConfig(slug)` → `notFound()` if none → client form prefilled: budget, currency, per-metric weight inputs, per-market enabled checkboxes, hidden `slug`. Submit label: "Publish tweaks (new revision)". Error display from state. No parser, no labels/directions here — that's what re-upload is for (link to `/admin/upload` at the bottom: "Need to change data or metrics? Upload a new workbook.").

- [ ] **Step 3: Manual verification**

As admin on `egypt-test`: set a weight from its value to 0, publish tweaks → dashboard reflects the change; Supabase `version_revisions` shows rev 2 with the **same** `workbook_path` as rev 1 (`egypt-test/rev-1.xlsx`).

- [ ] **Step 4: Typecheck + suite, commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/admin
git commit -m "feat(admin): quick tweaks with instant revisioned publish"
```

---

### Task 14: Users library + script refactor

**Files:**
- Create: `decoder-platform/lib/users/admin.ts`
- Test: `decoder-platform/lib/users/admin.test.ts`
- Modify: `decoder-platform/scripts/create-user.ts` (thin wrapper over the lib)

**Interfaces:**
- Consumes: `serviceClient` (`lib/supabase/admin.ts`).
- Produces:

```ts
export interface PlatformUser {
  id: string;
  email: string | null;
  role: 'admin' | 'viewer' | null;
  slugs: string[];
  banned: boolean;
  lastSignInAt: string | null;
}
export function generatePassword(): string                       // 16+ chars, crypto-random
export async function listUsers(): Promise<PlatformUser[]>
export async function createViewer(input: { email: string; password: string; slugs: string[] }): Promise<PlatformUser>
export async function resetPassword(userId: string, password: string): Promise<void>
export async function setSlugs(userId: string, slugs: string[]): Promise<void>   // preserves role
export async function setActive(userId: string, active: boolean): Promise<void>  // ban/unban
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/users/admin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const adminApi = {
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getUserById: vi.fn(),
};
vi.mock('../supabase/admin', () => ({
  serviceClient: () => ({ auth: { admin: adminApi } }),
}));

import { listUsers, createViewer, setSlugs, setActive, generatePassword } from './admin';

const rawUser = (over: object = {}) => ({
  id: 'u1', email: 'v@x.test', last_sign_in_at: '2026-08-01T00:00:00Z',
  app_metadata: { role: 'viewer', allowed_slugs: ['egypt'] }, banned_until: null, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('generatePassword', () => {
  it('is long and random', () => {
    const p = generatePassword();
    expect(p.length).toBeGreaterThanOrEqual(16);
    expect(generatePassword()).not.toBe(p);
  });
});

describe('listUsers', () => {
  it('maps role, slugs, and banned state', async () => {
    adminApi.listUsers.mockResolvedValue({
      data: { users: [rawUser(), rawUser({ id: 'u2', banned_until: '2099-01-01T00:00:00Z', app_metadata: { role: 'admin' } })] },
      error: null,
    });
    const users = await listUsers();
    expect(users[0]).toMatchObject({ id: 'u1', role: 'viewer', slugs: ['egypt'], banned: false });
    expect(users[1]).toMatchObject({ id: 'u2', role: 'admin', slugs: [], banned: true });
  });
});

describe('createViewer', () => {
  it('creates with viewer role and slugs in app_metadata, email confirmed', async () => {
    adminApi.createUser.mockResolvedValue({ data: { user: rawUser() }, error: null });
    await createViewer({ email: 'v@x.test', password: 'pw-123456789012345', slugs: ['egypt'] });
    expect(adminApi.createUser).toHaveBeenCalledWith({
      email: 'v@x.test',
      password: 'pw-123456789012345',
      email_confirm: true,
      app_metadata: { role: 'viewer', allowed_slugs: ['egypt'] },
    });
  });
  it('rejects malformed slugs', async () => {
    await expect(createViewer({ email: 'v@x.test', password: 'x'.repeat(16), slugs: ['Bad Slug!'] }))
      .rejects.toThrow(/slug/i);
  });
});

describe('setSlugs', () => {
  it('preserves the existing role in app_metadata', async () => {
    adminApi.getUserById.mockResolvedValue({ data: { user: rawUser() }, error: null });
    await setSlugs('u1', ['egypt', 'alula']);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', {
      app_metadata: { role: 'viewer', allowed_slugs: ['egypt', 'alula'] },
    });
  });
});

describe('setActive', () => {
  it('bans with a long duration and unbans with none', async () => {
    await setActive('u1', false);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: '876000h' });
    await setActive('u1', true);
    expect(adminApi.updateUserById).toHaveBeenCalledWith('u1', { ban_duration: 'none' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/users/admin.test.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// lib/users/admin.ts — server-only (service role / Auth admin API)
import { randomBytes } from 'node:crypto';
import { serviceClient } from '../supabase/admin';

const SLUG_RE = /^[a-z0-9-]+$/;

// (PlatformUser interface as in the Interfaces block)

export function generatePassword(): string {
  return randomBytes(12).toString('base64url'); // 16 chars, no padding
}

function toPlatformUser(u: {
  id: string; email?: string | null; last_sign_in_at?: string | null;
  app_metadata?: { role?: unknown; allowed_slugs?: unknown };
  banned_until?: string | null;
}): PlatformUser {
  const role =
    u.app_metadata?.role === 'admin' || u.app_metadata?.role === 'viewer'
      ? u.app_metadata.role : null;
  const slugs = Array.isArray(u.app_metadata?.allowed_slugs)
    ? u.app_metadata!.allowed_slugs.filter((s): s is string => typeof s === 'string')
    : [];
  const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
  return {
    id: u.id, email: u.email ?? null, role,
    slugs: role === 'viewer' ? slugs : [],
    banned, lastSignInAt: u.last_sign_in_at ?? null,
  };
}

function assertSlugs(slugs: string[]) {
  for (const s of slugs) if (!SLUG_RE.test(s)) throw new Error(`invalid slug: "${s}"`);
}

export async function listUsers(): Promise<PlatformUser[]> {
  const { data, error } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`list users failed: ${error.message}`);
  return data.users.map(toPlatformUser);
}

export async function createViewer(input: { email: string; password: string; slugs: string[] }) {
  assertSlugs(input.slugs);
  const { data, error } = await serviceClient().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: 'viewer', allowed_slugs: input.slugs },
  });
  if (error || !data.user) throw new Error(`create failed: ${error?.message ?? 'no user'}`);
  return toPlatformUser(data.user);
}

export async function resetPassword(userId: string, password: string): Promise<void> {
  const { error } = await serviceClient().auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(`password reset failed: ${error.message}`);
}

export async function setSlugs(userId: string, slugs: string[]): Promise<void> {
  assertSlugs(slugs);
  const db = serviceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(`user lookup failed: ${error?.message ?? 'not found'}`);
  const { error: upErr } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, allowed_slugs: slugs },
  });
  if (upErr) throw new Error(`slug update failed: ${upErr.message}`);
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  const { error } = await serviceClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? 'none' : '876000h', // ~100 years
  });
  if (error) throw new Error(`${active ? 'unban' : 'ban'} failed: ${error.message}`);
}
```

Refactor `scripts/create-user.ts`: keep its argv interface exactly; for `viewer` call `createViewer`, for `admin` keep the direct `createUser` call (the lib deliberately only creates viewers — admins stay a script-only, deliberate act).

- [ ] **Step 4: Run the suite**

Run: `npx vitest run` — all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/users scripts/create-user.ts
git commit -m "feat: users admin library; create-user script rides on it"
```

---

### Task 15: Users management page

**Files:**
- Create: `decoder-platform/app/admin/users/page.tsx` (server) + `users-client.tsx` (client)
- Modify: `decoder-platform/app/admin/actions.ts` (user actions)

**Interfaces:**
- Consumes: everything from `lib/users/admin.ts` (Task 14); `listVersions` (Task 7) for the slug multiselect.
- Produces (in `app/admin/actions.ts`):

```ts
export interface UserActionState { error?: string; createdPassword?: string; forEmail?: string }
export async function createViewerAction(prev: UserActionState, formData: FormData): Promise<UserActionState>
export async function resetPasswordAction(prev: UserActionState, formData: FormData): Promise<UserActionState>
export async function setUserSlugsAction(prev: UserActionState, formData: FormData): Promise<UserActionState>
export async function setUserActiveAction(prev: UserActionState, formData: FormData): Promise<UserActionState>
```

- [ ] **Step 1: Implement the actions**

All start with `await requireAdmin()`. Notes beyond the obvious mapping onto the lib:
- `createViewerAction`: slugs arrive as `formData.getAll('slugs')` (multi-checkbox). Password: use the submitted `password` field if non-empty, else `generatePassword()`. **Zero slugs**: allowed only when `formData.get('confirmNoSlugs') === 'on'`; otherwise return `{ error: 'No projects selected — the viewer could sign in but see nothing. Tick the confirmation to create anyway.' }`. On success return `{ createdPassword: password, forEmail: email }` — the page shows it **once**; it is never queryable again. `revalidatePath('/admin/users')`.
- `resetPasswordAction`: generates via `generatePassword()` (no manual entry — fewer weak passwords), returns it in state the same show-once way.
- `setUserActiveAction`: deactivation needs `formData.get('confirm') === 'on'` (the client renders a confirm checkbox inline; **no JS `confirm()` dialogs**).
- Never call these on the last remaining admin: `setUserActiveAction` returns an error if the target is role `admin` (admins are managed by script only — keeps the UI from locking everyone out).

- [ ] **Step 2: Build the page**

Server component: admin check, `const [users, versions] = await Promise.all([listUsers(), listVersions()])`, pass both to the client component. Client renders:
- **Create viewer** card: email, optional password ("leave blank to generate"), checkbox per published slug, `confirmNoSlugs` checkbox (only shown when nothing selected), submit. On `state.createdPassword`: a highlighted box "Password for {forEmail}: `{createdPassword}` — copy it now, it won't be shown again."
- **Users table**: email, role badge, slugs, last sign-in, status (active/deactivated). Per viewer row, inline forms: Reset password (shows result the same show-once way), Edit slugs (checkboxes + save), Deactivate (confirm checkbox + button) / Reactivate. Admin rows render with no action forms and a note "managed via script".

- [ ] **Step 3: Manual verification**

Dev server, as admin, on `/admin/users`:
1. Existing users listed (admin emredplc@gmail.com, viewer-egypt@decoders.test with `[egypt]`).
2. Create `viewer-test@decoders.test` with slug `egypt-test`, generated password shown once. Sign in as them in a private window → lands directly on `/egypt-test`.
3. Edit slugs to add `egypt` → after the viewer's next login (JWT refresh) `/select` shows both.
4. Deactivate → their next request bounces to `/login` and sign-in fails. Reactivate → sign-in works.
5. Reset password → old password fails, new one works.

- [ ] **Step 4: Typecheck + suite, commit**

```bash
npx tsc --noEmit && npx vitest run
git add app/admin
git commit -m "feat(admin): user management UI (create, slugs, reset, deactivate)"
```

---

### Task 16: Merge, deploy, live smoke, cleanup

**Files:**
- Modify: `README.md` (repo root — platform row gains "admin UI" note)

- [ ] **Step 1: Full local gate**

Run from `decoder-platform/`: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: suite green, no type errors, production build succeeds.

- [ ] **Step 2: Merge and push**

```bash
cd /Users/emre.kaya/Desktop/projects/abudhabi
git checkout main
git merge --no-ff decoder-platform-admin -m "Merge branch 'decoder-platform-admin'"   # --no-ff is mandatory (ignore-build-step gotcha)
git push
```

(If push 403s: `gh auth switch --user tiersky` and retry.)

- [ ] **Step 3: Confirm the Vercel deploy**

The `country-decoders` project builds on push (root dir `decoder-platform`). Check the deployment status via the Vercel dashboard or REST (`npx vercel ls country-decoders --scope cortex-11a3a60c` after `npx vercel whoami` refreshes the token). Expected: READY, not CANCELED/ERROR.

- [ ] **Step 4: Live smoke on https://country-decoders.vercel.app** (browser)

1. Signed-out `/admin` → `/login?next=/admin`; sign in as admin → lands on `/admin` directly (the `?next=` proof).
2. Upload `egypt-decoder/source/Egypt_decoder.xlsx` as new slug `egypt-smoke` → confirm screen shows "matches workbook ✓" → Preview renders the dashboard → Publish → `/egypt-smoke` live.
3. Tweaks on `egypt-smoke`: zero out one weight → dashboard updates; Supabase shows rev 2 carrying rev-1's workbook path.
4. `/admin/users`: create `viewer-smoke@decoders.test` scoped to `egypt-smoke`; private window: sign in → straight to `/egypt-smoke`; `/egypt` → bounced to `/select`.
5. Keepalive still works: `curl -H "Authorization: Bearer $CRON_SECRET" https://country-decoders.vercel.app/api/keepalive` → `{"ok":true,...}`.
6. Cleanup: deactivate `viewer-smoke`, and delete the `egypt-smoke` version row + revisions + bucket files via the Supabase dashboard (there is deliberately no version-delete in the UI).

- [ ] **Step 5: Register in README and commit**

Update the platform bullet in the root `README.md`: admin UI live (upload/confirm/publish, drafts, preview, tweaks, users) as of this merge.

```bash
git add README.md
git commit -m "Note admin UI capabilities in platform README entry"
git push
```

---

## Verification (whole-plan definition of done)

- `npx vitest run` green (61 pre-existing + all new tests) and `npm run build` clean on `main`.
- Live at country-decoders.vercel.app: the Task 16 smoke checklist passes end to end.
- Spec cross-check: every carried deferred named in the spec's "Carried deferreds folded in" section is closed by Tasks 1, 3, 4, 5, or 7 (xlsx swap → 1; ?next= + authed redirect → 3; secure cookies, timing-safe compare, cache(), outage logging → 4; verify reasons + near-misses → 5; revision-race retry → 7).
- The only remaining plan-4 deferred is the turbo-ignore-style build check — explicitly out of scope (spec §Out of scope).
