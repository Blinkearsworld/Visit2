-- Day-to-day running of the hotel: guests arriving and leaving, rooms cleaned, rooms closed for repairs, invoices to companies.

-- when the guest actually arrived and left (ISO time); empty until staff mark it
ALTER TABLE bookings ADD COLUMN checked_in TEXT;
ALTER TABLE bookings ADD COLUMN checked_out TEXT;
-- an invoice to a company: JSON {no, company, code, address, issued}
ALTER TABLE bookings ADD COLUMN invoice TEXT;

-- housekeeping: clean | dirty | inspect; a room becomes dirty when its guest leaves
ALTER TABLE rooms ADD COLUMN hk TEXT NOT NULL DEFAULT 'clean';
ALTER TABLE rooms ADD COLUMN hk_at TEXT;

-- a room closed for some days (repairs, owner's own use): nobody can book it then
CREATE TABLE room_blocks (
  tenant_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  room      TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to   TEXT NOT NULL,             -- first free day, like a booking's check-out
  reason    TEXT,
  created   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX room_blocks_dates ON room_blocks (tenant_id, date_to);
