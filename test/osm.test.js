import { describe, it, expect } from 'vitest';
import '../public/js/osm.js';
const { toPlaces, kindOf } = globalThis.V2OSM;

describe('places nearby (OpenStreetMap)', () => {
  it('sorts by distance, drops far and nameless places, duplicates and unsafe links', () => {
    const el = [
      { type: 'node', id: 1, lat: 41.752, lon: 43.527, tags: { name: 'Far Cafe', amenity: 'cafe' } },
      { type: 'node', id: 2, lat: 41.7513, lon: 43.5269, tags: { name: 'Near', 'name:en': 'Near EN', amenity: 'restaurant', cuisine: 'georgian;pizza', website: 'javascript:alert(1)' } },
      { type: 'way', id: 3, center: { lat: 41.7514, lon: 43.5270 }, tags: { name: 'Near', amenity: 'restaurant', cuisine: 'georgian' } },
      { type: 'node', id: 4, lat: 41.7512, lon: 43.5268, tags: { amenity: 'cafe' } },
      { type: 'node', id: 5, lat: 42.5, lon: 44.5, tags: { name: 'Other town', amenity: 'bar' } },
    ];
    const p = toPlaces(el, 41.7512, 43.5268);
    expect(p.map(x => x.id)).toEqual(['n2', 'n1']);
    expect(p[0].name.en).toBe('Near EN');
    expect(p[0].kind).toBe('georgian');
    expect(p[0].web).toBe('');
  });
  it('names kinds', () => {
    expect(kindOf({ amenity: 'cafe' })).toBe('cafe');
    expect(kindOf({ shop: 'bakery' })).toBe('bakery');
    expect(kindOf({ amenity: 'bar', name: 'Wine Bar' })).toBe('wine');
    expect(kindOf({ amenity: 'restaurant', cuisine: 'seafood' })).toBe('fish');
    expect(kindOf({ amenity: 'restaurant' })).toBe('restaurant');
  });
});
