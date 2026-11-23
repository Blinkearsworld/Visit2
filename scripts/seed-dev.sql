-- Two sample hotels for local development (npm run dev):
--   http://test-one.localhost:8787  admin: one@example.com / test-one-123
--   http://test-two.localhost:8787  admin: two@example.com / test-two-123
-- Made with scripts/new-hotel.mjs. Local only: these passwords are public.
INSERT OR IGNORE INTO tenants (id, slug, name, city, status, trial_ends, created) VALUES ('dev-tenant-1', 'test-one', 'სატესტო სასტუმრო 1', 'ბაკურიანი', 'trial', '2026-12-23', '2026-11-23T18:05:40.127Z');
INSERT OR IGNORE INTO domains (host, tenant_id, kind, verified, created) VALUES ('test-one.visit2.ge', 'dev-tenant-1', 'sub', 1, '2026-11-23T18:05:40.127Z');
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-1', 'peak', 'ახალი წელი', '12-25', '01-07', 0);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-1', 'winter', 'ზამთარი', '12-01', '03-31', 1);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-1', 'summer', 'ზაფხული', '06-01', '08-31', 2);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-1', 'off', 'დანარჩენი', '01-01', '12-31', 3);
INSERT OR IGNORE INTO users (id, email, name, salt, hash, created) VALUES ('u1325aabfe2c', 'one@example.com', 'ნინო', 'ee2d30cccb77a0287b24dd5d5627f5a4', 'a4089a3707f0da786bb8373f504819453b1f44dfa2bdf96ad017d3591fca3bcd', '2026-11-23T18:05:40.127Z');
INSERT OR IGNORE INTO memberships (tenant_id, user_id, role, perms, active, created) SELECT 'dev-tenant-1', id, 'owner', '[]', 1, '2026-11-23T18:05:40.127Z' FROM users WHERE email = 'one@example.com';
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-1', 'seasonMode', 'auto');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-1', 'winterFrom', '11-15');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-1', 'winterTo', '03-31');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-1', 'gapDiscount', '10');
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-1', 'std', 'სტანდარტული ორადგილიანი', '[{"guests":1,"price":{"peak":200,"winter":150,"summer":120,"off":90}},{"guests":2,"price":{"peak":240,"winter":180,"summer":140,"off":110}}]', 0);
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-1', 'family', 'საოჯახო, 1 საძინებლით (4+1)', '[{"guests":2,"price":{"peak":320,"winter":240,"summer":200,"off":150}},{"guests":3,"price":{"peak":350,"winter":265,"summer":220,"off":165}},{"guests":4,"price":{"peak":380,"winter":290,"summer":240,"off":180}},{"guests":5,"price":{"peak":410,"winter":310,"summer":260,"off":195}}]', 1);
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-1', 'suite', 'ლუქსი, 2 საძინებლით', '[{"guests":2,"price":{"peak":480,"winter":370,"summer":290,"off":210}},{"guests":4,"price":{"peak":600,"winter":460,"summer":380,"off":280}},{"guests":6,"price":{"peak":710,"winter":550,"summer":460,"off":340}}]', 2);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-1', '1', 'std', 0);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-1', '2', 'std', 1);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-1', '3', 'family', 2);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-1', '4', 'family', 3);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-1', '5', 'suite', 4);
INSERT OR IGNORE INTO tenants (id, slug, name, city, status, trial_ends, created) VALUES ('dev-tenant-2', 'test-two', 'სატესტო სასტუმრო 2', 'ბორჯომი', 'trial', '2026-12-23', '2026-11-23T18:05:40.186Z');
INSERT OR IGNORE INTO domains (host, tenant_id, kind, verified, created) VALUES ('test-two.visit2.ge', 'dev-tenant-2', 'sub', 1, '2026-11-23T18:05:40.186Z');
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-2', 'peak', 'ახალი წელი', '12-25', '01-07', 0);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-2', 'winter', 'ზამთარი', '12-01', '03-31', 1);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-2', 'summer', 'ზაფხული', '06-01', '08-31', 2);
INSERT OR IGNORE INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES ('dev-tenant-2', 'off', 'დანარჩენი', '01-01', '12-31', 3);
INSERT OR IGNORE INTO users (id, email, name, salt, hash, created) VALUES ('u94144029511', 'two@example.com', 'გიორგი', '882997974833d795edd25f7e86df53ac', '748a075ea4c15a3b04e771348e88cae868defb54a4183ac15127f6b5a6b02b40', '2026-11-23T18:05:40.186Z');
INSERT OR IGNORE INTO memberships (tenant_id, user_id, role, perms, active, created) SELECT 'dev-tenant-2', id, 'owner', '[]', 1, '2026-11-23T18:05:40.186Z' FROM users WHERE email = 'two@example.com';
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-2', 'seasonMode', 'auto');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-2', 'winterFrom', '11-15');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-2', 'winterTo', '03-31');
INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES ('dev-tenant-2', 'gapDiscount', '10');
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-2', 'std', 'სტანდარტული ორადგილიანი', '[{"guests":1,"price":{"peak":200,"winter":150,"summer":120,"off":90}},{"guests":2,"price":{"peak":240,"winter":180,"summer":140,"off":110}}]', 0);
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-2', 'family', 'საოჯახო, 1 საძინებლით (4+1)', '[{"guests":2,"price":{"peak":320,"winter":240,"summer":200,"off":150}},{"guests":3,"price":{"peak":350,"winter":265,"summer":220,"off":165}},{"guests":4,"price":{"peak":380,"winter":290,"summer":240,"off":180}},{"guests":5,"price":{"peak":410,"winter":310,"summer":260,"off":195}}]', 1);
INSERT OR IGNORE INTO types (tenant_id, id, name, rates, sort) VALUES ('dev-tenant-2', 'suite', 'ლუქსი, 2 საძინებლით', '[{"guests":2,"price":{"peak":480,"winter":370,"summer":290,"off":210}},{"guests":4,"price":{"peak":600,"winter":460,"summer":380,"off":280}},{"guests":6,"price":{"peak":710,"winter":550,"summer":460,"off":340}}]', 2);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-2', '1', 'std', 0);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-2', '2', 'std', 1);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-2', '3', 'family', 2);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-2', '4', 'family', 3);
INSERT OR IGNORE INTO rooms (tenant_id, id, type, sort) VALUES ('dev-tenant-2', '5', 'suite', 4);
