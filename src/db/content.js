// Editable site content (admin → საიტის მართვა): versions of one JSON document per hotel, and its uploaded photos.
// The JSON holds only what the hotel changed; everything else comes from the site template and public/js/content.js.
// Ported from Villa JIJI functions/_lib/content.js.
import { nowIso } from '../lib/time.js';
import { cleanContent } from './clean.js';

const KEEP = 20;
export const MAX_MEDIA = 1900000; // a D1 row holds up to 2 MB; the admin shrinks photos to ~1600 px first
const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };

export async function getContent(db, t) {
  const r = await db.prepare('SELECT id, v, created FROM site_content WHERE tenant_id = ? ORDER BY id DESC LIMIT 1').bind(t.id).first();
  if (!r) return { content: {}, ver: 0 };
  let content = {};
  try { content = JSON.parse(r.v); } catch (e) { /* broken row: serve defaults */ }
  return { content, ver: r.id, saved: r.created };
}

export async function listVersions(db, t) {
  const r = await db.prepare('SELECT id, created, note, length(v) AS size FROM site_content WHERE tenant_id = ? ORDER BY id DESC LIMIT 20').bind(t.id).all();
  return r.results || [];
}

export async function getVersion(db, t, id) {
  const r = await db.prepare('SELECT v FROM site_content WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
  return r ? JSON.parse(r.v) : null;
}

export async function saveContent(db, t, content, note = '') {
  const v = JSON.stringify(cleanContent(content));
  if (v.length > 900000) throw new Error('content too large');
  await db.batch([
    db.prepare('INSERT INTO site_content (tenant_id, v, created, note) VALUES (?, ?, ?, ?)').bind(t.id, v, nowIso(), String(note).slice(0, 80)),
    // keep the last KEEP versions so an older one can be restored
    db.prepare('DELETE FROM site_content WHERE tenant_id = ? AND id NOT IN (SELECT id FROM site_content WHERE tenant_id = ? ORDER BY id DESC LIMIT ?)').bind(t.id, t.id, KEEP),
  ]);
  await cleanMedia(db, t);
  return getContent(db, t);
}

// photos no saved version uses any more, older than a day (fresh uploads may not be saved yet)
async function cleanMedia(db, t) {
  const all = await db.prepare('SELECT v FROM site_content WHERE tenant_id = ?').bind(t.id).all();
  const used = new Set();
  for (const r of all.results || []) for (const m of r.v.matchAll(/media\/([\w.-]+)/g)) used.add(m[1]);
  const old = await db.prepare('SELECT id FROM media WHERE tenant_id = ? AND created < ?').bind(t.id, new Date(Date.now() - 864e5).toISOString()).all();
  const drop = (old.results || []).map(r => r.id).filter(id => !used.has(id));
  if (drop.length) await db.batch(drop.map(id => db.prepare('DELETE FROM media WHERE tenant_id = ? AND id = ?').bind(t.id, id)));
}

// → { id, url } or { error, status }
export async function putMedia(db, t, buf, mime) {
  if (!TYPES[mime]) return { error: 'only photos (webp, jpg, png)', status: 415 };
  if (!buf.byteLength) return { error: 'empty file', status: 400 };
  if (buf.byteLength > MAX_MEDIA) return { error: 'photo too large', status: 413 };
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20) + '.' + TYPES[mime];
  await db.prepare('INSERT INTO media (tenant_id, id, mime, data, size, created) VALUES (?, ?, ?, ?, ?, ?)').bind(t.id, id, mime, buf, buf.byteLength, nowIso()).run();
  return { ok: true, id, url: 'media/' + id };
}

export async function getMedia(db, t, id) {
  return db.prepare('SELECT mime, data FROM media WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
}
