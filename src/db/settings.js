// Hotel settings (key/value). Every function takes the tenant first; tenant_id is in every query.

export async function getSettings(db, t) {
  const r = await db.prepare('SELECT k, v FROM settings WHERE tenant_id = ?').bind(t.id).all();
  return Object.fromEntries((r.results || []).map(x => [x.k, x.v]));
}

export async function getSetting(db, t, k) {
  const r = await db.prepare('SELECT v FROM settings WHERE tenant_id = ? AND k = ?').bind(t.id, String(k)).first();
  return r ? r.v : null;
}

export async function setSetting(db, t, k, v) {
  await db.prepare('INSERT INTO settings (tenant_id, k, v) VALUES (?, ?, ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v')
    .bind(t.id, String(k), v == null ? null : String(v)).run();
}

export async function getSeasons(db, t) {
  const r = await db.prepare('SELECT id, name, from_md, to_md, sort FROM seasons WHERE tenant_id = ? ORDER BY sort').bind(t.id).all();
  return (r.results || []).map(s => ({ id: s.id, name: s.name, from: s.from_md, to: s.to_md, sort: s.sort }));
}
