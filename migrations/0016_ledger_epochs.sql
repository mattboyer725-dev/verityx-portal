-- Ledger epochs: when the ledger signing secret is rotated without the old
-- value (LOCAL_CORE_SECRET_PREVIOUS), the old chain can no longer be verified.
-- A new LEDGER_EPOCH makes the first locked write archive the old chain to
-- core_events_fork_archive (kept, with the reason) and start a fresh one.
create table if not exists ledger_epochs (
  epoch text primary key,
  archived integer not null default 0,
  started_at timestamptz not null default now()
);
alter table ledger_epochs enable row level security;
