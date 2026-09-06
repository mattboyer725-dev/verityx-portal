-- Operator extras: activity telemetry, API keys, webhooks, security knobs.
-- Unowned product state. Live identities still come from Better Auth.

create table if not exists ops_events (
  id text primary key,
  kind text not null,
  actor_email text not null default '',
  actor_name text not null default '',
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ops_events_created_idx on ops_events (created_at desc);
create index if not exists ops_events_kind_idx on ops_events (kind);

create table if not exists admin_api_keys (
  id text primary key,
  name text not null,
  prefix text not null,
  hash text not null,
  role text not null default 'operator',
  status text not null default 'active',
  last_used_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_webhooks (
  id text primary key,
  url text not null,
  event text not null default 'alert.open',
  status text not null default 'active',
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table admin_identities add column if not exists notes text not null default '';

insert into admin_settings (key, value)
values
  ('require_verified', 'false'),
  ('maintenance', 'false'),
  ('announce', ''),
  ('session_days', '30')
on conflict (key) do nothing;

insert into ops_events (id, kind, actor_email, actor_name, target, detail, created_at)
values
  ('ev-boot', 'system.boot', 'system', 'VerityX', 'command', 'Command schema v3 applied. Owner allowlist mattboyer725@gmail.com.', now() - interval '2 days'),
  ('ev-login-eh', 'desk.login', 'elena.hartmann@siemensgamesa.com', 'Elena Hartmann', 'desk', 'Siemens Gamesa analog seat opened the magnetics desk.', now() - interval '18 minutes'),
  ('ev-verify-4782', 'desk.verify', 'elena.hartmann@siemensgamesa.com', 'Elena Hartmann', 'SG-4782', 'Verify HOLD — Nanjing magnet quote failed MAD vs 5.68–5.75M prints.', now() - interval '14 minutes'),
  ('ev-wb-4782', 'desk.writeback', 'elena.hartmann@siemensgamesa.com', 'Elena Hartmann', 'SG-4782', 'SAP analog HOLD_PO posted on 4500187742.', now() - interval '12 minutes'),
  ('ev-login-ms', 'desk.login', 'mads.sorensen@siemensgamesa.com', 'Mads Sørensen', 'desk', 'Hull generator metals seat signed into analog desk.', now() - interval '3 hours'),
  ('ev-verify-5191', 'desk.verify', 'mads.sorensen@siemensgamesa.com', 'Mads Sørensen', 'SG-5191', 'Verify HOLD — Baotou alloy financial opacity HIGH.', now() - interval '3 hours'),
  ('ev-login-cm', 'desk.login', 'claire.moreau@siemensgamesa.com', 'Claire Moreau', 'desk', 'Le Havre tower steel seat.', now() - interval '1 day'),
  ('ev-verify-9012', 'desk.verify', 'claire.moreau@siemensgamesa.com', 'Claire Moreau', 'SG-9012', 'Verify HOLD — IGBT dual-use gate.', now() - interval '22 hours'),
  ('ev-login-id', 'desk.login', 'ingrid.dahl@siemensgamesa.com', 'Ingrid Dahl', 'desk', 'Aalborg composites seat.', now() - interval '6 hours'),
  ('ev-export-8221', 'desk.export', 'ingrid.dahl@siemensgamesa.com', 'Ingrid Dahl', 'SG-8221', 'Evidence packet downloaded.', now() - interval '5 hours')
on conflict (id) do nothing;

insert into admin_webhooks (id, url, event, status, created_by)
values
  ('wh-pager', 'https://hooks.verityx.invalid/command/alerts', 'alert.open', 'active', 'mattboyer725@gmail.com')
on conflict (id) do nothing;
