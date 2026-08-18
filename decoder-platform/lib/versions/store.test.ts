import { describe, it, expect, vi, beforeEach } from 'vitest';
import { egyptMetrics, egyptMarkets } from '../model/fixtures/egypt-week6';
import type { MarketRow, VersionConfig } from '../config/types';
import type { MetricDef } from '../model/score';

// --- Mocks -----------------------------------------------------------------
//
// A small in-memory stand-in for the pieces of the supabase-js postgrest
// query builder that lib/versions/store.ts actually uses: from(table),
// select/eq/order/limit, maybeSingle/single, upsert, insert, delete().eq.
// Every chain is also "thenable" so `await db.from(t).select(...)` (no
// terminal call) resolves like the real client does.
//
// `queueInsertFailure` lets a test force the *next* insert() on a table to
// fail with a given error (e.g. `{ code: '23505' }`), optionally seeding a
// "phantom" row first — simulating that a concurrent writer's row is what
// caused the unique-constraint violation, so the next select sees it.

type Row = Record<string, unknown>;
type QueryError = { message: string; code?: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

interface MockQueryBuilder extends PromiseLike<{ data: Row[]; error: null }> {
  select(cols?: string): MockQueryBuilder;
  eq(col: string, val: unknown): MockQueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): MockQueryBuilder;
  limit(n: number): MockQueryBuilder;
  maybeSingle(): Promise<QueryResult<Row>>;
  single(): Promise<QueryResult<Row>>;
  upsert(row: Row, opts?: { onConflict?: string }): MockQueryBuilder & PromiseLike<{ error: null }>;
  insert(row: Row): Promise<{ error: QueryError | null }>;
  delete(): { eq(col: string, val: unknown): Promise<{ error: null }> };
}

function createMockDb(seed: { versions?: Row[]; version_revisions?: Row[]; version_drafts?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    versions: seed.versions ? [...seed.versions] : [],
    version_revisions: seed.version_revisions ? [...seed.version_revisions] : [],
    version_drafts: seed.version_drafts ? [...seed.version_drafts] : [],
  };
  const nextId: Record<string, number> = {};
  for (const t of ['versions', 'version_revisions']) {
    nextId[t] = 1 + Math.max(0, ...tables[t].map((r) => (r.id as number) ?? 0));
  }

  const insertFailures: Record<string, { err: QueryError; phantom?: Row }[]> = {};
  function queueInsertFailure(table: string, err: QueryError, phantom?: Row) {
    (insertFailures[table] ??= []).push({ err, phantom });
  }

  // Forces the next .single()/.maybeSingle() resolution on a table to
  // return an error instead of the normal query result — used to simulate
  // e.g. a `versions` upsert-then-select failing.
  const errorQueue: Record<string, { method: 'single' | 'maybeSingle'; error: QueryError }[]> = {};
  function queueSelectError(table: string, method: 'single' | 'maybeSingle', error: QueryError) {
    (errorQueue[table] ??= []).push({ method, error });
  }

  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitN: number | null = null;
    let scoped: Row[] | null = null; // set after upsert to scope a chained select

    function source() {
      return scoped ?? tables[table];
    }
    function applyFilters(rows: Row[]) {
      let r = rows.filter((row) => filters.every((f) => f(row)));
      if (orderCol) {
        const col = orderCol;
        r = [...r].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (orderAsc ? 1 : -1);
        });
      }
      if (limitN != null) r = r.slice(0, limitN);
      return r;
    }

    const api: MockQueryBuilder = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((r) => r[col] === val);
        return api;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return api;
      },
      limit(n: number) {
        limitN = n;
        return api;
      },
      async maybeSingle() {
        const q = errorQueue[table];
        if (q && q.length > 0 && q[0].method === 'maybeSingle') {
          const { error } = q.shift()!;
          return { data: null, error };
        }
        const r = applyFilters(source());
        return { data: r[0] ?? null, error: null };
      },
      async single() {
        const q = errorQueue[table];
        if (q && q.length > 0 && q[0].method === 'single') {
          const { error } = q.shift()!;
          return { data: null, error };
        }
        const r = applyFilters(source());
        if (r.length === 0) return { data: null, error: { message: `no row found in ${table}` } };
        return { data: r[0], error: null };
      },
      upsert(row: Row, opts?: { onConflict?: string }) {
        const conflictCol = opts?.onConflict ?? 'id';
        const idx = tables[table].findIndex((r) => r[conflictCol] === row[conflictCol]);
        let saved: Row;
        if (idx >= 0) {
          saved = tables[table][idx] = {
            ...tables[table][idx],
            ...row,
            updated_at: new Date().toISOString(),
          };
        } else {
          saved = {
            ...(nextId[table] !== undefined ? { id: nextId[table]++ } : {}),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...row,
          };
          tables[table].push(saved);
        }
        scoped = [saved];
        // Awaitable directly (saveDraft doesn't chain .select()), and still
        // chainable via api's own select/single for callers that do.
        return Object.assign(Promise.resolve({ error: null }), api);
      },
      insert(row: Row) {
        const queue = insertFailures[table];
        if (queue && queue.length > 0) {
          const { err, phantom } = queue.shift()!;
          if (phantom) tables[table].push(phantom);
          return Promise.resolve({ error: err });
        }
        const saved = {
          ...(nextId[table] !== undefined ? { id: nextId[table]++ } : {}),
          created_at: new Date().toISOString(),
          ...row,
        };
        tables[table].push(saved);
        return Promise.resolve({ error: null });
      },
      delete() {
        return {
          async eq(col: string, val: unknown) {
            tables[table] = tables[table].filter((r) => r[col] !== val);
            return { error: null };
          },
        };
      },
      then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
        onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve({ data: applyFilters(source()), error: null }).then(onfulfilled, onrejected);
      },
    };
    return api;
  }

  return { from, queueInsertFailure, queueSelectError, tables };
}

let mockDb: ReturnType<typeof createMockDb>;

vi.mock('../supabase/admin', () => ({
  serviceClient: () => ({ from: (table: string) => mockDb.from(table) }),
}));

vi.mock('../storage/workbooks', () => ({
  copyDraftToRevision: vi.fn(async (slug: string, revision: number) => `${slug}/rev-${revision}.xlsx`),
  removeDraftWorkbook: vi.fn(async () => {}),
}));

import {
  versionRowFromConfig,
  publishVersion,
  saveDraft,
  getDraft,
  listDrafts,
  deleteDraft,
  listVersions,
  publishDraft,
  applyTweaks,
} from './store';
import { copyDraftToRevision, removeDraftWorkbook } from '../storage/workbooks';

const config = {
  name: 'Egypt Decoder',
  slug: 'egypt',
  currency: 'AED',
  defaultBudget: 10000000,
  metrics: egyptMetrics,
  markets: egyptMarkets.map((m) => ({ ...m, iso2: null, lat: null, lng: null })),
};

beforeEach(() => {
  mockDb = createMockDb();
  vi.clearAllMocks();
});

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

describe('saveDraft / getDraft', () => {
  it('saveDraft upserts by slug and getDraft round-trips the config', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt Decoder',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: 'Model',
      sourceIndex: 0,
      verify: null,
    });

    const draft = await getDraft('egypt');
    expect(draft).not.toBeNull();
    expect(draft!.slug).toBe('egypt');
    expect(draft!.name).toBe('Egypt Decoder');
    expect(draft!.config).toEqual(config);
    expect(draft!.workbookPath).toBe('egypt/draft.xlsx');
    expect(draft!.sourceSheet).toBe('Model');
    expect(draft!.sourceIndex).toBe(0);
    expect(draft!.verify).toBeNull();
    expect(typeof draft!.updatedAt).toBe('string');

    // Upsert again — same slug replaces, doesn't duplicate.
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt Decoder v2',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 1,
      verify: null,
    });
    expect(mockDb.tables.version_drafts).toHaveLength(1);
    const updated = await getDraft('egypt');
    expect(updated!.name).toBe('Egypt Decoder v2');
    expect(updated!.sourceIndex).toBe(1);
  });

  it('getDraft returns null for a missing slug', async () => {
    expect(await getDraft('nope')).toBeNull();
  });
});

describe('listDrafts', () => {
  it('maps every stored draft row to a DraftRecord', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
    });
    await saveDraft({
      slug: 'qatar',
      name: 'Qatar',
      config: { ...config, slug: 'qatar', name: 'Qatar Decoder' },
      workbookPath: 'qatar/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
    });
    const drafts = await listDrafts();
    expect(drafts.map((d) => d.slug).sort()).toEqual(['egypt', 'qatar']);
  });

  it('returns an empty array when there are no drafts', async () => {
    expect(await listDrafts()).toEqual([]);
  });
});

describe('deleteDraft', () => {
  it('deletes the draft row and the draft workbook file', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
    });
    await deleteDraft('egypt');
    expect(await getDraft('egypt')).toBeNull();
    expect(removeDraftWorkbook).toHaveBeenCalledWith('egypt');
  });
});

describe('listVersions', () => {
  it('maps slug/name/currency/status/updated_at to VersionSummary', async () => {
    await publishVersion(config, {});
    const list = await listVersions();
    expect(list).toEqual([
      expect.objectContaining({
        slug: 'egypt',
        name: 'Egypt Decoder',
        currency: 'AED',
        status: 'published',
      }),
    ]);
    expect(typeof list[0].updatedAt).toBe('string');
  });
});

describe('publishDraft', () => {
  it('publishes the draft config, names the workbook rev-<n>, and deletes the draft', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt Decoder',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: 'Model',
      sourceIndex: 0,
      verify: null,
    });

    const { revision } = await publishDraft('egypt');

    expect(revision).toBe(1);
    const version = mockDb.tables.versions.find((v) => v.slug === 'egypt');
    expect(version).toBeDefined();
    expect(version!.status).toBe('published');
    const revRow = mockDb.tables.version_revisions.find(
      (r) => r.version_id === version!.id && r.revision === 1
    );
    expect(revRow).toBeDefined();
    expect(revRow!.workbook_path).toBe('egypt/rev-1.xlsx');
    expect(copyDraftToRevision).toHaveBeenCalledWith('egypt', 1);
    expect(removeDraftWorkbook).toHaveBeenCalledWith('egypt');
    expect(await getDraft('egypt')).toBeNull();
  });

  it('re-invokes workbookPathFor with the recomputed revision on a 23505 race', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt Decoder',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
    });
    // Seed an existing published version at revision 1, so the draft
    // publish below will attempt revision 2 first.
    await publishVersion(config, {});
    const id = mockDb.tables.versions[0].id as number;
    mockDb.queueInsertFailure(
      'version_revisions',
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      // Phantom row: simulates a concurrent publish that landed revision 2
      // first — this is what actually causes the 23505 in a real DB.
      { id: 999, version_id: id, revision: 2, config, workbook_path: null, created_at: new Date().toISOString() }
    );

    const { revision } = await publishDraft('egypt');

    expect(revision).toBe(3);
    // The hook must be re-invoked with the recomputed revision, not just
    // called once with the (now stale) first-attempt number.
    expect(copyDraftToRevision).toHaveBeenNthCalledWith(1, 'egypt', 2);
    expect(copyDraftToRevision).toHaveBeenNthCalledWith(2, 'egypt', 3);
    const revRow = mockDb.tables.version_revisions.find(
      (r) => r.version_id === id && r.revision === 3
    );
    expect(revRow).toBeDefined();
    expect(revRow!.workbook_path).toBe('egypt/rev-3.xlsx');
  });

  it('throws and leaves the draft row intact when the version upsert fails', async () => {
    await saveDraft({
      slug: 'egypt',
      name: 'Egypt Decoder',
      config,
      workbookPath: 'egypt/draft.xlsx',
      sourceSheet: null,
      sourceIndex: 0,
      verify: null,
    });

    // Force the `versions` upsert-then-select('id').single() to fail.
    mockDb.queueSelectError('versions', 'single', { message: 'upsert failed' });

    await expect(publishDraft('egypt')).rejects.toThrow(/publish failed/i);

    // Draft row must survive so the admin can retry.
    expect(await getDraft('egypt')).not.toBeNull();
    expect(removeDraftWorkbook).not.toHaveBeenCalled();
  });
});

describe('publishVersion race retry', () => {
  it('retries once on a 23505 revision race and lands on the next number', async () => {
    // Seed an existing published version at revision 1.
    await publishVersion(config, {});
    const id = mockDb.tables.versions[0].id as number;
    mockDb.queueInsertFailure(
      'version_revisions',
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      // Phantom row: simulates a concurrent publish that landed revision 2
      // first — this is what actually causes the 23505 in a real DB.
      { id: 999, version_id: id, revision: 2, config, workbook_path: null, created_at: new Date().toISOString() }
    );

    const { revision } = await publishVersion(config, {});
    expect(revision).toBe(3);
  });

  it('throws when a second attempt also hits 23505', async () => {
    await publishVersion(config, {});
    const id = mockDb.tables.versions[0].id as number;
    mockDb.queueInsertFailure('version_revisions', { code: '23505', message: 'dup 1' }, {
      id: 998,
      version_id: id,
      revision: 2,
      config,
      workbook_path: null,
      created_at: new Date().toISOString(),
    });
    mockDb.queueInsertFailure('version_revisions', { code: '23505', message: 'dup 2' }, {
      id: 999,
      version_id: id,
      revision: 3,
      config,
      workbook_path: null,
      created_at: new Date().toISOString(),
    });

    await expect(publishVersion(config, {})).rejects.toThrow(/revision insert failed/i);
  });
});

describe('applyTweaks', () => {
  it('toggles markets, patches weights/budget/currency, and appends a revision carrying the previous workbook_path', async () => {
    await publishVersion(config, { workbookPath: 'egypt/rev-1.xlsx' });

    const marketName = config.markets[0].name;
    const metricKey = config.metrics[0].key;

    const { revision } = await applyTweaks('egypt', {
      defaultBudget: 5_000_000,
      currency: 'USD',
      marketEnabled: { [marketName]: false },
      weights: { [metricKey]: 0.99 },
    });

    expect(revision).toBe(2);
    const version = mockDb.tables.versions.find((v) => v.slug === 'egypt')!;
    const versionConfig = version.config as VersionConfig;
    expect(version.default_budget).toBe(5_000_000);
    expect(version.currency).toBe('USD');
    expect(versionConfig.defaultBudget).toBe(5_000_000);
    expect(versionConfig.currency).toBe('USD');
    const tweakedMarket = versionConfig.markets.find((m: MarketRow) => m.name === marketName);
    expect(tweakedMarket!.enabled).toBe(false);
    const tweakedMetric = versionConfig.metrics.find((m: MetricDef) => m.key === metricKey);
    expect(tweakedMetric!.weight).toBe(0.99);

    const revRow = mockDb.tables.version_revisions.find(
      (r) => r.version_id === version.id && r.revision === 2
    );
    expect(revRow).toBeDefined();
    // Tweaks carry the previous revision's workbook forward — no new file.
    expect(revRow!.workbook_path).toBe('egypt/rev-1.xlsx');
  });

  it('rejects an unknown metric key or market name', async () => {
    await publishVersion(config, {});
    await expect(applyTweaks('egypt', { weights: { nope: 5 } })).rejects.toThrow(/unknown metric/i);
    await expect(applyTweaks('egypt', { marketEnabled: { Nowhereland: true } })).rejects.toThrow(
      /unknown market/i
    );
  });
});
