-- More of the daily running: calendars of Booking/Airbnb (iCal), expenses, problems in rooms, no-shows, agencies, promo codes.

-- iCal: calendars of other sites, one per room; their bookings close the room here (room_blocks with feed set)
CREATE TABLE ical_feeds (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  room       TEXT NOT NULL,
  name       TEXT NOT NULL,              -- Booking.com, Airbnb ...
  url        TEXT NOT NULL,
  last_sync  TEXT,
  last_error TEXT,
  created    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
ALTER TABLE room_blocks ADD COLUMN feed TEXT;   -- NULL: closed by the hotel; else the ical_feeds.id it came from

-- what the hotel spends (salaries, utilities, food...): with income it shows the profit
CREATE TABLE expenses (
  tenant_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  date      TEXT NOT NULL,
  category  TEXT NOT NULL,
  amount    INTEGER NOT NULL,
  method    TEXT,                          -- cash | card | transfer
  note      TEXT,
  by_name   TEXT,
  created   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX expenses_date ON expenses (tenant_id, date);

-- something broken in a room (air conditioner, tap...): who reported it, when it was fixed
CREATE TABLE issues (
  tenant_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  room      TEXT NOT NULL,
  text      TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'open',  -- open | done
  by_name   TEXT,
  created   TEXT NOT NULL,
  done_at   TEXT,
  done_by   TEXT,
  PRIMARY KEY (tenant_id, id)
);

ALTER TABLE bookings ADD COLUMN no_show INTEGER NOT NULL DEFAULT 0;  -- the guest never came (a cancelled booking)
ALTER TABLE bookings ADD COLUMN agent TEXT;                         -- a travel agency (settings.agents id)
ALTER TABLE bookings ADD COLUMN code TEXT;                          -- the promo code the guest used
