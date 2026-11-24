// Data retention (see public/privacy.html): guests' personal data is not kept longer than needed.
//   - name, phone and requests of a stay are blanked 24 months after check-out (dates and price stay, for statistics);
//   - declined and deleted requests are removed after 90 days; chatbot conversations after 90 days;
//   - guest notes untouched for 24 months are removed.
// Runs daily from the Worker's scheduled handler, one hotel at a time.
import { addDays, today } from '../lib/time.js';

export async function purgeHotel(db, t, day = today()) {
  const stayCut = addDays(day, -730), oldCut = new Date(Date.parse(addDays(day, -90) + 'T00:00:00Z')).toISOString();
  const guestCut = new Date(Date.parse(stayCut + 'T00:00:00Z')).toISOString();
  const r = await db.batch([
    db.prepare("UPDATE bookings SET name = '', phone = '', wish = '', remark = '' WHERE tenant_id = ? AND date_to < ? AND (name != '' OR phone != '')").bind(t.id, stayCut),
    db.prepare("DELETE FROM bookings WHERE tenant_id = ? AND status IN ('declined', 'deleted') AND created < ?").bind(t.id, oldCut),
    db.prepare('DELETE FROM payments WHERE tenant_id = ? AND booking NOT IN (SELECT id FROM bookings WHERE tenant_id = ?)').bind(t.id, t.id),
    db.prepare('DELETE FROM convos WHERE tenant_id = ? AND updated < ?').bind(t.id, oldCut),
    db.prepare('DELETE FROM guest_notes WHERE tenant_id = ? AND updated < ?').bind(t.id, guestCut),
  ]);
  return { blanked: r[0].meta.changes, removed: r[1].meta.changes };
}
