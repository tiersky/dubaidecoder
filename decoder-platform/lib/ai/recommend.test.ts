import { describe, it, expect } from 'vitest';
import { buildRecommendPrompt, parseRecommendReply, RECOMMEND_SCHEMA } from './recommend';

const allowed = new Set(['es', 'fr', 'th']);
const seeds = new Set(['gb', 'de']);
const rec = (iso2: string, extra = {}) => ({ iso2, fit: 80, headline: 'Good', reasons: ['Affluent'], risks: [], ...extra });

describe('parseRecommendReply', () => {
  it('keeps only shortlisted, non-starting countries, once each', () => {
    const raw = JSON.stringify({
      summary: 'Two **strong** adds.',
      recommendations: [rec('ES'), rec('es'), rec('xx'), rec('gb'), rec('th', { fit: 140, reasons: ['a', 'b', 'c', 'd', 'e'], risks: ['r1', 'r2', 'r3'] })],
      seedNotes: [{ iso2: 'DE', note: 'Strong' }, { iso2: 'fr', note: 'not a seed' }],
    });
    const r = parseRecommendReply(raw, allowed, seeds)!;
    expect(r.summary).toBe('Two strong adds.');
    expect(r.recommendations.map((x) => x.iso2)).toEqual(['es', 'th']);
    expect(r.recommendations[1].fit).toBe(100);
    expect(r.recommendations[1].reasons).toHaveLength(4);
    expect(r.recommendations[1].risks).toHaveLength(2);
    expect(r.seedNotes).toEqual([{ iso2: 'de', note: 'Strong' }]);
  });

  it('returns null for unusable replies', () => {
    expect(parseRecommendReply('', allowed, seeds)).toBeNull();
    expect(parseRecommendReply('{bad', allowed, seeds)).toBeNull();
    expect(parseRecommendReply(JSON.stringify({ summary: 'x', recommendations: [rec('xx')], seedNotes: [] }), allowed, seeds)).toBeNull();
  });
});

describe('buildRecommendPrompt', () => {
  it('puts the brief and both country tables in, and the schema is closed', () => {
    const p = buildRecommendPrompt({
      decoderName: 'Test',
      industry: 'Luxury real estate',
      objective: 'Investment leads',
      brief: 'Villas',
      destination: 'UAE',
      seeds: [{ iso2: 'gb', name: 'UK', facts: { population: { value: 68e6, year: 2024 } }, distanceKm: 5500 }],
      candidates: [{ iso2: 'es', name: 'Spain', facts: {}, distanceKm: 5300, fit: 99, closestSeed: 'UK', matches: ['income'], gaps: [] }],
    });
    expect(p).toContain('Luxury real estate');
    expect(p).toContain('"populationM":68');
    expect(p).toContain('"lookalikePercentile":99');
    expect(RECOMMEND_SCHEMA.additionalProperties).toBe(false);
  });
});
