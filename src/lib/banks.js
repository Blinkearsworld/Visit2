// The hotel's own bank for prepayment: TBC E-Commerce and Bank of Georgia online payments.
// The guest pays on the bank's page; we only open the page and later ask the bank whether it was paid.
// Card details never reach Visit2. With PAY_DRY_RUN (tests) no bank is called: orders live in `dry`.
const TBC = 'https://api.tbcbank.ge/v1/tpay';
const BOG_AUTH = 'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const BOG = 'https://api.bog.ge/payments/v1';
export const BANKS = { tbc: 'TBC ბანკი', bog: 'საქართველოს ბანკი' };

// test double: id → { state, amount }; tests change the state as the bank would
export const dry = new Map();

async function tbcToken(c) {
  const r = await fetch(TBC + '/access-token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', apikey: c.apikey || '' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret }),
  });
  const o = r.ok ? await r.json().catch(() => ({})) : {};
  if (!o.access_token) throw new Error('bank sign-in failed');
  return o.access_token;
}
async function bogToken(c) {
  const r = await fetch(BOG_AUTH, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + btoa(c.id + ':' + c.secret) },
    body: 'grant_type=client_credentials',
  });
  const o = r.ok ? await r.json().catch(() => ({})) : {};
  if (!o.access_token) throw new Error('bank sign-in failed');
  return o.access_token;
}

// do these credentials open the bank? (shown to the owner when saving)
export async function checkCreds(env, c) {
  if (env.PAY_DRY_RUN) return c.secret !== 'wrong';
  try { await (c.bank === 'tbc' ? tbcToken(c) : bogToken(c)); return true; } catch (e) { return false; }
}

// opens a payment page at the bank: { id, url }
export async function createOrder(env, c, { amount, ref, returnUrl, callbackUrl, lang, minutes, desc }) {
  if (env.PAY_DRY_RUN) {
    const id = 'dry-' + crypto.randomUUID().slice(0, 12);
    dry.set(id, { state: 'waiting', amount });
    return { id, url: 'https://pay.test/' + id };
  }
  const ascii = s => String(s || '').replace(/[^\x20-\x7e]/g, '').trim();
  if (c.bank === 'tbc') {
    const token = await tbcToken(c);
    const r = await fetch(TBC + '/payments', {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: c.apikey || '', authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: { currency: 'GEL', total: amount, subTotal: amount, tax: 0, shipping: 0 }, returnurl: returnUrl, callbackUrl,
        expirationMinutes: minutes, merchantPaymentId: ref, extra: ascii(ref).slice(0, 25), language: lang === 'ka' ? 'KA' : 'EN', description: ascii(desc).slice(0, 30) || 'Booking' }),
    });
    const o = r.ok ? await r.json().catch(() => ({})) : {};
    const url = (o.links || []).find(l => l.rel === 'approval_url')?.uri;
    if (!o.payId || !url) throw new Error('bank did not open a payment');
    return { id: o.payId, url };
  }
  const token = await bogToken(c);
  const r = await fetch(BOG + '/ecommerce/orders', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'accept-language': lang === 'ka' ? 'ka' : 'en' },
    body: JSON.stringify({ callback_url: callbackUrl, external_order_id: ref, ttl: minutes, redirect_urls: { success: returnUrl, fail: returnUrl },
      purchase_units: { currency: 'GEL', total_amount: amount, basket: [{ product_id: ref, description: desc, quantity: 1, unit_price: amount }] } }),
  });
  const o = r.ok ? await r.json().catch(() => ({})) : {};
  const url = o._links?.redirect?.href;
  if (!o.id || !url) throw new Error('bank did not open a payment');
  return { id: o.id, url };
}

// what the bank says about an order: { state: 'paid' | 'failed' | 'waiting', amount }
export async function orderState(env, c, id) {
  if (env.PAY_DRY_RUN) return dry.get(id) || { state: 'failed', amount: 0 };
  if (c.bank === 'tbc') {
    const r = await fetch(TBC + '/payments/' + encodeURIComponent(id), { headers: { apikey: c.apikey || '', authorization: 'Bearer ' + await tbcToken(c) } });
    const o = r.ok ? await r.json().catch(() => ({})) : {};
    const s = o.status || '';
    return { state: s === 'Succeeded' ? 'paid' : ['Failed', 'Expired', 'Returned', 'PartialReturned'].includes(s) ? 'failed' : 'waiting', amount: +o.amount || 0 };
  }
  const r = await fetch(BOG + '/receipt/' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + await bogToken(c) } });
  const o = r.ok ? await r.json().catch(() => ({})) : {};
  const s = o.order_status?.key || '';
  return { state: s === 'completed' ? 'paid' : ['rejected', 'refunded', 'refunded_partially'].includes(s) ? 'failed' : 'waiting', amount: +(o.purchase_units?.transfer_amount || 0) };
}
