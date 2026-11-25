// Prepayment through the hotel's own bank. Every function takes the hotel (t) first; tenant_id is in every query.
// The hotel's merchant credentials are sealed with ENC_KEY; the guest's card never reaches us.
import { seal, open } from '../lib/crypto.js';
import { nowIso } from '../lib/time.js';

export const HOLD_MIN = 20; // minutes an unpaid instant booking keeps its room
export const encKey = env => env.ENC_KEY || env.META_ENC_KEY || null;

// what the owner sees: which bank, the last digits of the merchant id, when it was checked; never the secret
export async function accountInfo(db, t) {
  const r = await db.prepare('SELECT bank, label, checked FROM pay_accounts WHERE tenant_id = ?').bind(t.id).first();
  return r ? { bank: r.bank, label: r.label || '', checked: r.checked || '' } : null;
}
export async function getAccount(db, t, key) {
  const r = await db.prepare('SELECT bank, secret FROM pay_accounts WHERE tenant_id = ?').bind(t.id).first();
  if (!r || !key) return null;
  try { return { bank: r.bank, ...JSON.parse(await open(key, r.secret)) }; } catch (e) { return null; }
}
export async function saveAccount(db, t, key, { bank, id, secret, apikey }) {
  const sealed = await seal(key, JSON.stringify({ id, secret, apikey: apikey || '' })), at = nowIso();
  await db.prepare(`INSERT INTO pay_accounts (tenant_id, bank, secret, label, checked, created) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (tenant_id) DO UPDATE SET bank = excluded.bank, secret = excluded.secret, label = excluded.label, checked = excluded.checked`)
    .bind(t.id, bank, sealed, '…' + String(id).slice(-4), at, at).run();
}
export const removeAccount = (db, t) => db.prepare('DELETE FROM pay_accounts WHERE tenant_id = ?').bind(t.id).run();

// how much the guest pays now: the whole stay, or a deposit (percent), in whole lari
export function payAmount(total, rule) {
  if (!(total > 0)) return 0;
  if (rule && rule.part === 'deposit') return Math.max(1, Math.round(total * Math.min(100, Math.max(10, +rule.pct || 30)) / 100));
  return Math.round(total);
}

// unpaid holds whose time ran out give their rooms back
export async function releaseHolds(db, t) {
  await db.prepare("UPDATE bookings SET status = 'declined', pay_state = 'expired', remark = 'გადახდა დროზე არ მოხდა, ნომერი გათავისუფლდა' WHERE tenant_id = ? AND pay_state = 'waiting' AND status = 'confirmed' AND pay_until < ?")
    .bind(t.id, nowIso()).run();
}

// a booking (one room, or a group) that could not open a payment page goes to the hotel as an ordinary request
export async function holdToRequest(db, t, id) {
  await db.prepare("UPDATE bookings SET status = 'pending', room = NULL, instant = 0, pay_state = NULL, pay_until = NULL, pay_amount = NULL WHERE tenant_id = ? AND (id = ? OR grp = ?) AND pay_state = 'waiting'")
    .bind(t.id, id, id).run();
}

export async function addOrder(db, t, { id, booking, bank, amount }) {
  await db.prepare("INSERT INTO pay_orders (tenant_id, id, booking, bank, amount, state, created) VALUES (?, ?, ?, ?, ?, 'waiting', ?)")
    .bind(t.id, id, booking, bank, amount, nowIso()).run();
}
export const findOrder = (db, t, id) => db.prepare('SELECT * FROM pay_orders WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
export const lastOrder = (db, t, booking) => db.prepare('SELECT * FROM pay_orders WHERE tenant_id = ? AND booking = ? ORDER BY created DESC LIMIT 1').bind(t.id, booking).first();

// the bank's answer about one order, written to the order and its booking.
// Paid after the hold ran out: the booking stays released and is marked "late" so the hotel confirms or refunds.
export async function settleOrder(db, t, order, { state, amount }) {
  if (state === 'waiting' || order.state === 'paid') return order.state;
  if (state === 'paid' && amount + 0.01 < order.amount) state = 'failed'; // less than asked is not a payment of this booking
  await db.prepare('UPDATE pay_orders SET state = ? WHERE tenant_id = ? AND id = ?').bind(state, t.id, order.id).run();
  if (state === 'paid') {
    await db.prepare("UPDATE bookings SET pay_state = CASE WHEN pay_state = 'expired' THEN 'late' ELSE 'paid' END WHERE tenant_id = ? AND (id = ? OR grp = ?) AND pay_state IN ('waiting', 'expired')")
      .bind(t.id, order.booking, order.booking).run();
  }
  return state;
}

// the booking's payment as the guest and the hotel see it
export async function payOf(db, t, booking) {
  const r = await db.prepare('SELECT pay_state, pay_until, pay_amount FROM bookings WHERE tenant_id = ? AND (id = ? OR grp = ?) AND pay_state IS NOT NULL LIMIT 1').bind(t.id, booking, booking).first();
  return r ? { state: r.pay_state, until: r.pay_until, amount: r.pay_amount } : null;
}
