-- Pilot requests from the public /pilot page. Kept even when the owner's
-- workspace is not set up yet, so no lead is ever lost.
create table if not exists pilot_requests (
  id text primary key,
  name text not null,
  email text not null,
  company text not null,
  role text not null default '',
  commodity text not null,
  po_band text not null,
  message text not null default '',
  client_hash text not null default '',
  status text not null default 'new',
  prospect_id text,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pilot_requests_created_idx on pilot_requests (created_at desc);
create index if not exists pilot_requests_client_idx on pilot_requests (client_hash, created_at desc);
alter table pilot_requests enable row level security;
