# Decoder Platform — Design

**Date:** 2026-08-14
**Status:** Approved pending user review

## Problem

Every country decoder (Egypt, AlUla, Jumeirah, DHRE, Dubai) comes from the same
Excel template — a model sheet with markets as rows, metric columns, Avg/St Dv
rows, a Model Weight row, a NORM.DIST index table, and Weighted Score / % Split
outputs. Today each new version is a manual code fork: copy an app folder,
rewrite `data/countries.ts` by hand from the workbook, create a Vercel project.
The methodology never changes; only the project name, markets, metrics, and
model weights do. Creating a version should be: upload the workbook, confirm
what was detected, done.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Operating model | Web page: drop xlsx → get a decoder |
| Architecture | Versions are data on one platform, not code forks |
| URLs | Path-based: `<platform>.vercel.app/<slug>` (custom domain possible later) |
| Access | Two user types: **admins** (create versions, manage users) and **viewers** (client logins scoped to specific projects, created by admins and shared with clients). All dashboards behind login. |
| Excel handling | Auto-detect + confirm screen (never fully automatic) |
| Existing 5 decoders | Untouched; platform is for new versions. Migrate later if desired. |
| Updates | Re-upload workbook (same detect→confirm flow) + instant quick tweaks (budget, currency, market on/off, weights) |
| Storage | Supabase for everything stateful: version configs, config revision history, uploaded workbooks (Storage), and user accounts. Git holds only the platform's code. |

## Architecture

New sibling app in the monorepo: `decoder-platform/`, with its own Vercel
project (working name `country-decoders`). Next.js App Router.

```
decoder-platform/
  app/
    login/            # single login page for admins and viewers
    [slug]/           # client dashboard (dynamic, cached; revalidated on publish)
    admin/            # admin-only: versions list, upload, confirm, tweaks, users
  lib/
    parser/           # xlsx model-block detection (SheetJS)
    model/            # scoring math: sample stats, NORM.DIST indices, splits
    geo/              # country name → ISO code + lat/lng dictionary
  supabase/           # schema migrations
```

Supabase (one project):

- `versions` — slug (unique), name, currency, default_budget, status
  (draft/published), current config JSONB, timestamps.
- `version_revisions` — every published config, append-only: version_id,
  revision number, config JSONB, workbook file path, created_by, created_at.
  This is the week-6 vs week-7 audit trail.
- Storage bucket `workbooks` — every uploaded xlsx, keyed by version + revision.
- Users via **Supabase Auth**: role (`admin` | `viewer`) and `allowed_slugs`
  (array) live in `app_metadata` (server-controlled, not user-editable).
  Admins create viewer accounts from the admin UI via the service role;
  no email verification flows — admin generates a password and shares it
  with the client.
- RLS on all tables; viewers can only read the config of versions whose slug
  is in their `allowed_slugs`. Load the `supabase:supabase` and
  `supabase-postgres-best-practices` skills before writing any schema or RLS.

The config JSONB is the single contract between pipeline and dashboard:
version metadata (name, currency, default budget), the metric definitions
(key, label, weight, data source, direction, tooltip), and per-market rows
(name, ISO code, lat/lng, raw values, tier, enabled flag, computed indices).

## Workbook pipeline: upload → detect → confirm → publish

**Detect.** Server-side parse (SheetJS in a route handler / server action).
Scan every sheet for candidate *model blocks*, fingerprinted by: a leading
City/Country column with market rows beneath, an `Avg` row, a `St Dv` row, and
a `Model Weight` row. Also captured when present: `Data Source` row, the Index
Table block, the Weighted Score / % Split output block, and a currency+amount
budget cell (e.g. `AED 51,450,000`). Multiple candidates (e.g. AlUla's
"Final", "Final (2)" sheets) → admin picks from previews.

**Confirm screen.** Everything detected, editable before publish:

- Version name + slug; currency + default budget.
- Market list with include/exclude toggles (excluded markets stay in the
  config, off by default — the Egypt week-6 pattern).
- Per metric: label, weight (blank in workbook → 0, still indexed), data
  source, and **direction** (higher-is-better vs lower-is-better).
  Direction is auto-guessed (name contains cost/CPM → lower-is-better) but
  always shown for confirmation — a wrong direction silently poisons scores.
- Country resolution: names matched against the built-in geo dictionary;
  unmatched names flagged for manual ISO assignment (or "no map pin").

**Verify.** The platform recomputes the full model from raw values — sample
avg/stdev over *included* markets only, NORM.DIST(x, avg, stdev) per index,
lower-is-better metrics inverted (1−Φ), blank values in lower-is-better
metrics treated as 0 (scores as cheapest), weighted score = Σ weight×index,
splits normalized over included markets — and compares against the workbook's
own Index Table and Weighted Score / % Split columns when present. The confirm
screen shows "matches workbook ✓" or a per-cell diff (e.g. "Germany 74.21 vs
workbook 74.18"). Publishing with diffs is allowed but never unknowing.
This methodology is already validated: it reproduced the Egypt week-6
workbook to display precision.

**Publish.** Insert/update the `versions` row, append a `version_revisions`
row, store the workbook in the bucket, revalidate the dashboard path. Live
instantly at `/<slug>`.

## Dashboard

A config-driven port of the **egypt-decoder** UI (the most refined of the
five): Global Overview (world map, KPIs), Country Detail, Budget Allocation
(bubble chart, treemap, model-weights panel, budget input, per-market budget
table with toggles). Everything hardcoded per-app today — metric keys, labels,
tooltips, sources, default weights, currency, budget — comes from the config.
In-dashboard interactions (weight sliders, market toggles, budget input) stay
client-side and ephemeral, exactly as in the existing apps; persistent changes
happen only through the admin.

## Auth and user management

- One login page. After login: admins land on `/admin`; viewers with one
  allowed slug are redirected straight to their dashboard; viewers with
  several get a picker showing only their projects.
- Middleware protects `/[slug]` (viewer's `allowed_slugs` or admin) and
  `/admin` (admin only). The platform root is a neutral page with a login
  link — no client list is ever public.
- Admin user management, per version: create a viewer login (admin enters or
  generates username + password, assigns one or more slugs), reset password,
  deactivate. Multiple viewer accounts per project are fine.

## Error handling

Specific, actionable errors at every stage — nothing silently guesses:

- No model block: "scanned N sheets; none had the Avg / St Dv / Model Weight
  fingerprint" with per-sheet notes on what was missing.
- Ambiguous blocks: side-by-side candidate previews to pick from.
- Unresolved countries: listed by name on the confirm screen, publish blocked
  until resolved or explicitly marked "no map pin".
- Verification diffs: per-cell, with both values shown.
- Malformed numbers (text in numeric cells, merged-cell oddities): flagged
  per cell on the confirm screen.

## Testing

Real workbooks are the oracles:

- Parser unit tests against the actual committed workbooks
  (`egypt-decoder/source/Egypt_decoder.xlsx`, `alula-decoder/source/Al Ula -
  Country Decoder.xlsx`) — assert detected markets, metrics, weights.
- Model math tests: uploading the Egypt workbook must reproduce the exact
  scores/splits currently live on egypt-decoder.vercel.app (both the original
  25-market model and the week-6 15-market variant).
- Edge cases: blank CPMs, zero-visitor markets (Canada/Japan), weight-0
  metrics, excluded-market stats recomputation.
- Auth tests: viewer cannot read another slug's config (RLS-level and
  route-level).

## Out of scope (v1)

- Migrating the five existing decoders (they keep their vercel.app URLs).
- Custom domain / per-version subdomains (a later Vercel dashboard change).
- Per-client custom features beyond the template (Jumeirah confidence tab,
  DHRE radar/regions stay in their code apps).
- Email flows (invites, password reset by email) — admin shares credentials
  manually.
- Editing individual metric values inline (workbook re-upload is the source
  of truth; quick tweaks cover budget, currency, market toggles, weights).
