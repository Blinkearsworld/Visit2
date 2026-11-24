-- Visit2's own to-do list (platform level: not a hotel's data, so no tenant_id).
-- hotel holds the hotel's slug, for a link; auto_key stops the same automatic task being added twice.
CREATE TABLE tasks (
  id        TEXT PRIMARY KEY,
  what      TEXT NOT NULL,
  who       TEXT NOT NULL DEFAULT '',
  hotel     TEXT NOT NULL DEFAULT '',
  how       TEXT NOT NULL DEFAULT '',
  why       TEXT NOT NULL DEFAULT '',
  due       TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL DEFAULT 'todo',      -- todo | doing | done
  auto_key  TEXT UNIQUE,
  created   TEXT NOT NULL,
  done_at   TEXT
);
CREATE INDEX tasks_status ON tasks (status, due);

-- the platform owner (signs in to /ops with the same email and password)
UPDATE users SET platform = 1 WHERE email = 'visit2ge@gmail.com';
