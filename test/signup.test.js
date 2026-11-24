import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { signUp, slugify } from '../src/db/signup.js';
import { loadState } from '../src/db/hotel.js';
import { getContent } from '../src/db/content.js';
import { checkLogin } from '../src/db/users.js';

const db = () => env.DB;
const form = o => ({ name: 'ვილა მზიური', city: 'ბაკურიანი', email: 'a@example.com', password: 'long-password-1', theme: 'jade', agree: true, ...o });

describe('self sign-up', () => {
  it('turns Georgian and Russian names into a latin address', () => {
    expect(slugify('ვილა მზიური')).toBe('vila-mziuri');
    expect(slugify('Отель Горы')).toBe('otel-gory');
    expect(slugify('!!')).toMatch(/^hotel-/);
  });

  it('creates a hotel with its owner, sample rooms and the chosen template', async () => {
    const r = await signUp(db(), form({ email: 'owner-a@example.com' }));
    expect(r.ok).toBe(true);
    const t = r.tenant;
    expect(t.slug).toBe('vila-mziuri');
    expect(t.status).toBe('trial');
    expect((await loadState(db(), t)).rooms.length).toBe(5);
    expect((await getContent(db(), t)).content.site.theme).toBe('jade');
    expect((await checkLogin(db(), t, 'owner-a@example.com', 'long-password-1'))?.owner).toBe(true);
  });

  it('gives a second hotel with the same name its own address, and keeps the two apart', async () => {
    const a = (await signUp(db(), form({ name: 'Twin', email: 'twin-a@example.com' }))).tenant;
    const b = (await signUp(db(), form({ name: 'Twin', email: 'twin-b@example.com' }))).tenant;
    expect(a.slug).toBe('twin');
    expect(b.slug).toBe('twin-2');
    // the owner of A cannot sign in to B, and the other way round
    expect(await checkLogin(db(), b, 'twin-a@example.com', 'long-password-1')).toBeFalsy();
    expect(await checkLogin(db(), a, 'twin-b@example.com', 'long-password-1')).toBeFalsy();
  });

  it('does not attach a hotel to an email that already has an account', async () => {
    await signUp(db(), form({ name: 'First', email: 'taken@example.com' }));
    const r = await signUp(db(), form({ name: 'Second', email: 'taken@example.com', password: 'other-password' }));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('email');
    expect(await db().prepare("SELECT 1 FROM tenants WHERE slug = 'second'").first()).toBeNull();
  });

  it('asks for what is missing instead of creating anything', async () => {
    for (const [o, field] of [[{ name: 'x' }, 'name'], [{ email: 'nope' }, 'email'], [{ password: 'short' }, 'password'], [{ agree: false }, 'agree']]) {
      const r = await signUp(db(), form({ ...o, email: o.email || `m-${field}@example.com` }));
      expect(r.ok).toBe(false);
      expect(r.field).toBe(field);
    }
  });
});
