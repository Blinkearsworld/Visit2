/* Browser copy of src/lib/plans.js (keep in step). */
(() => {
// Price plans of a hotel: the same room at another price, e.g. breakfast included (+20 ₾ a guest a night)
// or "non-refundable" (−10 %). Kept in the hotel's settings as JSON; the same rule runs on the server and in the browser.
function readPlans(settings) {
  let list = [];
  try { list = JSON.parse(settings?.plans || '[]'); } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).filter(p => p && p.id && p.name && p.on !== false);
}
// pct: percent off (negative = more); add: GEL a night, for each guest if perGuest
function planPrice(total, plan, guests, nights) {
  if (!plan) return total;
  let v = total * (1 - (+plan.pct || 0) / 100);
  v += (+plan.add || 0) * Math.max(1, nights) * (plan.perGuest ? Math.max(1, guests) : 1);
  return Math.max(0, Math.round(v));
}
const planTag = p => (p ? { id: p.id, name: p.name, refundable: p.refundable === false ? false : true } : null);

// what cancelling costs: free until `days` before arrival, then `pct` of the stay; a non-refundable plan costs all of it
function cancelFee(settings, { from, price, plan }, day) {
  let rule = {};
  try { rule = JSON.parse(settings?.cancelRule || '{}') || {}; } catch (e) { rule = {}; }
  if (plan && plan.refundable === false) return price || 0;
  const days = Math.max(0, +rule.days || 0), pct = Math.max(0, Math.min(100, +rule.pct || 0));
  if (!pct) return 0;
  const left = Math.round((Date.parse(from + 'T00:00:00Z') - Date.parse(day + 'T00:00:00Z')) / 864e5);
  return left >= days ? 0 : Math.round((price || 0) * pct / 100);
}
// settings the public site never gets: message texts (may hold door codes), the hotel's bank details, invoice counters
const PRIVATE_SETTINGS = k => k === 'msgTpl' || k === 'billFrom' || /^invoiceSeq/.test(k);

window.V2PLANS = { readPlans, planPrice, planTag, cancelFee };
})();
