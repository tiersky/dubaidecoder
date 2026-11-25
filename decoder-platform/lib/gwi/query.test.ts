import { describe, expect, it, vi, afterEach } from 'vitest';
import { decoderLocations, fetchGwiResults, latestQuarters, panelQuery, parsePanel, sizeQuery, type StatsResponse, type StatsRow } from './query';
import { gwiRequest } from './client';
import type { GwiConfig } from './types';

const metrics = (o: Partial<StatsRow['metrics']>): StatsRow['metrics'] => ({
  positive_sample: 0,
  positive_size: 0,
  audience_sample: 0,
  audience_size: 0,
  audience_percentage: 0,
  audience_index: 0,
  datapoint_sample: 0,
  datapoint_size: 0,
  datapoint_percentage: 0,
  ...o,
});

const AUD = { and: [{ question: 'i7', datapoints: ['i7_1'] }, { question: 'i5', datapoints: ['i5_3'] }] } as const;
const CFG: GwiConfig = {
  waves: ['q4_2025', 'q1_2026', 'q2_2026', 'q3_2026'],
  audiences: [{ key: 'affluent', name: 'Affluent investors', expression: AUD as unknown as GwiConfig['audiences'][0]['expression'] }],
  primaryAudience: 'affluent',
  panels: [
    {
      key: 'vacations',
      title: 'Vacations they enjoy',
      question: 'q32203',
      datapoints: [
        { code: 'q32203_4', label: 'Beach / resort' },
        { code: 'q32203_42330', label: 'City break' },
      ],
      audience: 'affluent',
    },
  ],
};

// Recorded from the 2026-11-24 spike (trimmed): UAE and UK, plus Greece with a thin base.
const SIZE_RES: StatsResponse = {
  meta: { type: 'DATAPOINTS-AUDIENCES', question: 's2' },
  data: [
    { datapoint: 's2_971', audience: 'affluent', metrics: metrics({ positive_sample: 1371, positive_size: 1797197.4, datapoint_size: 9273204, datapoint_percentage: 19.4 }) },
    { datapoint: 's2_44', audience: 'affluent', metrics: metrics({ positive_sample: 6824, positive_size: 8797656, datapoint_size: 55108266, datapoint_percentage: 16 }) },
    { datapoint: 's2_30', audience: 'affluent', metrics: metrics({ positive_sample: 84, positive_size: 92100, datapoint_size: 5871670, datapoint_percentage: 1.6 }) },
  ],
};
const PANEL_RES: StatsResponse = {
  meta: { type: 'DATAPOINTS-SEGMENTS-AUDIENCES', question: 'q32203', splitter: 's2' },
  data: [
    { datapoint: 'q32203_4', segment: 's2_971', audience: 'affluent', metrics: metrics({ audience_sample: 1371, audience_percentage: 60.9, audience_index: 106.7 }) },
    { datapoint: 'q32203_42330', segment: 's2_971', audience: 'affluent', metrics: metrics({ audience_sample: 1371, audience_percentage: 38.8, audience_index: 113.2 }) },
    { datapoint: 'q32203_4', segment: 's2_44', audience: 'affluent', metrics: metrics({ audience_sample: 6824, audience_percentage: 67.4, audience_index: 118.1 }) },
    // Not asked in Greece in these waves: dropped, not read as 0%.
    { datapoint: 'q32203_4', segment: 's2_30', audience: 'affluent', metrics: metrics({}) },
    // A datapoint the panel didn't ask for.
    { datapoint: 'q32203_997', segment: 's2_44', audience: 'affluent', metrics: metrics({ audience_sample: 6824, audience_percentage: 5.9 }) },
  ],
};

describe('decoderLocations', () => {
  it('folds cities into one location per country and lists countries GWI lacks', () => {
    const r = decoderLocations(['fr', 'FR', 'ae', null, 'qa']);
    expect(r.locations).toEqual({ fr: { code: 's2_33', name: 'France' }, ae: { code: 's2_971', name: 'UAE' } });
    expect(r.unsupported).toEqual(['qa']);
  });
  it('reads Monaco through France', () => {
    expect(decoderLocations(['mc']).locations).toEqual({ fr: { code: 's2_33', name: 'France' } });
  });
});

describe('queries', () => {
  it('sizes every audience in every country in one stats call', () => {
    expect(sizeQuery(CFG.audiences, ['s2_971'], CFG.waves)).toEqual({
      question: 's2',
      datapoints: ['s2_971'],
      waves: CFG.waves,
      audiences: [{ id: 'affluent', name: 'Affluent investors', expression: AUD }],
    });
  });
  it('splits a panel by country with the audience inline', () => {
    const q = panelQuery({ ...CFG.panels[0], suffix: '3' }, CFG.audiences[0], ['s2_971', 's2_44'], CFG.waves);
    expect(q).toMatchObject({ question: 'q32203', splitter: 's2', segments: ['s2_971', 's2_44'], locations: ['s2_971', 's2_44'], suffixes: ['3'] });
  });
  it('drops cells with no sample and datapoints the panel did not ask for', () => {
    const p = parsePanel(PANEL_RES, CFG.panels[0], new Map([['s2_971', 'ae'], ['s2_44', 'gb'], ['s2_30', 'gr']]));
    expect(p).toEqual({
      ae: { q32203_4: { pct: 60.9, index: 106.7, sample: 1371 }, q32203_42330: { pct: 38.8, index: 113.2, sample: 1371 } },
      gb: { q32203_4: { pct: 67.4, index: 118.1, sample: 6824 } },
    });
  });
});

describe('fetchGwiResults', () => {
  it('uses one call for sizes and one per panel, and records a failing panel', async () => {
    const cfg: GwiConfig = { ...CFG, panels: [...CFG.panels, { ...CFG.panels[0], key: 'broken' }] };
    const post = vi
      .fn()
      .mockResolvedValueOnce(SIZE_RES)
      .mockResolvedValueOnce(PANEL_RES)
      .mockRejectedValueOnce(new Error('GWI POST /v2/query/stats failed (400)'));
    const r = await fetchGwiResults(cfg, ['ae', 'gb', 'gr', 'qa'], post, () => new Date('2026-11-25T00:00:00Z'));
    expect(post).toHaveBeenCalledTimes(3);
    expect(r.calls).toBe(2); // the failed request isn't metered
    expect(r.unsupported).toEqual(['qa']);
    expect(r.sizes.affluent.ae).toEqual({ size: 1797197, sample: 1371, universe: 9273204, share: 19.4 });
    expect(r.sizes.affluent.gr.sample).toBe(84);
    expect(Object.keys(r.panels)).toEqual(['vacations']);
    expect(r.errors).toEqual({ broken: 'GWI POST /v2/query/stats failed (400)' });
    expect(r.fetchedAt).toBe('2026-11-25T00:00:00.000Z');
  });
  it('refuses a decoder with no GWI country', async () => {
    await expect(fetchGwiResults(CFG, ['qa'], vi.fn())).rejects.toThrow(/None of the markets/);
  });
});

describe('latestQuarters', () => {
  it('walks back across a year boundary', () => {
    expect(latestQuarters('q1_2026', 3)).toEqual(['q3_2025', 'q4_2025', 'q1_2026']);
    expect(() => latestQuarters('jun_2011')).toThrow();
  });
});

describe('gwiRequest', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('backs off on 429 using Retry-After, then returns the body', async () => {
    vi.stubEnv('GWI_PLATFORM_API_KEY', 'test-key');
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const r = await gwiRequest('POST', '/v2/query/stats', { q: 1 }, { fetchImpl, sleep });
    expect(r).toEqual({ data: [] });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key');
  });
  it('does not retry a 400 and reports GWI’s message', async () => {
    vi.stubEnv('GWI_PLATFORM_API_KEY', 'test-key');
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'unknown question' }), { status: 400 }));
    await expect(gwiRequest('GET', '/x', undefined, { fetchImpl })).rejects.toThrow('GWI GET /x failed (400): unknown question');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refuses to run without a key', async () => {
    vi.stubEnv('GWI_PLATFORM_API_KEY', '');
    await expect(gwiRequest('GET', '/x')).rejects.toThrow(/not configured/);
  });
});
