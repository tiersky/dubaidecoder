import { describe, it, expect } from 'vitest';
import { countriesFromTopology, distanceKm, flightHours } from './universe';

// Two tiny polygons: UK (826, curated coordinates win) and Vietnam (704, centroid).
const topology = {
  type: 'Topology',
  arcs: [
    [[0, 50], [2, 50], [2, 52], [0, 52], [0, 50]],
    [[105, 15], [105, 17], [107, 17], [107, 15], [105, 15]],
  ],
  objects: {
    countries: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '826', arcs: [[0]], properties: { name: 'United Kingdom' } },
        { type: 'Polygon', id: '704', arcs: [[1]], properties: { name: 'Vietnam' } },
        { type: 'Polygon', id: '-99', arcs: [[1]], properties: { name: 'N. Cyprus' } },
      ],
    },
  },
};

describe('countriesFromTopology', () => {
  it('maps numeric ids to iso2, prefers curated coordinates, else the centroid', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cs = countriesFromTopology(topology as any);
    const uk = cs.find((c) => c.iso2 === 'gb')!;
    expect(uk.name).toBe('UK');
    expect(uk.lat).toBeCloseTo(55.38, 1);
    const vn = cs.find((c) => c.iso2 === 'vn')!;
    expect(vn.lat).toBeCloseTo(16, 0);
    expect(vn.lng).toBeCloseTo(106, 0);
    expect(cs).toHaveLength(2);
  });
});

describe('distanceKm', () => {
  it('is symmetric, zero on itself, and matches a known route', () => {
    const dubai = { lat: 25.2, lng: 55.27 };
    const london = { lat: 51.5, lng: -0.13 };
    expect(distanceKm(dubai, dubai)).toBe(0);
    expect(distanceKm(dubai, london)).toBeCloseTo(distanceKm(london, dubai), 6);
    expect(distanceKm(dubai, london)).toBeGreaterThan(5400);
    expect(distanceKm(dubai, london)).toBeLessThan(5550);
    expect(flightHours(5500)).toBeCloseTo(7.575, 3);
  });
});
