-- Ariba sourcing RFQs and Minespider hashed batch passports.
-- Unowned desk analog data (no user_id).
create table if not exists sap_rfqs (
  event_id text primary key,
  po text not null,
  payload text not null,
  updated_at timestamptz not null default now()
);
create index if not exists sap_rfqs_po_idx on sap_rfqs (po);

create table if not exists minespider_batches (
  batch_id text primary key,
  lot text not null,
  payload text not null,
  updated_at timestamptz not null default now()
);
create index if not exists minespider_batches_lot_idx on minespider_batches (lot);
