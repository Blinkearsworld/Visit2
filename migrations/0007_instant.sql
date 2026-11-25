-- Instant booking (the hotel turns it on): such a booking is confirmed at once with a room, and the hotel sees it as new.
ALTER TABLE bookings ADD COLUMN instant INTEGER NOT NULL DEFAULT 0;
