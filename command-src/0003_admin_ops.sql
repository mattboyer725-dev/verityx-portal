-- Operator extras: activity telemetry, API keys, webhooks, security knobs.
create table if not exists ops_events (
  id text primary key,
  kind text not null,
  actor_email text not null default '',
  actor_name text not null default '',
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
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
