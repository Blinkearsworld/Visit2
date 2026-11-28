// Calendars of other sites (Booking.com, Airbnb ...) for each room, and this hotel's calendar for them.
// Imported stays close the room here (room_blocks with feed); they hold dates only, no guest data.
import { parseIcs, buildIcs } from '../lib/ical.js';
import { today, addDays, nowIso } from '../lib/time.js';

const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const rowToFeed = r => ({ id: r.id, room: r.room, name: r.name, url: r.url, lastSync: r.last_sync || '', lastError: r.last_error || '' });

export async function listFeeds(db, t) {
  const r = await db.prepare('SELECT * FROM ical_feeds WHERE tenant_id = ? ORDER BY room, created').bind(t.id).all();
  return (r.results || []).map(rowToFeed);
}
// only https addresses of other calendars; never this server's own addresses
export function goodUrl(u) {
  try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' && !/(^|\.)visit2\.ge$|^localhost$|^127\.|^10\.|^192\.168\./.test(x.hostname) ? x.toString() : null; } catch (e) { return null; }
}
export async function addFeed(db, t, { room, name, url }) {
  const u = goodUrl(url); if (!u) throw new Error('ჩასვით კალენდრის სრული ბმული (https://…)');
  const id = uid();
  await db.prepare('INSERT INTO ical_feeds (tenant_id, id, room, name, url, created) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(t.id, id, String(room), String(name || 'კალენდარი').trim().slice(0, 40), u, nowIso()).run();
  return id;
}
export async function removeFeed(db, t, id) {
  await db.batch([
    db.prepare('DELETE FROM room_blocks WHERE tenant_id = ? AND feed = ?').bind(t.id, id),
    db.prepare('DELETE FROM ical_feeds WHERE tenant_id = ? AND id = ?').bind(t.id, id),
  ]);
}

// reads one calendar and replaces the room's closed days from it (past stays are left out)
export async function syncFeed(db, t, feed, fetcher = fetch) {
  try {
    const res = await fetcher(feed.url, { headers: { 'user-agent': 'Visit2.ge calendar sync' }, redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('ეს ბმული კალენდარი არ არის');
    const from0 = today(), until = addDays(from0, 730);
    const evs = parseIcs(text).filter(e => e.to > from0 && e.from < until).slice(0, 1000);
    await db.batch([
      db.prepare('DELETE FROM room_blocks WHERE tenant_id = ? AND feed = ?').bind(t.id, feed.id),
      ...evs.map(e => db.prepare('INSERT INTO room_blocks (tenant_id, id, room, date_from, date_to, reason, created, feed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(t.id, uid(), feed.room, e.from, e.to, feed.name, nowIso(), feed.id)),
      db.prepare('UPDATE ical_feeds SET last_sync = ?, last_error = NULL WHERE tenant_id = ? AND id = ?').bind(nowIso(), t.id, feed.id),
    ]);
    return { ok: true, events: evs.length };
  } catch (e) {
    await db.prepare('UPDATE ical_feeds SET last_error = ? WHERE tenant_id = ? AND id = ?').bind(String(e.message || e).slice(0, 200), t.id, feed.id).run();
    return { ok: false, error: e.message };
  }
}
export async function syncAll(db, t, fetcher) {
  const out = [];
  for (const f of await listFeeds(db, t)) out.push(await syncFeed(db, t, f, fetcher));
  return out;
}

// this hotel's calendar of one room for other sites: confirmed stays and closed days, except those that came from that same site
export async function roomIcs(db, t, room, skipFeedHost) {
  const [b, k] = await Promise.all([
    db.prepare("SELECT id, date_from, date_to FROM bookings WHERE tenant_id = ? AND room = ? AND status = 'confirmed' AND date_to >= ?").bind(t.id, room, today()).all(),
    db.prepare('SELECT b.id, b.date_from, b.date_to, f.url FROM room_blocks b LEFT JOIN ical_feeds f ON f.tenant_id = b.tenant_id AND f.id = b.feed WHERE b.tenant_id = ? AND b.room = ? AND b.date_to >= ?').bind(t.id, room, today()).all(),
  ]);
  const host = u => { try { return new URL(u).hostname.split('.').slice(-2).join('.'); } catch (e) { return ''; } };
  const events = [
    ...(b.results || []).map(x => ({ uid: `b-${x.id}@${t.slug}.visit2.ge`, from: x.date_from, to: x.date_to, summary: 'Booked' })),
    ...(k.results || []).filter(x => !(skipFeedHost && x.url && host(x.url) === skipFeedHost)).map(x => ({ uid: `c-${x.id}@${t.slug}.visit2.ge`, from: x.date_from, to: x.date_to, summary: 'Not available' })),
  ];
  return buildIcs({ name: `${t.name} · ${room}`, events, stamp: nowIso().replace(/[-:]/g, '').replace(/\.\d+/, '') });
}
