-- Buyer portfolio: magnet-bearing parts on a buyer's contracts and the lot
-- passport code each ships with. ack_state is the state the buyer last
-- reviewed; a different live state is an alert.
create table if not exists portfolio_items (
  id text primary key,
  organization_id text not null,
  part_number text not null,
  description text not null default '',
  program text not null default '',
  supplier text not null default '',
  passport_code text not null default '',
  ack_state text,
  ack_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, part_number, passport_code)
);
create index if not exists portfolio_items_org_idx on portfolio_items (organization_id, program);
alter table portfolio_items enable row level security;

-- Every evidence pack generated, with the digest sealed on the ledger.
create table if not exists portfolio_packs (
  id text primary key,
  organization_id text not null,
  program text not null default '',
  item_count integer not null default 0,
  digest text not null,
  ledger_hash text,
  pack_json text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_packs_org_idx on portfolio_packs (organization_id, created_at desc);
alter table portfolio_packs enable row level security;
