import { describe, it, expect } from 'vitest';
import { today, addDays, nights, isDate } from '../src/lib/time.js';
import { seasonOf } from '../src/lib/seasons.js';
import { MOUNTAIN_SEASONS } from '../src/db/tenants.js';

describe('Georgian time', () => {
  it('is UTC+4: 21:00 in California on Nov 23 is already Nov 24 in Georgia', () => {
    expect(today(Date.parse('2026-11-24T05:00:00Z'))).toBe('2026-11-24');
    expect(today(Date.parse('2026-11-23T19:59:00Z'))).toBe('2026-11-23');
    expect(today(Date.parse('2026-11-23T20:00:00Z'))).toBe('2026-11-24');
  });
  it('date helpers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(nights('2026-12-30', '2027-01-02')).toBe(3);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2026-02-28')).toBe(true);
  });
});

// Villa JIJI's season rule from functions/_lib/core.js, kept here to prove the table form gives the same answer.
const villaJiji = s => {
  const [, m, d] = s.split('-').map(Number);
  if ((m === 12 && d >= 25) || (m === 1 && d <= 7)) return 'peak';
  if (m === 12 || m <= 3) return 'winter';
  if (m >= 6 && m <= 8) return 'summer';
  return 'off';
};

describe('seasons', () => {
  const seasons = MOUNTAIN_SEASONS.map((s, i) => ({ ...s, sort: i }));
  it('the mountain template matches Villa JIJI on every day of a leap year', () => {
    for (let d = '2028-01-01'; d < '2029-01-01'; d = addDays(d, 1)) expect([d, seasonOf(seasons, d)]).toEqual([d, villaJiji(d)]);
  });
  it('a seaside hotel can have its own seasons', () => {
    const sea = [{ id: 'high', from: '07-01', to: '08-31' }, { id: 'mid', from: '06-01', to: '09-30' }, { id: 'low', from: '01-01', to: '12-31' }];
    expect(seasonOf(sea, '2026-07-15')).toBe('high');
    expect(seasonOf(sea, '2026-09-10')).toBe('mid');
    expect(seasonOf(sea, '2026-12-31')).toBe('low');
  });
});
