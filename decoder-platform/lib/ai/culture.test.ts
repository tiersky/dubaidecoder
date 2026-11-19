import { describe, it, expect } from 'vitest';
import { buildCulturePrompt, parseCultureReading } from './culture';
import { cultureProfile } from '@/lib/insights/hofstede';

const valid = {
  headline: 'Anglo markets align; UAE needs a separate approach',
  summary: 'UK and USA are close. The UAE differs.',
  points: [{ title: 'Self versus family', detail: 'Individualism 89 vs 38.' }],
  implication: 'Run two creative platforms.',
};

describe('parseCultureReading', () => {
  it('accepts a valid object wrapped in prose and strips markdown', () => {
    const raw = `Here you go:\n${JSON.stringify({ ...valid, headline: '**Anglo markets align**' })}\nThanks`;
    expect(parseCultureReading(raw)?.headline).toBe('Anglo markets align');
  });
  it('caps points at four and rejects missing fields or bad JSON', () => {
    const many = { ...valid, points: Array.from({ length: 6 }, (_, i) => ({ title: `T${i}`, detail: 'd' })) };
    expect(parseCultureReading(JSON.stringify(many))?.points).toHaveLength(4);
    expect(parseCultureReading(JSON.stringify({ ...valid, implication: '' }))).toBeNull();
    expect(parseCultureReading('{not json')).toBeNull();
    expect(parseCultureReading('')).toBeNull();
  });
});

describe('buildCulturePrompt', () => {
  it('includes scores, regional flags and the target only when given', () => {
    const subjects = [{ name: 'UAE', profile: cultureProfile('ae')! }];
    const p = buildCulturePrompt({ subjects, target: null, industry: 'Real estate', brief: null, decoderName: 'D' });
    expect(p).toContain('"regionalEstimates"');
    expect(p).not.toContain('targetProfile');
    const withTarget = buildCulturePrompt({ subjects, target: { pdi: 1, idv: 2, mas: 3, uai: 4, lto: 5, ivr: 6 }, industry: null, brief: null, decoderName: 'D' });
    expect(withTarget).toContain('"targetProfile"');
  });
});
