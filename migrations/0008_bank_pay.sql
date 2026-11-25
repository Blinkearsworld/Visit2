-- Prepayment through the hotel's own bank (TBC or Bank of Georgia), a service Visit2 turns on for a hotel that asks.
-- The money goes straight to the hotel's account; Visit2 never holds it and never sees a card.

-- an instant booking that waits for payment holds its room until pay_until; unpaid, it is released
ALTER TABLE bookings ADD COLUMN pay_state TEXT;      -- NULL | waiting | paid | expired | late (paid after release)
ALTER TABLE bookings ADD COLUMN pay_until TEXT;      -- ISO time the hold ends
ALTER TABLE bookings ADD COLUMN pay_amount INTEGER;  -- GEL asked (whole stay or the deposit)

-- the hotel's merchant credentials, sealed with ENC_KEY (AES-GCM); only the hotel's owner sets them
CREATE TABLE pay_accounts (
  tenant_id  TEXT PRIMARY KEY,
  bank       TEXT NOT NULL,                 -- tbc | bog
  secret     TEXT NOT NULL,                 -- sealed JSON {id, secret, apikey}
  label      TEXT,                          -- the last digits of the merchant id, to show in admin
  checked    TEXT,                          -- when the bank last accepted these credentials
  created    TEXT NOT NULL
);

-- one row per payment page opened at the bank (a guest may try again)
CREATE TABLE pay_orders (
  tenant_id  TEXT NOT NULL,
  id         TEXT NOT NULL,                 -- the bank's order / payment id
  booking    TEXT NOT NULL,                 -- booking id, or the group id of several rooms
  bank       TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  state      TEXT NOT NULL,                 -- waiting | paid | failed
  created    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX pay_orders_booking ON pay_orders (tenant_id, booking);
