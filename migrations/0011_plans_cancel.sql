-- Price plans (with breakfast, non-refundable...) and cancellation with a fee.
-- The plans, the cancellation rule and the message templates are hotel settings (JSON in settings).

-- the plan the guest chose: JSON {id, name, refundable}
ALTER TABLE bookings ADD COLUMN plan TEXT;
-- a cancelled booking keeps its row (status 'cancelled') and what the guest owes for cancelling
ALTER TABLE bookings ADD COLUMN cancelled_at TEXT;
ALTER TABLE bookings ADD COLUMN fee INTEGER;
