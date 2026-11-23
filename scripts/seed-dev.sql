-- Two sample hotels for local development: http://test-one.localhost:8787 and http://test-two.localhost:8787
INSERT OR IGNORE INTO tenants (id, slug, name, city, status, created) VALUES
  ('dev-tenant-1', 'test-one', 'სატესტო სასტუმრო 1', 'ბაკურიანი', 'trial', '2026-11-23T00:00:00Z'),
  ('dev-tenant-2', 'test-two', 'სატესტო სასტუმრო 2', 'ბორჯომი', 'trial', '2026-11-23T00:00:00Z');
INSERT OR IGNORE INTO domains (host, tenant_id, kind, verified, created) VALUES
  ('test-one.visit2.ge', 'dev-tenant-1', 'sub', 1, '2026-11-23T00:00:00Z'),
  ('test-two.visit2.ge', 'dev-tenant-2', 'sub', 1, '2026-11-23T00:00:00Z');
