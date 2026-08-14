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
