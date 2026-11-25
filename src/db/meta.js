// A hotel's Facebook page (and the Instagram account linked to it), and the bot's conversations.
// The page token is stored sealed (src/lib/crypto.js); a page belongs to exactly one hotel.
import { seal, open } from '../lib/crypto.js';
import { nowIso } from '../lib/time.js';
import { tenantById } from './tenants.js';

// which hotel a message is for: the page (or Instagram account) id from Meta's webhook
export async function tenantOfPage(db, pageId) {
  const r = await db.prepare('SELECT tenant_id FROM meta_pages WHERE page_id = ?').bind(String(pageId)).first();
  return r ? tenantById(db, r.tenant_id) : null;
}
export async function pageToken(db, t, pageId, key) {
  const r = await db.prepare('SELECT token_enc FROM meta_pages WHERE tenant_id = ? AND page_id = ?').bind(t.id, String(pageId)).first();
  return r && r.token_enc ? open(key, r.token_enc) : null;
}
export async function hotelPages(db, t) {
  const r = await db.prepare('SELECT page_id, channel, connected FROM meta_pages WHERE tenant_id = ? ORDER BY channel').bind(t.id).all();
  return r.results || [];
}
// connect: one Facebook page (and its Instagram account, if linked). A page already taken by another hotel is refused.
export async function connectPage(db, t, { pageId, igId, token }, key) {
  const taken = await db.prepare('SELECT tenant_id FROM meta_pages WHERE page_id IN (?, ?) AND tenant_id != ?').bind(String(pageId), String(igId || '-'), t.id).first();
  if (taken) throw new Error('page belongs to another hotel');
  const sealed = await seal(key, token), at = nowIso();
  const q = [db.prepare('DELETE FROM meta_pages WHERE tenant_id = ?').bind(t.id),
    db.prepare("INSERT INTO meta_pages (page_id, tenant_id, channel, token_enc, connected) VALUES (?, ?, 'fb', ?, ?)").bind(String(pageId), t.id, sealed, at)];
  if (igId) q.push(db.prepare("INSERT INTO meta_pages (page_id, tenant_id, channel, token_enc, connected) VALUES (?, ?, 'ig', ?, ?)").bind(String(igId), t.id, sealed, at));
  await db.batch(q);
}
export async function disconnectPages(db, t) {
  await db.batch([db.prepare('DELETE FROM meta_pages WHERE tenant_id = ?').bind(t.id), db.prepare("DELETE FROM settings WHERE tenant_id = ? AND k = 'meta_pending'").bind(t.id)]);
}
// pages found at sign-in, waiting for the owner to pick one (15 minutes, sealed)
export async function savePending(db, t, pages, key) {
  await db.prepare("INSERT INTO settings (tenant_id, k, v) VALUES (?, 'meta_pending', ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v")
    .bind(t.id, JSON.stringify({ until: Date.now() + 15 * 60e3, data: await seal(key, JSON.stringify(pages)) })).run();
}
export async function takePending(db, t, key) {
  const r = await db.prepare("SELECT v FROM settings WHERE tenant_id = ? AND k = 'meta_pending'").bind(t.id).first();
  if (!r) return null;
  try { const o = JSON.parse(r.v); return o.until > Date.now() ? JSON.parse(await open(key, o.data)) : null; } catch (e) { return null; }
}

// conversations (the bot's place in the talk with one guest); removed after 90 days (retention.js)
export async function getConvo(db, t, id) {
  const r = await db.prepare('SELECT state FROM convos WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
  try { return r ? JSON.parse(r.state) : { step: 'new' }; } catch (e) { return { step: 'new' }; }
}
export const saveConvo = (db, t, id, c) => db.prepare('INSERT INTO convos (tenant_id, id, state, updated) VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id, id) DO UPDATE SET state = excluded.state, updated = excluded.updated')
  .bind(t.id, id, JSON.stringify(c), nowIso()).run();
export const forgetConvo = (db, t, id) => db.prepare('DELETE FROM convos WHERE tenant_id = ? AND id = ?').bind(t.id, id).run();
