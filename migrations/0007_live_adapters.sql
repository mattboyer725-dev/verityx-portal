-- Protocol adapters that outlive a serverless isolate: SAP analog tenant,
-- PBFT round log, Circulor mass-balance lots. Unowned desk data (no user_id).
create table if not exists sap_pos (
  purchase_order text primary key,
  payload text not null,
  updated_at timestamptz not null default now()
);

create table if not exists sap_writebacks (
  id text primary key,
  po text not null,
  payload text not null,
  ts timestamptz not null default now()
);
create index if not exists sap_writebacks_ts_idx on sap_writebacks (ts desc);

create table if not exists pbft_rounds (
  seq integer primary key,
  digest text not null,
  committed boolean not null,
  payload text not null,
  ts timestamptz not null default now()
);

create table if not exists circulor_lots (
  lot text primary key,
  payload text not null,
  updated_at timestamptz not null default now()
);
