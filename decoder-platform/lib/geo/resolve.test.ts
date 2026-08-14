import { describe, it, expect } from 'vitest';
import { resolveCountry } from './resolve';

describe('resolveCountry', () => {
  it('resolves canonical names', () => {
    expect(resolveCountry('Germany')).toMatchObject({ iso2: 'de' });
    expect(resolveCountry('Saudi Arabia')).toMatchObject({ iso2: 'sa' });
    expect(resolveCountry('Qatar')).toMatchObject({ iso2: 'qa' });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveCountry('  germany ')).toMatchObject({ iso2: 'de' });
    expect(resolveCountry('CZECH REPUBLIC')).toMatchObject({ iso2: 'cz' });
  });

  it('resolves workbook aliases and known misspellings', () => {
    expect(resolveCountry('UK')).toMatchObject({ iso2: 'gb' });
    expect(resolveCountry('USA')).toMatchObject({ iso2: 'us' });
    expect(resolveCountry('Khazakhstan')).toMatchObject({ iso2: 'kz' }); // real workbook spelling
    expect(resolveCountry('UAE')).toMatchObject({ iso2: 'ae' });
    expect(resolveCountry('Türkiye')).toMatchObject({ iso2: 'tr' });
  });

  it('returns null for unknowns (caller flags them on the confirm screen)', () => {
    expect(resolveCountry('Atlantis')).toBeNull();
    expect(resolveCountry('')).toBeNull();
  });

  it('returns coordinates usable by the world map', () => {
    const r = resolveCountry('Japan')!;
    expect(r.lat).toBeCloseTo(36.2048, 1);
    expect(r.lng).toBeCloseTo(138.2529, 1);
  });
});
