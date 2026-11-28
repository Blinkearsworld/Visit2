// Admin changes to bookings, prices and settings: POST /api/admin/action {op, ...}.
// Ported from Villa JIJI functions/api/admin/action.js; every query is scoped to the hotel (t).
import { isDate, today, nowIso, fmtRange } from '../lib/time.js';
import { bestRoom, roomFree, quote } from '../lib/availability.js';
import { loadState, bumpRev, uid } from './hotel.js';
import { can, logAct } from './users.js';
import { saveServices, addItem, getItem, removeItem } from './services.js';

// which section each change belongs to (see admin → გუნდი); 'owner' = only the owner
const NEED = { remark: 'book', edit: 'book', confirm: 'book', decline: 'book', remove: 'book', restore: 'book', add: 'book', price: 'book', pay: 'book', unpay: 'book', move: 'book', guestnote: 'book', purge: 'owner', wipe: 'owner', rates: 'price', setting: 'price', services: 'price', item: 'book', unitem: 'book' };
const METHOD = { card: 'ბარათით', transfer: 'გადარიცხვით', cash: 'ქეშით' };
const NO = msg => ({ ok: false, msg });

// → { status, body }
export async function adminAction(db, t, u, b) {
  const need = NEED[b?.op];
  if (!need) return { status: 400, body: NO('unknown op') };
  if (need === 'owner' ? !u?.owner : !can(u, need)) return { status: 403, body: NO('ამის უფლება არ გაქვთ. მიმართეთ მფლობელს.') };
  // what the change touched, for the activity log
  let bid = b.op === 'pay' || b.op === 'item' ? b.booking : b.op === 'services' ? null : b.id;
  if (b.op === 'unpay') {
    const p = await db.prepare('SELECT booking, amount, method FROM payments WHERE tenant_id = ? AND id = ?').bind(t.id, b.id).first();
    bid = p?.booking; b._pay = p;
  }
  if (b.op === 'unitem') { const it = await getItem(db, t, b.id); bid = it?.booking; b._item = it; }
  const before = bid ? await db.prepare('SELECT * FROM bookings WHERE tenant_id = ? AND id = ?').bind(t.id, bid).first() : null;
  const out = await run(db, t, b);
  if (out.ok !== false && !out.status) {
    await bumpRev(db, t).catch(() => {});
    const who = before ? `${before.name || '—'} · ${fmtRange(before.date_from, before.date_to)}` : '';
    const detail = {
      remark: `${who} · ${String(b.remark || '').trim() ? '„' + String(b.remark).trim().slice(0, 120) + '“' : 'შენიშვნა წაიშალა'}`,
      edit: `${who} · ${[out.was && out.was.dates !== fmtRange(out.from, out.to) ? `თარიღი → ${fmtRange(out.from, out.to)}` : '', out.was && (out.was.guests !== out.guests || out.was.children !== out.children) ? `სტუმრები ${out.was.guests}${out.was.children ? ' (ბავშვი ' + out.was.children + ')' : ''} → ${out.guests}${out.children ? ' (ბავშვი ' + out.children + ')' : ''}` : '', out.was && out.was.price !== out.price ? `ფასი ${out.was.price ?? '—'} → ${out.price} ₾` : ''].filter(Boolean).join(' · ') || 'ცვლილება არ ყოფილა'}`,
      confirm: `${who} · ${out.changedDates ? 'ახალი თარიღი ' + out.changedDates + ' · ' : ''}${out.changedGuests ? 'სტუმრები ' + out.changedGuests + ' · ' : ''}ნომერი ${out.room || ''}${out.changedType ? ` (${out.typeName}; მოითხოვა: ${out.askedName})` : ''} · ${out.price !== out.askedPrice ? `ფასი ${out.askedPrice} → ${out.price} ₾` : out.price + ' ₾'}`,
      move: `${who} · ${before?.room || '—'} → ${b.room}`,
      price: `${who} · ${before?.price ?? '—'} → ${Math.round(+b.price || 0)} ₾`,
      pay: `${who} · ${Math.round(+b.amount || 0)} ₾ ${METHOD[b.method] || ''}`,
      unpay: `${who} · ${b._pay?.amount ?? ''} ₾ ${METHOD[b._pay?.method] || ''}`,
      add: `${b.name || '—'} · ${isDate(b.from) && isDate(b.to) ? fmtRange(b.from, b.to) : ''} · ნომერი ${b.room}`,
      wipe: `წაიშალა ${out.bookings ?? 0} ჯავშანი, ${out.payments ?? 0} გადახდა, ჟურნალი და სტუმრების შენიშვნები`,
      services: `სერვისები: ${out.count ?? 0}`,
      item: `${who} · ${out.item ? `${out.item.name} × ${out.item.qty} = ${out.item.amount} ₾` : ''}`,
      unitem: `${who} · წაიშალა: ${b._item ? `${b._item.name} × ${b._item.qty} = ${b._item.amount} ₾` : ''}`,
      guestnote: `ტელ. …${String(b.k || '').replace(/\D/g, '').slice(-4)}`,
      rates: `${b.type}`,
      setting: b.k === 'promos' ? 'აქციები შეიცვალა' : b.k === 'gapEdits' ? 'მოკლე ფანჯრის ფასი შეიცვალა' : `${b.k} = ${b.v}`,
    }[b.op] ?? who;
    await logAct(db, t, u, b.op, b.op === 'add' ? 'bk:' + (out.id || '') : bid ? 'bk:' + bid : '', detail, b.op === 'pay' || b.op === 'unpay' ? b.id : '');
  }
  const status = out.status || 200; delete out.status;
  return { status, body: out };
}

async function run(db, t, b) {
  const st = await loadState(db, t, { full: true });
  const find = id => st.bookings.find(x => x.id === id);
  const T = t.id;
  switch (b.op) {
    case 'confirm': {
      const r = find(b.id); if (!r) return NO('ჯავშანი ვერ მოიძებნა');
      // dates and guests may have been changed with the guest by phone
      const from = isDate(b.from) ? b.from : r.from, to = isDate(b.to) ? b.to : r.to, guests = Math.max(1, Math.min(50, parseInt(b.guests) || r.guests || 1));
      if (!(to > from)) return NO('გასვლის თარიღი შესვლის შემდეგ უნდა იყოს');
      const room = b.room || bestRoom(st, r.type, from, to);
      if (!room || !st.rooms.some(x => x.id === room) || !roomFree(st, room, from, to, r.id)) return NO(b.room ? 'ნომერი ' + b.room + ' ამ თარიღებზე დაკავებულია' : 'ამ თარიღებზე ' + (st.types[r.type]?.name || '') + ' ნომერი თავისუფალი აღარ არის');
      // the admin may give the guest another room, also of another type
      const type = st.rooms.find(x => x.id === room)?.type || r.type;
      // the price is fixed at confirmation, so later rate changes do not move it
      const price = b.price != null && b.price !== '' ? Math.max(0, Math.round(+b.price || 0)) : quote(st, type, from, to, guests);
      const children = b.children != null ? Math.max(0, Math.min(guests - 1, parseInt(b.children) || 0)) : Math.min(r.children || 0, guests - 1);
      await db.prepare("UPDATE bookings SET room = ?, type = ?, status = 'confirmed', price = ?, date_from = ?, date_to = ?, guests = ?, children = ? WHERE tenant_id = ? AND id = ? AND status = 'pending'")
        .bind(room, type, price, from, to, guests, children, T, r.id).run();
      return { ok: true, room, price, typeName: st.types[type]?.name || type, askedName: st.types[r.type]?.name || r.type, changedType: type !== r.type, askedPrice: r.price ?? quote(st, r.type, r.from, r.to, r.guests),
        changedDates: from !== r.from || to !== r.to ? fmtRange(from, to) : '', changedGuests: guests !== r.guests ? `${r.guests} → ${guests}` : '' };
    }
    case 'remark': {
      if (!find(b.id)) return NO('ჯავშანი ვერ მოიძებნა');
      await db.prepare('UPDATE bookings SET remark = ? WHERE tenant_id = ? AND id = ?').bind(String(b.remark || '').trim().slice(0, 500), T, b.id).run();
      return { ok: true };
    }
    case 'edit': {
      const r = find(b.id); if (!r || r.status !== 'confirmed') return NO('ჯავშანი ვერ მოიძებნა');
      const from = isDate(b.from) ? b.from : r.from, to = isDate(b.to) ? b.to : r.to, guests = Math.max(1, Math.min(50, parseInt(b.guests) || r.guests || 1));
      if (!(to > from)) return NO('გასვლის თარიღი შესვლის შემდეგ უნდა იყოს');
      if (!roomFree(st, r.room, from, to, r.id)) return NO('ნომერი ' + r.room + ' ამ თარიღებზე დაკავებულია');
      const price = b.price != null && b.price !== '' ? Math.max(0, Math.round(+b.price || 0)) : r.price;
      const children = b.children != null ? Math.max(0, Math.min(guests - 1, parseInt(b.children) || 0)) : Math.min(r.children || 0, guests - 1);
      await db.prepare('UPDATE bookings SET date_from = ?, date_to = ?, guests = ?, price = ?, children = ? WHERE tenant_id = ? AND id = ?').bind(from, to, guests, price, children, T, r.id).run();
      return { ok: true, from, to, guests, price, children, was: { dates: fmtRange(r.from, r.to), guests: r.guests, price: r.price, children: r.children || 0 } };
    }
    case 'move': {
      const r = find(b.id); if (!r) return NO('ჯავშანი ვერ მოიძებნა');
      const nr = st.rooms.find(x => x.id === b.room); if (!nr) return NO('ასეთი ნომერი არ არის');
      if (!roomFree(st, nr.id, r.from, r.to, r.id)) return NO('ნომერი ' + nr.id + ' ამ თარიღებზე დაკავებულია');
      await db.prepare('UPDATE bookings SET room = ?, type = ?, price = COALESCE(price, ?) WHERE tenant_id = ? AND id = ?').bind(nr.id, nr.type, quote(st, r.type, r.from, r.to, r.guests), T, r.id).run();
      return { ok: true, room: nr.id };
    }
    case 'decline':
      if (!find(b.id)) return NO('ჯავშანი ვერ მოიძებნა');
      await db.prepare("UPDATE bookings SET status = 'declined' WHERE tenant_id = ? AND id = ?").bind(T, b.id).run();
      return { ok: true };
    // 'remove' moves a booking to the deleted list; 'restore' brings it back; 'purge' deletes it for good
    case 'remove': {
      const x = find(b.id); if (!x) return NO('ჯავშანი ვერ მოიძებნა');
      if (x.status !== 'deleted') await db.prepare("UPDATE bookings SET prev_status = status, status = 'deleted', deleted_at = ? WHERE tenant_id = ? AND id = ?").bind(nowIso(), T, b.id).run();
      return { ok: true };
    }
    case 'restore': {
      const x = find(b.id); if (!x || x.status !== 'deleted') return NO('ჯავშანი ვერ მოიძებნა');
      const back = x.prevStatus || 'pending';
      if (back === 'confirmed' && x.room && !roomFree(st, x.room, x.from, x.to, x.id)) return NO('ნომერი ' + x.room + ' ამ თარიღებზე უკვე დაკავებულია. აღდგენა შეუძლებელია.');
      await db.prepare('UPDATE bookings SET status = ?, prev_status = NULL, deleted_at = NULL WHERE tenant_id = ? AND id = ?').bind(back, T, b.id).run();
      return { ok: true };
    }
    case 'wipe': {
      // the owner starts over: bookings, payments, guest notes, chat state and the journal go;
      // rooms, prices, settings, site texts and the team stay
      if (b.confirm !== 'წაშლა') return NO('დასადასტურებლად ჩაწერეთ სიტყვა „წაშლა“');
      const nb = (await db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE tenant_id = ?').bind(T).first())?.n || 0;
      const np = (await db.prepare('SELECT COUNT(*) AS n FROM payments WHERE tenant_id = ?').bind(T).first())?.n || 0;
      await db.batch([
        db.prepare('DELETE FROM payments WHERE tenant_id = ?').bind(T),
        db.prepare('DELETE FROM booking_items WHERE tenant_id = ?').bind(T),
        db.prepare('DELETE FROM bookings WHERE tenant_id = ?').bind(T),
        db.prepare('DELETE FROM guest_notes WHERE tenant_id = ?').bind(T),
        db.prepare('DELETE FROM convos WHERE tenant_id = ?').bind(T),
        db.prepare('DELETE FROM actlog WHERE tenant_id = ?').bind(T),
      ]);
      return { ok: true, bookings: nb, payments: np };
    }
    case 'purge': {
      const x = find(b.id); if (!x || x.status !== 'deleted') return NO('ჯერ წაშალეთ ჯავშანი');
      await db.batch([
        db.prepare('DELETE FROM bookings WHERE tenant_id = ? AND id = ?').bind(T, b.id),
        db.prepare('DELETE FROM payments WHERE tenant_id = ? AND booking = ?').bind(T, b.id),
        db.prepare('DELETE FROM booking_items WHERE tenant_id = ? AND booking = ?').bind(T, b.id),
      ]);
      return { ok: true };
    }
    case 'add': {
      const room = st.rooms.find(r => r.id === b.room);
      if (!room || !isDate(b.from) || !isDate(b.to) || b.to <= b.from) return NO('შეამოწმეთ ნომერი და თარიღები');
      if (!roomFree(st, room.id, b.from, b.to)) return NO('ნომერი ' + room.id + ' ამ თარიღებზე დაკავებულია');
      const nid = uid(), g = parseInt(b.guests) || 2, kids = Math.max(0, Math.min(g - 1, parseInt(b.children) || 0));
      const price = b.price === '' || b.price == null ? quote(st, room.type, b.from, b.to, g) : Math.max(0, Math.round(+b.price || 0));
      await db.prepare('INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, children) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(T, nid, room.id, room.type, b.from, b.to, g, String(b.name || '').slice(0, 80), String(b.phone || '').slice(0, 30), 'confirmed', 'admin', nowIso(), price, kids).run();
      return { ok: true, id: nid };
    }
    // the hotel's list of services (breakfast, minibar, cleaning...), saved whole from the editor
    case 'services': {
      try { const list = await saveServices(db, t, b.list); return { ok: true, count: list.length, services: list }; }
      catch (e) { return NO('სერვისები ვერ შეინახა'); }
    }
    // a charge on a booking (a service from the list or a one-off); it adds to what the guest owes
    case 'item': {
      if (!find(b.booking)) return NO('ჯავშანი ვერ მოიძებნა');
      try { return { ok: true, item: await addItem(db, t, b.booking, b) }; } catch (e) { return NO(e.message); }
    }
    case 'unitem': {
      if (!b._item || !find(b._item.booking)) return NO('ჩანაწერი ვერ მოიძებნა');
      await removeItem(db, t, b.id);
      return { ok: true };
    }
    case 'rates': {
      if (!st.types[b.type] || !Array.isArray(b.rates)) return NO('bad type');
      const ids = st.seasons.map(s => s.id);
      const clean = b.rates.map(r => ({ guests: Math.max(1, parseInt(r.guests) || 1),
        price: Object.fromEntries(ids.map(k => [k, Math.max(0, Math.round(+r.price?.[k] || 0))])) }))
        .sort((x, y) => x.guests - y.guests);
      await db.prepare('UPDATE types SET rates = ? WHERE tenant_id = ? AND id = ?').bind(JSON.stringify(clean), T, b.type).run();
      return { ok: true };
    }
    case 'price': {
      if (!find(b.id)) return NO('ჯავშანი ვერ მოიძებნა');
      await db.prepare('UPDATE bookings SET price = ? WHERE tenant_id = ? AND id = ?').bind(Math.max(0, Math.round(+b.price || 0)), T, b.id).run();
      return { ok: true };
    }
    case 'pay': {
      const amount = Math.round(+b.amount || 0);
      if (!find(b.booking)) return NO('ჯავშანი ვერ მოიძებნა');
      if (!amount || Math.abs(amount) > 1e7) return NO('ჩაწერეთ თანხა');
      if (!['card', 'transfer', 'cash'].includes(b.method)) return NO('აირჩიეთ გადახდის ხერხი');
      await db.prepare('INSERT INTO payments (tenant_id, id, booking, amount, method, date, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(T, String(b.id || uid()).slice(0, 20), b.booking, amount, b.method, isDate(b.date) ? b.date : today(), nowIso()).run();
      return { ok: true };
    }
    case 'guestnote': {
      const k = String(b.k || '').replace(/\D/g, '').slice(-9), note = String(b.note || '').slice(0, 1000);
      const bday = isDate(b.bday) ? b.bday : '';
      if (k.length < 6) return NO('ტელეფონი არასწორია');
      if (note || bday) await db.prepare('INSERT INTO guest_notes (tenant_id, k, note, bday, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT (tenant_id, k) DO UPDATE SET note = excluded.note, bday = excluded.bday, updated = excluded.updated').bind(T, k, note, bday, nowIso()).run();
      else await db.prepare('DELETE FROM guest_notes WHERE tenant_id = ? AND k = ?').bind(T, k).run();
      return { ok: true };
    }
    case 'unpay':
      await db.prepare('DELETE FROM payments WHERE tenant_id = ? AND id = ?').bind(T, b.id).run();
      return { ok: true };
    case 'setting': {
      const big = ['gapEdits', 'promos'].includes(b.k); // JSON: edits of short gaps, the hotel's promotions
      if (!big && !['seasonMode', 'winterFrom', 'winterTo', 'gapDiscount'].includes(b.k)) return NO('bad setting');
      let v = String(b.v ?? '');
      if (big) { try { JSON.parse(v); } catch (e) { return NO('bad value'); } if (v.length > 20000) return NO('too long'); }
      else v = v.slice(0, 10);
      await db.prepare('INSERT INTO settings (tenant_id, k, v) VALUES (?, ?, ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v').bind(T, b.k, v).run();
      return { ok: true };
    }
  }
  return { ok: false, msg: 'unknown op', status: 400 };
}
