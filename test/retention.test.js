import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { purgeHotel } from '../src/db/retention.js';

const add = (t, id, to, status, created) => env.DB.prepare(
  "INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, created) VALUES (?, ?, '1', 'std', ?, ?, 2, 'სტუმარი', '599111222', ?, ?)"
).bind(t.id, id, to, to, status, created).run();
const row = (t, id) => env.DB.prepare('SELECT name, phone, date_to FROM bookings WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();

describe('data retention', () => {
  let A, B;
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'keep-a', name: 'A' });
    B = await createTenant(env.DB, { slug: 'keep-b', name: 'B' });
    await add(A, 'old', '2024-01-10', 'confirmed', '2023-12-01T00:00:00Z');
    await add(A, 'recent', '2026-06-10', 'confirmed', '2026-05-01T00:00:00Z');
    await add(A, 'declined', '2026-12-10', 'declined', '2026-01-01T00:00:00Z');
    await add(B, 'old', '2024-01-10', 'confirmed', '2023-12-01T00:00:00Z');
  });

  it('blanks guest details 24 months after check-out, keeps dates', async () => {
    const r = await purgeHotel(env.DB, A, '2026-11-23');
    expect(r.blanked).toBe(1);
    expect(await row(A, 'old')).toEqual({ name: '', phone: '', date_to: '2024-01-10' });
    expect((await row(A, 'recent')).name).toBe('სტუმარი');
  });
  it('removes old declined requests', async () => {
    expect(await row(A, 'declined')).toBeNull();
  });
  it('touches only its own hotel', async () => {
    expect((await row(B, 'old')).name).toBe('სტუმარი');
  });
});
