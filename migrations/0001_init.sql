-- Visit2 initial schema.
-- Platform tables (tenants, domains, users, memberships) and the hotel tables ported from Villa JIJI.
-- Every hotel table carries tenant_id and has it first in its primary key and indexes.

-- ---------- platform ----------
CREATE TABLE tenants (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,          -- the subdomain: {slug}.visit2.ge
  name          TEXT NOT NULL,
  city          TEXT,
  status        TEXT NOT NULL DEFAULT 'trial', -- trial | active | paused | closed
  plan          TEXT,                          -- set from Stripe later
  trial_ends    TEXT,
  paused_until  TEXT,
  stripe_customer TEXT,
  created       TEXT NOT NULL
);

-- every host name that serves a hotel site: its subdomain and, later, its own domain
CREATE TABLE domains (
  host       TEXT PRIMARY KEY,                 -- lower case, no port
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  kind       TEXT NOT NULL DEFAULT 'sub',      -- sub | custom
  verified   INTEGER NOT NULL DEFAULT 0,
  created    TEXT NOT NULL
);
CREATE INDEX domains_tenant ON domains (tenant_id);

-- one person, one sign-in, possibly several hotels
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  salt        TEXT,
  hash        TEXT,
  ver         INTEGER NOT NULL DEFAULT 1,      -- bumped on password change: signs out every device
  platform    INTEGER NOT NULL DEFAULT 0,      -- 1 = Visit2 staff
  created     TEXT NOT NULL,
  last_login  TEXT
);

CREATE TABLE memberships (
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL DEFAULT 'staff',    -- owner | staff
  perms      TEXT NOT NULL DEFAULT '[]',       -- staff: ["book","money","price","site"]
  active     INTEGER NOT NULL DEFAULT 1,
  created    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX memberships_user ON memberships (user_id);

CREATE TABLE login_fails (ip TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX login_fails_ip ON login_fails (ip, at);

-- Facebook pages and Instagram accounts connected to the one Visit2 Meta app
CREATE TABLE meta_pages (
  page_id    TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  channel    TEXT NOT NULL,                    -- fb | ig
  token_enc  TEXT,                             -- page token, encrypted with a key from Cloudflare Secrets
  connected  TEXT NOT NULL
);
CREATE INDEX meta_pages_tenant ON meta_pages (tenant_id);

-- ---------- hotel data (ported from Villa JIJI, now per tenant) ----------
CREATE TABLE settings (
  tenant_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT,
  PRIMARY KEY (tenant_id, k)
);

-- seasons were fixed in code (peak / winter / summer / off); now each hotel has its own.
-- from_md / to_md are MM-DD and may wrap the year (11-15 .. 03-31). Lower sort wins on overlap.
CREATE TABLE seasons (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL,
  from_md TEXT NOT NULL, to_md TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id)
);

-- rates: JSON [{ guests, price: { [season_id]: GEL per night } }]
CREATE TABLE types (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT, rates TEXT, sort INTEGER,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE rooms (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, type TEXT NOT NULL, sort INTEGER,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE bookings (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL,
  room TEXT, type TEXT, date_from TEXT, date_to TEXT,
  guests INTEGER, children INTEGER, name TEXT, phone TEXT,
  status TEXT, prev_status TEXT, source TEXT, created TEXT, deleted_at TEXT,
  price INTEGER, note TEXT, remark TEXT, wish TEXT, want_room TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX bookings_dates ON bookings (tenant_id, status, date_from, date_to);

CREATE TABLE payments (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL,
  booking TEXT, amount INTEGER, method TEXT, date TEXT, created TEXT,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX payments_booking ON payments (tenant_id, booking);

CREATE TABLE guest_notes (
  tenant_id TEXT NOT NULL, k TEXT NOT NULL, note TEXT, bday TEXT, updated TEXT,
  PRIMARY KEY (tenant_id, k)
);

-- chatbot conversations (site, Messenger, Instagram)
CREATE TABLE convos (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, state TEXT, updated TEXT,
  PRIMARY KEY (tenant_id, id)
);

-- site texts: versions of one JSON document per hotel
CREATE TABLE site_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL, v TEXT NOT NULL, created TEXT NOT NULL, note TEXT
);
CREATE INDEX site_content_tenant ON site_content (tenant_id, id);

-- photos live in R2 under tenants/{tenant_id}/; this table only lists them
CREATE TABLE media (
  tenant_id TEXT NOT NULL, id TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER, created TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE actlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL, at TEXT NOT NULL, uid TEXT, who TEXT, op TEXT, target TEXT, ref TEXT, detail TEXT
);
CREATE INDEX actlog_target ON actlog (tenant_id, target);
