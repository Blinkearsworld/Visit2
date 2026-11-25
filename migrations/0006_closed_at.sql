-- When a hotel was switched off: its data is deleted within 90 days of that day (public/terms.html).
ALTER TABLE tenants ADD COLUMN closed_at TEXT;
UPDATE tenants SET closed_at = created WHERE status = 'closed' AND closed_at IS NULL;
