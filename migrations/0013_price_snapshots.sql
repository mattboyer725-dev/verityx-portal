-- Dated market history: LIVE prices only; a feed on standby stores NULL.
create table if not exists price_snapshots (
  id text primary key,
  taken_at timestamptz not null default now(),
  ndpr double precision,
  dy double precision,
  cu double precision,
  al double precision,
  usd_eur double precision,
  sources text not null default ''
);
create index if not exists price_snapshots_taken_idx on price_snapshots (taken_at desc);
alter table price_snapshots enable row level security;
