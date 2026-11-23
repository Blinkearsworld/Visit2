// Minimal HTML helpers for server-rendered pages.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function page(title, body, { status = 200, lang = 'ka', tenant = null } = {}) {
  const html = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico">
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #FFF8EE; color: #1F1A17; }
  main { max-width: 40rem; margin: 15vh auto; padding: 0 1.5rem; }
  h1 { color: #0E857D; }
  a { color: #0B7A73; }
</style>
</head>
<body${tenant ? ` data-tenant="${esc(tenant)}"` : ''}><main>${body}</main></body>
</html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
