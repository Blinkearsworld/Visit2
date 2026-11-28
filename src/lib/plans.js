// Price plans of a hotel: the same room at another price, e.g. breakfast included (+20 ₾ a guest a night)
// or "non-refundable" (−10 %). Kept in the hotel's settings as JSON; the same rule runs on the server and in the browser.
export function readPlans(settings) {
  let list = [];
  try { list = JSON.parse(settings?.plans || '[]'); } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).filter(p => p && p.id && p.name && p.on !== false);
}
// pct: percent off (negative = more); add: GEL a night, for each guest if perGuest
export function planPrice(total, plan, guests, nights) {
  if (!plan) return total;
  let v = total * (1 - (+plan.pct || 0) / 100);
  v += (+plan.add || 0) * Math.max(1, nights) * (plan.perGuest ? Math.max(1, guests) : 1);
  return Math.max(0, Math.round(v));
}
export const planTag = p => (p ? { id: p.id, name: p.name, refundable: p.refundable === false ? false : true } : null);

// what cancelling costs: free until `days` before arrival, then `pct` of the stay; a non-refundable plan costs all of it
export function cancelFee(settings, { from, price, plan }, day) {
  let rule = {};
  try { rule = JSON.parse(settings?.cancelRule || '{}') || {}; } catch (e) { rule = {}; }
  if (plan && plan.refundable === false) return price || 0;
  const days = Math.max(0, +rule.days || 0), pct = Math.max(0, Math.min(100, +rule.pct || 0));
  if (!pct) return 0;
  const left = Math.round((Date.parse(from + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 864e5);
  return left >= days ? 0 : Math.round((price || 0) * pct / 100);
}
// settings the public site never gets: message texts (may hold door codes), the hotel's bank details, invoice counters;
// promo codes and agencies too: a code is checked by the server, one at a time (/api/code)
export const PRIVATE_SETTINGS = k => ['msgTpl', 'billFrom', 'codes', 'agents'].includes(k) || /^(invoiceSeq|icalPull:)/.test(k);

// ---------- price rules: weekend nights, chosen dates, long stays (JSON in settings.priceRules) ----------
// { weekend: { days: [5, 6], pct: 15 }, dates: [{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', pct: 20 }], long: [{ nights: 7, pct: 10 }] }
export function readRules(settings) {
  try { const r = JSON.parse(settings?.priceRules || '{}'); return r && typeof r === 'object' ? r : {}; } catch (e) { return {}; }
}
const wdOf = d => new Date(d + 'T00:00:00Z').getUTCDay();
// percent added to one night (negative = cheaper): the weekend rule and the dates it falls in
export function nightPct(rules, d) {
  let p = 0;
  if (rules.weekend && (rules.weekend.days || []).includes(wdOf(d))) p += +rules.weekend.pct || 0;
  for (const x of rules.dates || []) if (x && x.from <= d && d < x.to) p += +x.pct || 0;
  return p;
}
// the biggest long-stay discount the stay reaches
export function longPct(rules, n) {
  let best = 0;
  for (const x of rules.long || []) if (x && n >= (+x.nights || 0) && (+x.pct || 0) > best) best = +x.pct;
  return best;
}

// ---------- stay rules: fewest nights and days with no arrivals, by period of the year (JSON in settings.stayRules) ----------
// [{ from: 'MM-DD', to: 'MM-DD', min: 3, noIn: [6] }]  (noIn: weekdays, 0 = Sunday)
const inMd = (md, a, b) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
export function stayCheck(settings, from, to) {
  let list = [];
  try { list = JSON.parse(settings?.stayRules || '[]') || []; } catch (e) { list = []; }
  const n = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 864e5), md = from.slice(5);
  let min = 1, noIn = false;
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || !r.from || !r.to || !inMd(md, r.from, r.to)) continue;
    min = Math.max(min, +r.min || 1);
    if ((r.noIn || []).includes(wdOf(from))) noIn = true;
  }
  return { ok: n >= min && !noIn, min, noIn };
}

// ---------- promo codes (JSON in settings.codes): [{ code: 'WINTER', pct: 10, from, to, on }] ----------
export function findCode(settings, code, day) {
  const c = String(code || '').trim().toUpperCase(); if (!c) return null;
  let list = [];
  try { list = JSON.parse(settings?.codes || '[]') || []; } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).find(x => x && x.on !== false && String(x.code || '').toUpperCase() === c && (!x.from || day >= x.from) && (!x.to || day <= x.to)) || null;
}
