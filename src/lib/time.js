// Dates are plain 'YYYY-MM-DD' strings. "Today" is always Georgian time (UTC+4), on the server and in the browser:
// a request sent from the US late in the evening was once refused as being in the past.

const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toS = d => d.toISOString().slice(0, 10);

export const GEORGIA_OFFSET_H = 4;
export const today = (now = Date.now()) => toS(new Date(now + GEORGIA_OFFSET_H * 3600e3));
export const nowIso = () => new Date().toISOString();
export const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
export const nights = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toS(toD(s)) === s;
