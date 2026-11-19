import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DIMENSIONS, allProfiles, cultureProfile, fitScore, type Scores } from './hofstede';
import { parseImfCsv, parseOwidCsv, parseWorldBank, iso3Of } from './sources';
import { formatFact } from './facts';

const EQUAL = Object.fromEntries(DIMENSIONS.map((d) => [d.key, 1])) as Record<(typeof DIMENSIONS)[number]['key'], number>;
const scoresArb = fc.record(Object.fromEntries(DIMENSIONS.map((d) => [d.key, fc.integer({ min: 0, max: 120 })]))) as fc.Arbitrary<Scores>;

describe('cultureProfile', () => {
  it('returns own scores for a fully covered country', () => {
    const gb = cultureProfile('GB')!;
    expect(gb.scores).toEqual({ pdi: 35, idv: 89, mas: 66, uai: 35, lto: 51, ivr: 69 });
    expect(gb.regional).toEqual([]);
  });

  it('fills Arab markets from the regional row and says which dimensions are estimates', () => {
    const eg = cultureProfile('eg')!;
    expect(eg.scores.lto).toBe(7); // Egypt's own score
    expect(eg.scores.pdi).toBe(80); // Arab countries row
    expect(eg.regional).toEqual(['pdi', 'idv', 'mas', 'uai']);
    expect(cultureProfile('ae')!.regional).toHaveLength(6);
  });

  it('returns null for partial non-Arab rows and unknown codes', () => {
    expect(cultureProfile('al')).toBeNull(); // Albania: 2 of 6
    expect(cultureProfile('zz')).toBeNull();
    expect(cultureProfile(null)).toBeNull();
  });

  it('allProfiles lists only countries with all six own scores', () => {
    const all = allProfiles();
    expect(all.length).toBeGreaterThan(60);
    expect(all.every((p) => p.regional.length === 0)).toBe(true);
  });
});

describe('fitScore', () => {
  it('is 100 for identical profiles and stays within 0..100', () => {
    fc.assert(
      fc.property(scoresArb, scoresArb, (a, b) => {
        expect(fitScore(a, a, EQUAL)).toBeCloseTo(100);
        const f = fitScore(a, b, EQUAL);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(100);
        expect(fitScore(b, a, EQUAL)).toBeCloseTo(f); // symmetric
      })
    );
  });

  it('ignores dimensions with zero weight', () => {
    const a: Scores = { pdi: 0, idv: 50, mas: 50, uai: 50, lto: 50, ivr: 50 };
    const b: Scores = { ...a, pdi: 100 };
    expect(fitScore(a, b, { ...EQUAL, pdi: 0 })).toBeCloseTo(100);
    expect(fitScore(a, b, EQUAL)).toBeLessThan(100);
  });
});

describe('source parsers', () => {
  it('parses IMF SDMX CSV by country, indicator and year, skipping other indicators and blanks', () => {
    const csv = [
      'STRUCTURE[;],STRUCTURE_ID,ACTION,COUNTRY,INDICATOR,FREQUENCY,TIME_PERIOD,OBS_VALUE,SCALE',
      'dataflow,IMF.RES:WEO(9.0.0),R,GBR,NGDP_RPCH,A,2026,1.27,0',
      'dataflow,IMF.RES:WEO(9.0.0),R,GBR,PCPIPCH,A,2026,3.1,0',
      'dataflow,IMF.RES:WEO(9.0.0),R,GBR,LUR,A,2026,5.2,0',
      'dataflow,IMF.RES:WEO(9.0.0),R,ARE,NGDP_RPCH,A,2027,,0',
    ].join('\n');
    const m = parseImfCsv(csv);
    expect(m.get('GBR')?.get('NGDP_RPCH')?.get(2026)).toBe(1.27);
    expect(m.get('GBR')?.get('PCPIPCH')?.get(2026)).toBe(3.1);
    expect(m.get('GBR')?.has('LUR' as never)).toBe(false);
    expect(m.get('ARE')).toBeUndefined();
  });

  it('keeps the latest non-null World Bank value per country', () => {
    const json = [
      { page: 1 },
      [
        { countryiso3code: 'GBR', date: '2024', value: 95.4 },
        { countryiso3code: 'GBR', date: '2023', value: 94 },
        { countryiso3code: 'ARE', date: '2025', value: null },
      ],
    ];
    const m = parseWorldBank(json);
    expect(m.get('GBR')).toEqual({ value: 95.4, year: 2024 });
    expect(m.has('ARE')).toBe(false);
    expect(parseWorldBank({ message: 'error' }).size).toBe(0);
  });

  it('parses OWID CSV with quoted entity names', () => {
    const csv = 'Entity,Code,Year,Value\n"Korea, South",KOR,2025,5.9\nWorld,OWID_WRL,2025,5.5\nGhana,,2025,4.4';
    const m = parseOwidCsv(csv);
    expect(m.get('KOR')).toEqual({ value: 5.9, year: 2025 });
    expect(m.has('')).toBe(false);
  });

  it('maps ISO2 to ISO3', () => {
    expect(iso3Of('gb')).toBe('GBR');
    expect(iso3Of('ae')).toBe('ARE');
    expect(iso3Of('xx')).toBeNull();
  });

  it('formats each unit', () => {
    expect(formatFact('pct', 2.327)).toBe('2.3%');
    expect(formatFact('usd', 57602.4)).toBe('$57,602');
    expect(formatFact('people', 68_300_000)).toBe('68.3M');
    expect(formatFact('index', 0.9401)).toBe('0.940');
  });
});
