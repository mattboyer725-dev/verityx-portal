-- Persist the last live magnetics packet on a paid OS pilot, and the analog
-- SAP writeback receipt on a human-approved BLOCK. Tenant-scoped JSON.
alter table pilots add column if not exists desk_packet_json text;
alter table decisions add column if not exists writeback_json text;
