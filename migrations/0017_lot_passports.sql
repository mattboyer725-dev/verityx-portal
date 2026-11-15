-- Lot passports: a supplier's signed declaration of where each restricted
-- stage of one lot happened (mined, separated, refined, melted, produced),
-- with SHA-256 fingerprints of the evidence. Documents themselves are never
-- uploaded. A sealed passport is immutable: corrections are a new passport
-- that supersedes it, and the old one is revoked with a reason.
create table if not exists lot_passports (
  id text primary key,
  code text not null unique,
  organization_id text not null,
  created_by text not null,
  publisher text not null,
  lot_ref text not null default '',
  material text not null,
  mass_kg double precision not null default 0,
  description text not null default '',
  stages_json text not null default '[]',
  inputs_json text not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'sealed', 'revoked')),
  digest text,
  canonical text,
  analysis_json text,
  ledger_hash text,
  receipt_json text,
  sealed_at timestamptz,
  sealed_by text,
  supersedes text,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lot_passports_org_idx on lot_passports (organization_id, updated_at desc);
create index if not exists lot_passports_status_idx on lot_passports (status);
alter table lot_passports enable row level security;
