-- Visit2's own admin manages every service: what each hotel pays for and until when, help access, notices.
-- Payments are entered by hand until Stripe is connected; then Stripe writes the same rows.

-- what the hotel has: catalogue (+20₾), own domain (+10₾); the system itself is always on
ALTER TABLE tenants ADD COLUMN addons TEXT NOT NULL DEFAULT '[]';
-- paid up to this day (inclusive); empty = not paid yet (still in trial, or overdue)
ALTER TABLE tenants ADD COLUMN paid_until TEXT;

-- money a hotel paid Visit2 (subscriptions only; guests' money never comes here)
CREATE TABLE subscriptions (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  amount     INTEGER NOT NULL,          -- GEL
  until      TEXT NOT NULL,             -- this payment covers up to this day
  method     TEXT,                      -- bank | stripe | cash | other
  note       TEXT,
  by_user    TEXT,
  created    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

-- the hotel's owner lets Visit2 into their admin until a given time (button "დახმარების დაშვება")
CREATE TABLE support_access (
  tenant_id  TEXT PRIMARY KEY,
  until      INTEGER NOT NULL,          -- ms since 1970
  granted_by TEXT,
  granted_at TEXT NOT NULL
);

-- notices to every hotel's admin (planned works and the like); platform level
CREATE TABLE notices (
  id        TEXT PRIMARY KEY,
  text      TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to   TEXT NOT NULL,
  created   TEXT NOT NULL
);
