-- Durable local-core event log (HMAC + Merkle). Fills the Vercel in-memory gap.
create table if not exists core_events (
  event_id text primary key,
  event_type text not null,
  payload text not null,
  actor text not null,
  timestamp double precision not null,
  prev_hash text not null,
  signature text not null,
  hash text not null
);
create index if not exists core_events_ts_idx on core_events (timestamp);
