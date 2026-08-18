# Decoder Platform — Admin UI (Plan 5) Design

**Date:** 2026-08-18
**Parent spec:** `2026-08-14-decoder-platform-design.md` (this document refines its
"Workbook pipeline" and "Auth and user management" sections into a buildable design;
where the two differ, this document wins)
**Status of platform:** Plans 1–4 complete and live at country-decoders.vercel.app
(61 vitest tests green). `/admin` is a read-only placeholder.

## Goal

Ship the admin surface: upload → detect → confirm → publish for workbooks,
draft support, full dashboard preview of unpublished configs, quick tweaks on
live versions, user management UI, and workbook storage — plus the deferred
items carried from the plan-4 final review. One plan covers all of it.

## Decisions (from brainstorming, 2026-08-18)

| Topic | Decision |
|---|---|
| Scope | One plan for everything (upload flow, tweaks, users, storage, carried deferreds folded into the tasks they touch) |
| Drafts | Supported: confirm screen has Save-as-draft and Publish; drafts resumable from `/admin` |
| Preview | Full rendered dashboard (existing dashboard UI) from the draft config, admin-only |
| Wizard architecture | **Approach A** — server actions everywhere; the draft row in Supabase *is* the wizard state (no client-held config blob, no REST layer) |
| Draft storage | Separate `version_drafts` table, NOT a column on `versions` (RLS is row-level; a draft column on a published row would leak to that project's viewers) |

## Data model — migration `0002_version_drafts.sql`

```sql
create table public.version_drafts (
  slug text primary key,           -- one pending draft per slug
  name text not null,
  config jsonb not null,           -- assembled VersionConfig (zod-validated before write)
  workbook_path text not null,     -- workbooks bucket: <slug>/draft.xlsx
  source_sheet text,               -- which detected model block the admin picked
  verify jsonb,                    -- stored verify result rendered on the confirm screen
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- updated_at trigger (reuse public.set_updated_at)
-- RLS: enable + force; single select policy: role = 'admin'.
-- No insert/update/delete policies — writes go through the service role only,
-- same as versions/version_revisions.
```

Consequences:

- `versions` only ever holds **published** content from now on. Its `status`
  column stays (dropping it is churn) but the app stops writing `'draft'`;
  the "draft-status write path" deferred is closed by this table instead.
- Both draft cases have one shape: a brand-new slug (no `versions` row yet)
  and an update to a live version (its `versions` row untouched until publish).
- One pending draft per slug. Uploading again for the same slug overwrites the
  existing draft (the upload form says so when a draft exists).

**Publish** (in `publishDraft`): upsert `versions` (config, name, currency,
default_budget, status `'published'`), append `version_revisions` with the next
revision number — **retrying once on a unique-violation race** (carried
deferred) — move the workbook from `<slug>/draft.xlsx` to `<slug>/rev-<n>.xlsx`,
record that path in the revision row, delete the draft row, `revalidatePath('/<slug>')`.
Failure at any step leaves the draft row intact and reports the error.

## Routes and flow

All new pages live under the existing admin-only `/admin` prefix
(`lib/auth/access.ts` already gates it; every server action re-checks
`role === 'admin'` — defense in depth, as today).

- **`/admin`** — replaces the placeholder. Two lists: published versions
  (open dashboard · update · tweaks) and pending drafts (resume confirm ·
  preview · delete). Plus "New version" → `/admin/upload` and "Users" →
  `/admin/users`. Sign-out stays.
- **`/admin/upload`** — file input plus target: *new version* (slug + name
  fields; slug validated against `^[a-z0-9-]+$` and collision-checked) or
  *update existing* (select a published slug). The server action validates
  the file (xlsx only, ≤ 10 MB), uploads it to the bucket at
  `<slug>/draft.xlsx`, parses it (SheetJS, server-side), then:
  - **one** model block detected → assemble → verify → write draft → redirect
    to `/admin/<slug>/confirm`;
  - **multiple** → candidate picker page: per-block preview (sheet name,
    market count, metric headers); picking one continues as above
    (`source_sheet` records the choice);
  - **none** → error view rendering the detector's near-miss diagnostics
    (carried deferred: detect.ts reports *why* each candidate block was
    rejected), never a blank failure.
- **`/admin/[slug]/confirm`** — renders from the draft row: markets with
  on/off toggles; per metric: label, weight, **direction** (auto-guessed,
  always shown — a wrong direction silently poisons scores); budget;
  currency; and the verify table ("matches workbook ✓" or per-cell diffs,
  each mismatch carrying the verify **reason** field — carried deferred).
  Edits re-derive dependent numbers server-side on save. Buttons:
  **Save draft** (update row, back to `/admin`) and **Publish**.
  Link to preview.
- **`/admin/[slug]/preview`** — the real dashboard (`dashboard-client` +
  `deriveDashboard`) server-fed from the **draft** config, with a persistent
  "Draft preview — not live" banner. Admin-only like everything under
  `/admin`; the public `/[slug]` route is untouched.
- **`/admin/[slug]/tweaks`** — quick tweaks on the **published** config:
  budget, currency, market on/off, weights. No parser involvement. Save =
  instant publish: new `version_revisions` row (same race-retry path, no
  workbook move — `workbook_path` carries forward from the previous
  revision), revalidate. Shows current values prefilled.
- **`/admin/users`** — Supabase Auth admin API. List all users (email, role,
  slugs, active/banned state, last sign-in). Create viewer: email, password
  (entered or generated), one or more slugs — **warn on zero slugs** (the
  viewer could log in but see nothing). Per user: reset password, edit
  allowed slugs, deactivate/reactivate (ban/unban). Deactivate asks for
  confirmation. Replaces `scripts/create-user.ts` as the primary path; the
  script stays for emergencies and is refactored onto the same lib.

The draft row is the wizard state throughout: refresh, navigation, or
resuming days later all land back on the confirm screen with nothing lost.

## Library changes

- **`lib/versions/store.ts`** grows: `saveDraft`, `getDraft`, `listDrafts`,
  `deleteDraft`, `publishDraft`, `applyTweaks`, `listVersions`.
  `versionRowFromConfig` and `getPublishedConfig` reused as-is.
- **`lib/parser`**: API unchanged; add near-miss diagnostics to `detect.ts`
  and the reason field to `verify.ts` mismatches (both carried deferreds).
- **`lib/users/admin.ts`** (new): thin wrappers over `auth.admin` —
  `listUsers`, `createViewer`, `resetPassword`, `setActive`, `setSlugs` —
  validating role and slug shape in one place; shared by the UI and scripts.
- **`lib/storage/workbooks.ts`** (new): `putDraftWorkbook` (xlsx magic-bytes +
  size check), `promoteWorkbook` (draft → rev-n move), `removeDraftWorkbook`.
- **xlsx dependency swap — first task, before any upload code**: replace
  `xlsx@0.18.5` (npm advisories) with the official SheetJS CDN tarball
  (`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`, version pinned in
  package.json at implementation time). Full parser suite is the regression
  gate.

## Carried deferreds folded in

Each rides the task that touches its file: xlsx CDN swap (above);
`secure: true` cookieOptions on the SSR clients; timing-safe `CRON_SECRET`
compare in `/api/keepalive`; `?next=` post-login routing plus redirecting
already-authed users away from `/login`; React `cache()` around the
per-request double config fetch; `[slug]/page.tsx` outage logging (log the
store error before rendering not-found); publish revision-race retry; verify
reason field; detection near-miss diagnostics.

## Error handling

- Upload: reject wrong type/size before parsing; parse failures always render
  diagnostics.
- Publish: any failure (storage move, revision conflict after retry) leaves
  the draft intact and surfaces the message on the confirm screen.
- Users: generic errors to the UI, details to server logs (as login does
  today); no service-role key or password material ever client-side.
- Drafts never accumulate silently — `/admin` lists and deletes them.

## Testing

Oracle discipline as in plans 1–4; existing 61 tests stay green.

- Store: draft lifecycle (save → get → publish → revision appended → draft
  gone → published config live), tweak revision append, race retry against a
  mocked unique-violation.
- Upload core extracted as a pure function (buffer + target → draft payload):
  Egypt workbook reproduces the week-6 oracle config; AlUla likewise; a
  non-model xlsx yields diagnostics, not a crash.
- `lib/users`: mocked Auth admin API — slug validation, zero-slug warning
  path, role guard.
- Parser additions: near-miss diagnostics and verify reasons asserted on the
  committed oracle workbooks.
- Deploy smoke (manual, scripted in the plan's verification step): cookie-jar
  login → upload Egypt workbook → confirm → publish → viewer account sees the
  dashboard; tweak a weight → new revision visible.

## Out of scope

- Email flows (invites, password-reset email) — admin shares credentials.
- Inline metric-value editing (re-upload is the source of truth).
- Turbo-ignore-style build check (Vercel ops across all five projects, not
  platform code).
- Migrating the legacy per-client decoders onto the platform.
