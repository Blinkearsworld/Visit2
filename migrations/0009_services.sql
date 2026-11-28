-- The hotel's own services (breakfast, dinner, minibar, extra cleaning, transfer...) and what a stay was charged for them.

-- what the hotel sells besides the room; the owner adds them in admin
CREATE TABLE services (
  tenant_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  name      TEXT NOT NULL,                -- Georgian name
  name_en   TEXT,
  name_ru   TEXT,
  price     INTEGER NOT NULL,             -- GEL per unit
  unit      TEXT NOT NULL DEFAULT 'item', -- stay (once) | night | guest (per person) | guest_night | item (pieces, hours)
  online    INTEGER NOT NULL DEFAULT 0,   -- 1 = guests can add it when booking on the site and on Visit2.ge
  active    INTEGER NOT NULL DEFAULT 1,
  sort      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, id)
);

-- charges on a booking besides the room price: chosen when booking or added by staff during the stay
CREATE TABLE booking_items (
  tenant_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  booking   TEXT NOT NULL,
  service   TEXT,                         -- services.id; NULL for a one-off charge typed by hand
  name      TEXT NOT NULL,                -- the name at the time of the charge
  price     INTEGER NOT NULL,             -- GEL per unit at the time of the charge
  qty       INTEGER NOT NULL DEFAULT 1,
  amount    INTEGER NOT NULL,             -- price × qty
  date      TEXT,                         -- the day it was used
  source    TEXT,                         -- site | admin
  created   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX booking_items_booking ON booking_items (tenant_id, booking);
