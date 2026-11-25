// AES-GCM for secrets we must keep in the database (a hotel's Facebook page token).
// The key is ENC_KEY (or META_ENC_KEY) in Cloudflare Secrets: 32 random bytes, base64. Never in code or chat.
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u => btoa(String.fromCharCode(...u));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function key(secret) {
  if (!secret) throw new Error('ENC_KEY is not set');
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error('ENC_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(secret, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), enc.encode(text)));
  return 'v1.' + b64(iv) + '.' + b64(ct);
}
export async function open(secret, sealed) {
  const [v, iv, ct] = String(sealed || '').split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('not sealed');
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(secret), unb64(ct)));
}
// HMAC-SHA256 hex, compared in constant time (Meta's X-Hub-Signature-256)
export async function hmacHex(secret, data) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? enc.encode(data) : data))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function sameText(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
