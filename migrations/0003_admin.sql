-- VerityX platform command: tenants, seats, identities, agents, policies, audit.
-- Operational directory data is unowned product state; live identities are
-- upserted from Better Auth on each authenticated admin request.

create table if not exists tenant_orgs (
  id text primary key,
  name text not null,
  slug text not null unique,
  plants text not null default '',
  seats_licensed integer not null default 25,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists tenant_seats (
  id text primary key,
  tenant_id text not null references tenant_orgs (id),
  name text not null,
  email text not null,
  title text not null,
  plant text not null default '',
  role text not null default 'buyer',
  status text not null default 'active',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists tenant_seats_email_idx on tenant_seats (lower(email));
create index if not exists tenant_seats_tenant_idx on tenant_seats (tenant_id);

create table if not exists admin_identities (
  user_id text primary key,
  email text not null,
  name text not null default '',
  role text not null default 'viewer',
  status text not null default 'active',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists admin_identities_email_idx on admin_identities (lower(email));

create table if not exists admin_invites (
  id text primary key,
  email text not null,
  role text not null,
  tenant_id text,
  name text not null default '',
  title text not null default '',
  invited_by text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists agent_nodes (
  id text primary key,
  role text not null,
  status text not null default 'healthy',
  latency_ms integer not null default 12,
  last_beat timestamptz not null default now(),
  notes text not null default ''
);

create table if not exists admin_policies (
  key text primary key,
  label text not null,
  value text not null,
  unit text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists admin_alerts (
  id text primary key,
  severity text not null,
  source text not null,
  title text not null,
  detail text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  acked_by text
);

create table if not exists admin_audit (
  id serial primary key,
  actor_id text not null,
  actor_email text not null,
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on admin_audit (created_at desc);

create table if not exists feature_flags (
  key text primary key,
  label text not null,
  enabled boolean not null default true,
  description text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists admin_settings (
  key text primary key,
  value text not null
);

insert into tenant_orgs (id, name, slug, plants, seats_licensed, status)
values (
  'SIEMENS-GAMESA',
  'Siemens Gamesa Renewable Energy',
  'siemens-gamesa',
  'Hamburg · Brande · Hull · Le Havre · Aalborg · Zamudio · Cuxhaven',
  40,
  'active'
)
on conflict (id) do nothing;

insert into tenant_seats (id, tenant_id, name, email, title, plant, role, status, last_seen_at)
values
  ('seat-eh', 'SIEMENS-GAMESA', 'Elena Hartmann', 'elena.hartmann@siemensgamesa.com', 'Head of Magnetics Procurement', 'Brande, DK', 'tenant_admin', 'active', now() - interval '12 minutes'),
  ('seat-ms', 'SIEMENS-GAMESA', 'Mads Sørensen', 'mads.sorensen@siemensgamesa.com', 'Generator Metals Buyer', 'Hull, GB', 'buyer', 'active', now() - interval '3 hours'),
  ('seat-cm', 'SIEMENS-GAMESA', 'Claire Moreau', 'claire.moreau@siemensgamesa.com', 'Tower Steel Buyer', 'Le Havre, FR', 'buyer', 'active', now() - interval '1 day'),
  ('seat-id', 'SIEMENS-GAMESA', 'Ingrid Dahl', 'ingrid.dahl@siemensgamesa.com', 'Composites Buyer', 'Aalborg, DK', 'buyer', 'active', now() - interval '6 hours')
on conflict (id) do nothing;

insert into agent_nodes (id, role, status, latency_ms, notes)
values
  ('INGEST', 'Pull SAP / Ariba / quote', 'healthy', 18, 'SAP analog feed'),
  ('ORACLE', 'Attach market prints', 'healthy', 42, 'Argus / Asian Metal analog'),
  ('CONSENSUS', 'CoV + MAD filter', 'healthy', 11, ''),
  ('RISK', 'Anomaly vs proposed', 'healthy', 9, ''),
  ('PROVENANCE', 'N-tier mineral passport', 'healthy', 27, 'Circulor analog'),
  ('SCREEN', 'ESG / export / financial', 'degraded', 33, 'EcoVadis analog lag on CN lots'),
  ('COMPLIANCE', 'CBAM / dual-use gate', 'healthy', 14, ''),
  ('SEAL', 'PBFT + hash chain', 'healthy', 21, 'quorum 2f+1=19'),
  ('LEDGER', 'Append-only tip', 'healthy', 8, ''),
  ('EVIDENCE', 'Exportable packet', 'healthy', 16, ''),
  ('AUTH', 'Owner Google + demo seat', 'healthy', 6, 'mattboyer725@gmail.com is platform owner')
on conflict (id) do nothing;

insert into admin_policies (key, label, value, unit, description)
values
  ('anomaly_hold_pct', 'Anomaly hold threshold', '8', '%', 'Hold PO when proposed exceeds consensus market by this percent'),
  ('mad_z', 'MAD filter z-score', '3.5', '', 'Drop oracle prints beyond this modified z'),
  ('cov_verified', 'CoV verified floor', '0.8', '', 'Consensus VERIFIED when 1 − CV is at or above this'),
  ('pbft_nodes', 'PBFT cluster size', '27', 'nodes', 'In-process analog cluster'),
  ('pbft_quorum', 'PBFT quorum 2f+1', '19', 'votes', 'Finality threshold'),
  ('china_share_review', 'China-tier review share', '0.5', '', 'COMPLIANCE review when CN tiers exceed this fraction')
on conflict (key) do nothing;

insert into admin_alerts (id, severity, source, title, detail, status)
values
  ('al-4782', 'critical', 'CONSENSUS', 'Nanjing magnet quote failed MAD', 'Supplier quote 8.12M dropped as outlier against 5.68–5.75M prints on SG-4782.', 'open'),
  ('al-9304', 'high', 'SCREEN', 'Dy metal export permit watch', 'China Northern Rare Earth lot on SG-9304 carries export-licence lag.', 'open'),
  ('al-9012', 'high', 'COMPLIANCE', 'IGBT dual-use gate', 'SG-9012 Infineon modules flagged dual-use / export-control review.', 'open'),
  ('al-5191', 'med', 'RISK', 'Baotou alloy financial opacity', 'RapidRatings analog HIGH on SG-5191.', 'open'),
  ('al-screen', 'med', 'SCREEN', 'ESG analog degraded', 'SCREEN agent latency elevated on CN processing-stage lots.', 'open'),
  ('al-8221', 'low', 'ORACLE', 'Hexion epoxy print spread', 'One ICIS-adjacent print sat wide of the kit consensus.', 'ack')
on conflict (id) do nothing;

insert into feature_flags (key, label, enabled, description)
values
  ('sap_writeback', 'SAP hold / release analog', true, 'Allow desk writeback into the SAP analog'),
  ('evidence_export', 'Evidence packet export', true, 'Buyer can download sealed JSON packets'),
  ('dual_source_gate', 'Dual-source spread gate', true, 'Quote vs oracle spread alerts'),
  ('pbft_seal', 'PBFT hash-chain seal', true, 'Seal every verify into the local chain'),
  ('seat_invites', 'Seat invitations', true, 'Owner can invite tenant seats by email'),
  ('live_oracle_sockets', 'Live LME / Argus sockets', false, 'Not connected — analog prints only')
on conflict (key) do nothing;

insert into admin_settings (key, value)
values
  ('desk_frozen', 'false'),
  ('owner_email', 'mattboyer725@gmail.com')
on conflict (key) do nothing;

insert into admin_audit (actor_id, actor_email, action, target, detail)
values
  ('system', 'system', 'BOOTSTRAP', 'command', 'Platform command schema applied. Owner allowlist: mattboyer725@gmail.com.'),
  ('system', 'system', 'TENANT.SEED', 'SIEMENS-GAMESA', 'Siemens Gamesa tenant with 4 procurement seats.'),
  ('system', 'system', 'AGENT.FLEET', '11', 'Agent nodes registered. SCREEN marked degraded on CN ESG analog.');
