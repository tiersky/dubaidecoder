# Decoder Platform — Plan 3: Config-Driven Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a decoder dashboard at `/[slug]` rendered entirely from a published `VersionConfig` in Supabase — a config-driven port of the egypt-decoder UI, seeded end-to-end from the real Egypt workbook through the parser.

**Architecture:** Server component fetches the config by slug via the service-role client (route authorization arrives in Plan 4's middleware; RLS remains defense-in-depth for any future client-side reads). A pure `deriveDashboard` layer turns config into a view-model with runtime-computed indices/scores/splits (`lib/model`). Ported client components render it; interactive weights/toggles/budget recompute client-side through the same `computeModel`.

**Tech Stack:** Next.js App Router, Tailwind v4 (postcss), Chart.js + treemap + datalabels, react-chartjs-2, react-simple-maps, react-tooltip, iso-3166-1, @supabase/supabase-js, tsx (scripts).

**Spec:** `docs/superpowers/specs/2026-08-14-decoder-platform-design.md` (Dashboard section). Suite before this plan: 52/52.

## Global Constraints

- The source being ported lives at `../egypt-decoder/` — read it freely, NEVER modify it.
- Config is the single source of truth: no market list, metric list, weight, currency, budget, or app title may be hardcoded in `decoder-platform` UI code. The sweep list of literals to not reintroduce: `'USD'`, `14000000`/`10000000`, `DEFAULT_DISABLED` code sets, `INDEX_KEYS`-style fixed metric lists, Egypt-specific map codes.
- Metric keys can start with digits (e.g. `2025Visitors`) — always access with bracket notation, never assume identifier-safe keys.
- `iso2` may be null (unresolved market): every flag/map usage needs a null path.
- `npm i` uses `legacy-peer-deps` (react-simple-maps@3 vs React 19 — same as the sibling apps); create `decoder-platform/.npmrc` with `legacy-peer-deps=true` before installing.
- Env for scripts/server: `decoder-platform/.env.local` already holds NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL. The service-role key must never be imported into a client component ('use client' file) — server components, route handlers, and scripts only.
- TDD for pure logic (store row-builder, derive layer). Ported UI components are verified by `npx tsc --noEmit`, `npm run build`, and the Task 6 HTTP smoke — do not invent a component-test framework.
- Commit after every task.

---

### Task 1: Supabase service client, version store, Egypt seed

**Files:**
- Create: `decoder-platform/.npmrc` (`legacy-peer-deps=true`)
- Create: `decoder-platform/lib/supabase/admin.ts`
- Create: `decoder-platform/lib/versions/store.ts`
- Create: `decoder-platform/scripts/seed-egypt.ts`
- Test: `decoder-platform/lib/versions/store.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/supabase/admin.ts — SERVER ONLY (never import from a 'use client' file)
export function serviceClient(): SupabaseClient;

// lib/versions/store.ts
export function versionRowFromConfig(config: VersionConfig): {
  slug: string; name: string; currency: string; default_budget: number;
  status: 'published'; config: VersionConfig;
}; // scalar columns DERIVED from config — config jsonb is the source of truth
export async function publishVersion(config: VersionConfig, opts?: { workbookPath?: string | null; createdBy?: string | null }): Promise<{ id: number; revision: number }>;
export async function getPublishedConfig(slug: string): Promise<VersionConfig | null>; // validates stored config before returning
```

- [ ] **Step 1: Install**

```bash
cd decoder-platform && printf 'legacy-peer-deps=true\n' > .npmrc
npm install @supabase/supabase-js && npm install -D tsx
```

- [ ] **Step 2: Failing test** — `lib/versions/store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { versionRowFromConfig } from './store';
import { egyptMetrics, egyptMarkets } from '../model/fixtures/egypt-week6';

const config = {
  name: 'Egypt Decoder',
  slug: 'egypt',
  currency: 'AED',
  defaultBudget: 10000000,
  metrics: egyptMetrics,
  markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
};

describe('versionRowFromConfig', () => {
  it('derives every scalar column from the config (config is authoritative)', () => {
    const row = versionRowFromConfig(config);
    expect(row.slug).toBe('egypt');
    expect(row.name).toBe('Egypt Decoder');
    expect(row.currency).toBe('AED');
    expect(row.default_budget).toBe(10000000);
    expect(row.status).toBe('published');
    expect(row.config).toBe(config);
  });
});
```

- [ ] **Step 3: Run to verify failure**, then implement:

`lib/supabase/admin.ts`:

```ts
// Server-only: uses the service-role key. Never import from a 'use client' file.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  cached ??= createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
```

`lib/versions/store.ts`:

```ts
import { VersionConfig } from '../config/types';
import { validateConfig } from '../config/validate';
import { serviceClient } from '../supabase/admin';

/** Scalar columns are always re-derived from config — config jsonb is authoritative. */
export function versionRowFromConfig(config: VersionConfig) {
  return {
    slug: config.slug,
    name: config.name,
    currency: config.currency,
    default_budget: config.defaultBudget,
    status: 'published' as const,
    config,
  };
}

export async function publishVersion(
  config: VersionConfig,
  opts: { workbookPath?: string | null; createdBy?: string | null } = {}
): Promise<{ id: number; revision: number }> {
  const db = serviceClient();
  const { data: version, error } = await db
    .from('versions')
    .upsert(versionRowFromConfig(config), { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`publish failed: ${error.message}`);

  const { data: last, error: lastErr } = await db
    .from('version_revisions')
    .select('revision')
    .eq('version_id', version.id)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`revision lookup failed: ${lastErr.message}`);

  const revision = (last?.revision ?? 0) + 1;
  const { error: revErr } = await db.from('version_revisions').insert({
    version_id: version.id,
    revision,
    config,
    workbook_path: opts.workbookPath ?? null,
    created_by: opts.createdBy ?? null,
  });
  if (revErr) throw new Error(`revision insert failed: ${revErr.message}`);
  return { id: version.id as number, revision };
}

export async function getPublishedConfig(slug: string): Promise<VersionConfig | null> {
  const db = serviceClient();
  const { data, error } = await db
    .from('versions')
    .select('config')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw new Error(`load failed: ${error.message}`);
  if (!data) return null;
  const v = validateConfig(data.config);
  if (!v.ok) throw new Error(`stored config for "${slug}" is invalid: ${v.errors.join('; ')}`);
  return v.config;
}
```

`scripts/seed-egypt.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadWorkbookGrids } from '../lib/parser/grid';
import { findModelBlocks } from '../lib/parser/detect';
import { assembleConfig } from '../lib/parser/assemble';
import { verifyAgainstWorkbook } from '../lib/parser/verify';
import { publishVersion } from '../lib/versions/store';

async function main() {
  const wbPath = path.resolve(process.cwd(), '../egypt-decoder/source/Egypt_decoder.xlsx');
  const candidates = findModelBlocks(loadWorkbookGrids(readFileSync(wbPath)));
  if (candidates.length === 0) throw new Error('no model block found');
  const candidate = candidates[0];
  const { config, warnings, errors } = assembleConfig(candidate, {
    name: 'Egypt Decoder',
    slug: 'egypt',
    currency: candidate.budget?.currency ?? 'USD',
    defaultBudget: candidate.budget?.amount ?? 10_000_000,
  });
  if (!config) throw new Error(`assembly failed: ${errors.join('; ')}`);
  const report = verifyAgainstWorkbook(config, candidate);
  console.log('verification:', report.ok ? 'OK' : 'MISMATCH', 'maxScoreDelta', report.maxScoreDelta);
  if (!report.ok) throw new Error('refusing to seed an unverified config');
  if (warnings.length > 0) console.warn('warnings:', warnings);
  const { id, revision } = await publishVersion(config);
  console.log(`published slug=egypt id=${id} revision=${revision}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run tests** — unit suite green (53).

- [ ] **Step 5: Seed against live Supabase** —

```bash
cd decoder-platform && npx tsx --env-file=.env.local scripts/seed-egypt.ts
```

Expected output: `verification: OK ...` then `published slug=egypt id=1 revision=1`. Re-run it once more: revision becomes 2 (idempotent upsert + append-only revisions). Verify via REST:

```bash
set -a; source .env.local; set +a
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/versions?select=slug,name,currency,status" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: one row, slug egypt, currency AED, status published. If tsx cannot pass `--env-file` through, fallback: `node --env-file=.env.local --import tsx scripts/seed-egypt.ts`.

- [ ] **Step 6: Commit**

```bash
git add decoder-platform/.npmrc decoder-platform/lib/supabase decoder-platform/lib/versions decoder-platform/scripts decoder-platform/package.json decoder-platform/package-lock.json
git commit -m "Add version store and Egypt seed script against live Supabase"
```

---

### Task 2: Dashboard view-model derivation

**Files:**
- Create: `decoder-platform/lib/dashboard/derive.ts`
- Test: `decoder-platform/lib/dashboard/derive.test.ts`

**Interfaces:**
- Produces (all UI tasks consume):

```ts
export interface MarketVm {
  name: string; iso2: string | null; lat: number | null; lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
  indices: Record<string, number>;
  score: number; split: number;
}
export interface AxisOption { value: string; label: string }
export interface DashboardVm {
  name: string; slug: string; currency: string; defaultBudget: number;
  metrics: MetricDef[];
  markets: MarketVm[];
  defaultWeights: Record<string, number>;
  axisOptions: AxisOption[];    // all metrics + score + split
  bubbleOptions: AxisOption[];  // budget + score + all metrics
  defaults: { xAxis: string; yAxis: string; bubbleSize: string };
}
export function deriveDashboard(config: VersionConfig): DashboardVm;

export interface AllocationRow {
  name: string; iso2: string | null; score: number; split: number; budget: number; enabled: boolean;
}
export function computeAllocations(
  markets: MarketVm[], metrics: MetricDef[], weights: Record<string, number>,
  enabledNames: Set<string>, totalBudget: number
): AllocationRow[];
```

Rules: `deriveDashboard` computes indices/score/split at runtime via `computeModel` (config's enabled flags). Axis defaults: `xAxis` = first metric with direction `'lower'`, else the first metric; `yAxis` = `'score'`; `bubbleSize` = `'budget'`. `computeAllocations` overrides weights and the enabled set (the interactive path) and prices budget = split × totalBudget.

- [ ] **Step 1: Failing test** — `lib/dashboard/derive.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveDashboard, computeAllocations } from './derive';
import { egyptMetrics, egyptMarkets, egyptExpected } from '../model/fixtures/egypt-week6';
import type { VersionConfig } from '../config/types';

const config: VersionConfig = {
  name: 'Egypt Decoder',
  slug: 'egypt',
  currency: 'USD',
  defaultBudget: 14000000,
  metrics: egyptMetrics,
  markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
};

describe('deriveDashboard', () => {
  const vm = deriveDashboard(config);

  it('computes scores and splits at runtime matching the verified oracle', () => {
    const germany = vm.markets.find((m) => m.name === 'Germany')!;
    expect(germany.score).toBeCloseTo(egyptExpected.Germany.score, 3);
    expect(germany.split).toBeCloseTo(egyptExpected.Germany.split, 5);
  });

  it('builds axis options from metrics plus computed fields', () => {
    expect(vm.axisOptions.map((o) => o.value)).toContain('score');
    expect(vm.axisOptions.map((o) => o.value)).toContain('mediaCost');
    expect(vm.bubbleOptions[0].value).toBe('budget');
  });

  it('defaults xAxis to the first lower-direction metric', () => {
    expect(vm.defaults).toEqual({ xAxis: 'mediaCost', yAxis: 'score', bubbleSize: 'budget' });
  });

  it('carries default weights from metric definitions', () => {
    expect(vm.defaultWeights.marketTier).toBe(50);
    expect(vm.defaultWeights.yoyGrowth).toBe(0);
  });
});

describe('computeAllocations', () => {
  const vm = deriveDashboard(config);
  const allNames = new Set(vm.markets.map((m) => m.name));

  it('prices budgets from splits', () => {
    const rows = computeAllocations(vm.markets, vm.metrics, vm.defaultWeights, allNames, 14000000);
    const total = rows.reduce((a, r) => a + r.budget, 0);
    expect(total).toBeCloseTo(14000000, 4);
    const germany = rows.find((r) => r.name === 'Germany')!;
    expect(germany.budget).toBeCloseTo(egyptExpected.Germany.split * 14000000, 2);
  });

  it('renormalizes when a market is excluded', () => {
    const without = new Set([...allNames].filter((n) => n !== 'Germany'));
    const rows = computeAllocations(vm.markets, vm.metrics, vm.defaultWeights, without, 14000000);
    expect(rows.find((r) => r.name === 'Germany')!.budget).toBe(0);
    const total = rows.reduce((a, r) => a + r.budget, 0);
    expect(total).toBeCloseTo(14000000, 4);
  });

  it('zero weights yield zero splits, not NaN', () => {
    const zero = Object.fromEntries(vm.metrics.map((m) => [m.key, 0]));
    const rows = computeAllocations(vm.markets, vm.metrics, zero, allNames, 14000000);
    expect(rows.every((r) => r.budget === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement `lib/dashboard/derive.ts`:

```ts
import { MetricDef, computeModel } from '../model/score';
import { VersionConfig } from '../config/types';

export interface MarketVm {
  name: string;
  iso2: string | null;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  values: Record<string, number | null>;
  indices: Record<string, number>;
  score: number;
  split: number;
}

export interface AxisOption {
  value: string;
  label: string;
}

export interface DashboardVm {
  name: string;
  slug: string;
  currency: string;
  defaultBudget: number;
  metrics: MetricDef[];
  markets: MarketVm[];
  defaultWeights: Record<string, number>;
  axisOptions: AxisOption[];
  bubbleOptions: AxisOption[];
  defaults: { xAxis: string; yAxis: string; bubbleSize: string };
}

export function deriveDashboard(config: VersionConfig): DashboardVm {
  const result = computeModel(
    config.markets.map((m) => ({ name: m.name, enabled: m.enabled, values: m.values })),
    config.metrics
  );
  const byName = new Map(result.markets.map((m) => [m.name, m]));
  const markets: MarketVm[] = config.markets.map((m) => {
    const r = byName.get(m.name)!;
    return {
      name: m.name,
      iso2: m.iso2,
      lat: m.lat,
      lng: m.lng,
      enabled: m.enabled,
      values: m.values,
      indices: r.indices,
      score: r.score,
      split: r.split,
    };
  });
  const metricOptions = config.metrics.map((m) => ({ value: m.key, label: m.label }));
  const firstLower = config.metrics.find((m) => m.direction === 'lower');
  return {
    name: config.name,
    slug: config.slug,
    currency: config.currency,
    defaultBudget: config.defaultBudget,
    metrics: config.metrics,
    markets,
    defaultWeights: Object.fromEntries(config.metrics.map((m) => [m.key, m.weight])),
    axisOptions: [
      ...metricOptions,
      { value: 'score', label: 'Weighted Score' },
      { value: 'split', label: '% Split' },
    ],
    bubbleOptions: [
      { value: 'budget', label: 'Budget Split' },
      { value: 'score', label: 'Weighted Score' },
      ...metricOptions,
    ],
    defaults: {
      xAxis: (firstLower ?? config.metrics[0]).key,
      yAxis: 'score',
      bubbleSize: 'budget',
    },
  };
}

export interface AllocationRow {
  name: string;
  iso2: string | null;
  score: number;
  split: number;
  budget: number;
  enabled: boolean;
}

export function computeAllocations(
  markets: MarketVm[],
  metrics: MetricDef[],
  weights: Record<string, number>,
  enabledNames: Set<string>,
  totalBudget: number
): AllocationRow[] {
  const weighted = metrics.map((m) => ({ ...m, weight: weights[m.key] ?? 0 }));
  const result = computeModel(
    markets.map((m) => ({ name: m.name, enabled: enabledNames.has(m.name), values: m.values })),
    weighted
  );
  const geo = new Map(markets.map((m) => [m.name, m.iso2]));
  return result.markets.map((m) => ({
    name: m.name,
    iso2: geo.get(m.name) ?? null,
    score: m.score,
    split: m.split,
    budget: m.split * totalBudget,
    enabled: m.enabled,
  }));
}
```

Note for the test's oracle: the week-6 fixture has all 15 markets enabled and mediaCost direction 'lower' — `defaults.xAxis` must come out 'mediaCost' because it is the only lower-direction metric.

- [ ] **Step 3: Run tests** — green.

- [ ] **Step 4: Commit**

```bash
git add decoder-platform/lib/dashboard && git commit -m "Add dashboard view-model derivation and interactive allocations"
```

---

### Task 3: Port the shell — styles, atoms, molecules, layout, sidebar

**Files** (sources under `../egypt-decoder/`, targets under `decoder-platform/`):
- Replace: `app/globals.css` ← copy egypt's verbatim
- Create: `postcss.config.mjs` ← copy egypt's
- Copy verbatim: `public/Country Decoder Logo.png`; `components/atoms/GlassCard.tsx`, `MetricValue.tsx`, `SearchInput.tsx`, `SelectDropdown.tsx`, `TabButton.tsx`; `components/molecules/ChartCard.tsx`, `MetricCard.tsx`
- Adapted copies (changes below): `components/atoms/MetricInfo.tsx`, `components/molecules/CountryListItem.tsx`, `components/molecules/BudgetInputField.tsx`, `components/organisms/Sidebar.tsx`, `components/templates/DashboardLayout.tsx`

**Adaptations (exact):**
1. `MetricInfo.tsx` — delete the `@/types` import and dictionary lookups; new props: `metric: { label: string; source?: string; description?: string }`; render from the prop. Everything else (tooltip markup) unchanged. `MetricCard.tsx` passes a `metric` object through instead of `metricKey` (adjust its prop type accordingly).
2. `CountryListItem.tsx` — props become `{ name: string; iso2: string | null; onClick: () => void }` (plus whatever display props it already takes, renamed from `country`/`code`). Flag `<img>` renders only when `iso2 !== null`; when null render `<span className="w-[40px] …">` placeholder with the market's first two letters (match the existing size classes so rows align).
3. `BudgetInputField.tsx` — add `currency: string` prop; label `Total Marketing Budget ({currency})`, placeholder accordingly. Keep min/step.
4. `Sidebar.tsx` — generic over `{ name, iso2 }` rows: props `{ markets: Array<{ name: string; iso2: string | null }>; selected: string | null; onSelect: (name: string | null) => void }`. Search filter on `name` as before; pass name/iso2 to `CountryListItem`.
5. `DashboardLayout.tsx` — props `{ title: string; tabs: Array<{ id: string; label: string }>; currentTab: string; onTabChange: (id: string) => void; sidebar?: React.ReactNode; children }`. Render `tabs.map` of `TabButton` instead of the two hardcoded buttons; header title from `title` prop (keep the logo img + tagline markup, tagline stays the generic "Strategic Travel Intelligence").

Install UI deps first:

```bash
cd decoder-platform
npm install chart.js chartjs-chart-treemap chartjs-plugin-datalabels react-chartjs-2 react-simple-maps react-tooltip iso-3166-1
npm install -D tailwindcss @tailwindcss/postcss @types/react-simple-maps
```

- [ ] **Step 1: Install deps, copy files, apply adaptations** (no TDD — port task).
- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; `npm run build` succeeds; `npx vitest run` still green (53+). Nothing imports the new components yet — tsc/build still type-check them.
- [ ] **Step 3: Commit**

```bash
git add -A decoder-platform && git commit -m "Port dashboard shell: styles, atoms, molecules, layout"
```

---

### Task 4: Port the Budget Allocation tab

**Files:**
- Adapted copies from `../egypt-decoder/components/`: `organisms/BubbleChart.tsx`, `organisms/BudgetTreemap.tsx`, `organisms/ModelWeightsPanel.tsx`, `organisms/BudgetTable.tsx`, `templates/BudgetAllocation.tsx` → same paths under `decoder-platform/components/`

**Adaptations (exact):**
1. `BubbleChart.tsx` — props `{ markets: MarketVm[]; metrics: MetricDef[]; allocations: AllocationRow[]; xAxis: string; yAxis: string; bubbleSize: string; currency: string }`. Add one accessor and use it for x, y, and size:

```ts
function metricValue(row: MarketVm, key: string, budgetByName: Map<string, number>): number | null {
  if (key === 'score') return row.score;
  if (key === 'split') return row.split;
  if (key === 'budget') return budgetByName.get(row.name) ?? null;
  return row.values[key] ?? null;
}
```

Replace the per-metric `scaleRadius` magic-number chain with generic min-max scaling over the plotted set: `r = 8 + 22 * Math.sqrt((v - min) / (max - min))` (guard `max === min` → 15). Axis labels come from the metrics list (label by key, falling back to 'Weighted Score'/'% Split'/'Budget Split'). Tooltip currency string uses the `currency` prop. Skip markets whose x or y resolves to null.
2. `BudgetTreemap.tsx` — props gain `currency: string`; replace the `USD` literal in the tooltip/labels. `Allocation` type import switches to `AllocationRow` from `@/lib/dashboard/derive` (field names: `budget`, `split`, `name` — adjust references from the old `percentSplit` naming).
3. `ModelWeightsPanel.tsx` — props `{ metrics: MetricDef[]; weights: Record<string, number>; onChange; enabled; onToggle }`; map over `metrics` (label from `metric.label`, info via `MetricInfo` with the metric object). Delete `INDEX_KEYS`/`INDEX_LABELS` imports.
4. `BudgetTable.tsx` — full rewrite of the column model, keeping the existing table styling classes: columns = `Active | Market | …one per config metric (metric.label) | Weighted Score | % Split | Budget ({currency})`. Values via bracket access `market.values[metric.key]`; generic formatter:

```ts
function fmt(v: number | null): string {
  if (v === null) return '—';
  if (Math.abs(v) < 1) return v.toFixed(2);
  return Math.round(v).toLocaleString();
}
```

Score `.toFixed(2)`, split `(split * 100).toFixed(1) + '%'`, budget `Math.round(budget).toLocaleString()`. Toggle column drives `onToggleMarket(name)`. Wrap the table in the existing `overflow-x-auto` container (metric count is dynamic).
5. `BudgetAllocation.tsx` (template) — state seeded from the vm: `totalBudget = vm.defaultBudget`; `weights = vm.defaultWeights`; `enabledNames = new Set(vm.markets.filter(m => m.enabled).map(m => m.name))`; axis state from `vm.defaults`. Allocations recompute via `computeAllocations(vm.markets, vm.metrics, weights, enabledNames, totalBudget)` in a `useMemo`. Dropdowns use `vm.axisOptions` / `vm.bubbleOptions`. Delete `DEFAULT_DISABLED`, `DEFAULT_MODEL_WEIGHTS`, `axisOptions` imports. Props: `{ vm: DashboardVm }`.

- [ ] **Step 1: Port with adaptations.**
- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; `npm run build` succeeds; `npx vitest run` green.
- [ ] **Step 3: Commit**

```bash
git add -A decoder-platform && git commit -m "Port budget allocation tab as config-driven components"
```

---

### Task 5: Port Global Overview and Country Detail

**Files:**
- Adapted copies: `organisms/WorldMap.tsx`, `organisms/KPIGrid.tsx`, `organisms/CountryHeader.tsx`, `templates/GlobalOverview.tsx`, `templates/CountryDetail.tsx` → `decoder-platform/components/`

**Adaptations (exact):**
1. `WorldMap.tsx` — delete the three hardcoded ISO maps. Resolve topojson geographies to market iso2 via `iso-3166-1`:

```ts
import { whereNumeric, whereAlpha3 } from 'iso-3166-1';
function geoToIso2(geo: { id?: string | number; properties?: Record<string, unknown> }): string | null {
  const byNum = geo.id != null ? whereNumeric(String(geo.id).padStart(3, '0')) : undefined;
  if (byNum) return byNum.alpha2.toLowerCase();
  const a3 = (geo.properties?.ISO_A3 ?? geo.properties?.iso_a3) as string | undefined;
  const byA3 = a3 ? whereAlpha3(a3) : undefined;
  return byA3 ? byA3.alpha2.toLowerCase() : null;
}
```

Market lookup becomes a `Map` from the `markets: MarketVm[]` prop (only `iso2 !== null` entries). Props gain `currency: string` (tooltip literal), and `allocations: AllocationRow[]` for the budget in tooltips. Keep the topojson URL and styling; change projection center to a neutral `[15, 20]`.
2. `KPIGrid.tsx` — full rewrite, keeping the grid/card styling: delete `TIER_LABEL` and the nine hand-written cards; render one `MetricCard` per config metric (label, `fmt` from Task 4's generic formatter — extract it to `lib/dashboard/format.ts` and import in both places, value via `market.values[metric.key]`, info = metric object) plus two computed cards: Weighted Score (`score.toFixed(2)`) and % Split (`(split*100).toFixed(1)%`). One shared neutral icon (keep any single existing SVG path) for all metric cards. Props: `{ market: MarketVm; metrics: MetricDef[] }`.
3. `CountryHeader.tsx` — flag img only when `iso2 !== null`, else the two-letter placeholder (same pattern as CountryListItem). Props renamed to `{ market: MarketVm }`.
4. `GlobalOverview.tsx` / `CountryDetail.tsx` — prop renames to `{ markets: MarketVm[]; … }` / `{ market: MarketVm; metrics: MetricDef[] }`; pass-through only.

- [ ] **Step 1: Port with adaptations.**
- [ ] **Step 2: Verify** — `npx tsc --noEmit`; `npm run build`; `npx vitest run` green.
- [ ] **Step 3: Commit**

```bash
git add -A decoder-platform && git commit -m "Port global overview and country detail as config-driven components"
```

---

### Task 6: Route wiring and HTTP smoke

**Files:**
- Create: `decoder-platform/app/[slug]/page.tsx` (server component)
- Create: `decoder-platform/app/[slug]/dashboard-client.tsx` (client; the old `app/page.tsx` logic)
- Create: `decoder-platform/app/[slug]/not-found.tsx`
- Replace: `decoder-platform/app/page.tsx` (neutral landing)
- Modify: `decoder-platform/app/layout.tsx` (generic metadata: title "Country Decoders")

**`app/[slug]/page.tsx`:**

```tsx
import { notFound } from 'next/navigation';
import { getPublishedConfig } from '@/lib/versions/store';
import { deriveDashboard } from '@/lib/dashboard/derive';
import DashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getPublishedConfig(slug).catch(() => null);
  return { title: config ? `${config.name} — Market Intelligence` : 'Not found' };
}

export default async function VersionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getPublishedConfig(slug).catch(() => null);
  if (!config) notFound();
  return <DashboardClient vm={deriveDashboard(config)} />;
}
```

**`dashboard-client.tsx`:** `'use client'`; props `{ vm: DashboardVm }`; port the old `app/page.tsx` state machine (tab `'global' | 'budget'` ids but rendered from a `tabs` array `[{id:'global',label:'Global Overview'},{id:'budget',label:'Budget Allocation'}]`, `selectedMarket: string | null`); renders `DashboardLayout` with `title={vm.name}`, `Sidebar` on markets, and the three templates fed from `vm`.

**`not-found.tsx`:** minimal card "No decoder is published at this address." **Root `page.tsx`:** title + one line "Country decoder dashboards — access via your project link." (No client list — access decision from the spec.)

- [ ] **Step 1: Implement the five files.**
- [ ] **Step 2: Verify by build** — `npx tsc --noEmit`; `npm run build` (needs `.env.local` present for module init — it is).
- [ ] **Step 3: HTTP smoke against the seeded version:**

```bash
cd decoder-platform && (PORT=3199 npm run start &) && sleep 4
curl -s -o /tmp/egypt.html -w '%{http_code}\n' http://localhost:3199/egypt        # expect 200
grep -c 'Egypt Decoder' /tmp/egypt.html   # expect >= 1
grep -c 'Russia' /tmp/egypt.html          # expect >= 1 (sidebar market list is server-rendered HTML)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3199/no-such-slug       # expect 404
kill %1
```

If `grep Russia` finds nothing because the sidebar renders client-side only, check the served HTML for the serialized vm payload instead (`grep -c '"Russia"' /tmp/egypt.html`) and note which form passed in your report.

- [ ] **Step 4: Commit**

```bash
git add -A decoder-platform && git commit -m "Wire /[slug] dashboard route with server-fetched config"
```

---

## Self-review notes

- Spec coverage (Dashboard section): config-driven port of all three views ✓; runtime scoring ✓ (derive); interactive weights/toggles/budget stay client-side ephemeral ✓ (Task 4 state); `/[slug]` dynamic ✓; no client list on root ✓. Login/middleware/publish flow: Plan 4.
- The parser plan's deferred items intentionally NOT here (xlsx CDN swap, verify reason field, near-miss diagnostics) — they belong to Plan 4 where uploads exist.
- Type consistency: `MarketVm`/`DashboardVm`/`AllocationRow` defined once in derive.ts (Task 2), consumed by name in Tasks 4-6; `fmt` extracted to `lib/dashboard/format.ts` in Task 5 and shared with Task 4's table (Task 5 does the extraction; Task 4 may inline it first — acceptable interim duplication resolved within the plan).
