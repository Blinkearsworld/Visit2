-- A group booking: one guest asks for several rooms at once. Every room is its own booking row,
-- and the rows of one request share `grp`, so the hotel sees and handles them together.
ALTER TABLE bookings ADD COLUMN grp TEXT;
