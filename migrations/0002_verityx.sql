-- Verityx Customer Zero OS — tenant-scoped product schema.
-- Every customer-data table carries organization_id. user_id is TEXT (Better Auth).

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('founder', 'admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  unique (user_id),
  unique (organization_id, user_id)
);

create index if not exists memberships_org_idx on memberships (organization_id);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists prospects (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  company_name text not null,
  contact_name text not null default '',
  contact_email text not null default '',
  sector text not null default '',
  region text not null default '',
  stage text not null default 'lead',
  notes text not null default '',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_org_idx on prospects (organization_id);

create table if not exists pilots (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  prospect_id text not null references prospects (id),
  title text not null,
  scope text not null default '',
  status text not null default 'intake',
  sla_hours integer not null default 72,
  price_usd integer not null default 2500,
  payment_status text not null default 'unpaid',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  paid_via text,
  paid_note text not null default '',
  inputs_received_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilots_org_idx on pilots (organization_id);
create index if not exists pilots_prospect_idx on pilots (prospect_id);
create index if not exists pilots_stripe_session_idx on pilots (stripe_checkout_session_id);

create table if not exists decisions (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  pilot_id text not null references pilots (id),
  rule_version text not null,
  recommended_band text not null,
  proposed_action text not null,
  status text not null,
  confidence_rationale text not null,
  evidence_json text not null,
  source_timestamps_json text not null,
  rules_fired_json text not null,
  approved_by_user_id text,
  approved_at timestamptz,
  approval_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decisions_org_idx on decisions (organization_id);
create index if not exists decisions_pilot_idx on decisions (pilot_id);

create table if not exists reports (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  pilot_id text not null references pilots (id),
  decision_id text,
  title text not null,
  summary text not null,
  body text not null,
  disclaimer text not null,
  created_at timestamptz not null default now()
);

create index if not exists reports_org_idx on reports (organization_id);
create index if not exists reports_pilot_idx on reports (pilot_id);

create table if not exists feedback (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  pilot_id text not null references pilots (id),
  kind text not null,
  rating integer,
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists feedback_org_idx on feedback (organization_id);

create table if not exists outcomes (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  pilot_id text not null references pilots (id),
  outcome_accuracy text not null default 'unknown',
  outcome_value text not null default '',
  time_to_resolution_days integer,
  case_study_permission text not null default 'undecided',
  follow_up_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pilot_id)
);

create index if not exists outcomes_org_idx on outcomes (organization_id);

create table if not exists audit_logs (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  actor_user_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata_json text not null default '{}',
  request_id text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_idx on audit_logs (organization_id);
create index if not exists audit_logs_created_idx on audit_logs (organization_id, created_at desc);

create table if not exists stripe_events (
  id text primary key,
  event_type text not null,
  organization_id text,
  pilot_id text,
  processed_at timestamptz not null default now()
);
