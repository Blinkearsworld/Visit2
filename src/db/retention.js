// Data retention (see public/privacy.html): guests' personal data is not kept longer than needed.
//   - name, phone and requests of a stay are blanked 24 months after check-out (dates and price stay, for statistics);
//   - declined and deleted requests are removed after 90 days; chatbot conversations after 90 days;
//   - guest notes untouched for 24 months are removed.
//   - Visit2's help access ends by itself; expired rows are removed;
//   - records of bank payment pages go together with their booking; so do services charged to a stay;
// Runs daily from the Worker's scheduled handler, one hotel at a time; purgePlatform once a day for Visit2's own tables:
//   - payment records (subscriptions) are kept 7 years for accounting, also after a hotel is deleted, then removed;
//   - notices to hotels are removed 90 days after they end; our done to-dos after 12 months (they hold owners' emails).
import { addDays, today } from '../lib/time.js';

export async function purgeHotel(db, t, day = today()) {
  const stayCut = addDays(day, -730), oldCut = new Date(Date.parse(addDays(day, -90) + 'T00:00:00Z')).toISOString();
  const guestCut = new Date(Date.parse(stayCut + 'T00:00:00Z')).toISOString();
  const r = await db.batch([
    db.prepare("UPDATE bookings SET name = '', phone = '', wish = '', remark = '' WHERE tenant_id = ? AND date_to < ? AND (name != '' OR phone != '')").bind(t.id, stayCut),
    db.prepare("DELETE FROM bookings WHERE tenant_id = ? AND status IN ('declined', 'deleted') AND created < ?").bind(t.id, oldCut),
    db.prepare('DELETE FROM payments WHERE tenant_id = ? AND booking NOT IN (SELECT id FROM bookings WHERE tenant_id = ?)').bind(t.id, t.id),
    // services charged to a stay go together with their booking
    db.prepare('DELETE FROM booking_items WHERE tenant_id = ? AND booking NOT IN (SELECT id FROM bookings WHERE tenant_id = ?)').bind(t.id, t.id),
    // bank payment pages: kept with their booking (the hotel's own records), gone once the booking is gone
    db.prepare('DELETE FROM pay_orders WHERE tenant_id = ? AND booking NOT IN (SELECT id FROM bookings WHERE tenant_id = ?) AND booking NOT IN (SELECT grp FROM bookings WHERE tenant_id = ? AND grp IS NOT NULL)').bind(t.id, t.id, t.id),
    db.prepare('DELETE FROM convos WHERE tenant_id = ? AND updated < ?').bind(t.id, oldCut),
    db.prepare('DELETE FROM guest_notes WHERE tenant_id = ? AND updated < ?').bind(t.id, guestCut),
    db.prepare('DELETE FROM support_access WHERE tenant_id = ? AND until < ?').bind(t.id, Date.now()),
  ]);
  return { blanked: r[0].meta.changes, removed: r[1].meta.changes };
}

export async function purgePlatform(db, day = today()) {
  await db.batch([
    // tenant_id is kept on purpose: the rows of deleted hotels stay until their 7 years are over
    db.prepare('DELETE FROM subscriptions WHERE tenant_id IS NOT NULL AND created < ?').bind(addDays(day, -7 * 365) + 'T00:00:00Z'),
    db.prepare('DELETE FROM notices WHERE date_to < ?').bind(addDays(day, -90)),
    db.prepare("DELETE FROM tasks WHERE status = 'done' AND done_at < ?").bind(addDays(day, -365) + 'T00:00:00Z'),
  ]);
}
