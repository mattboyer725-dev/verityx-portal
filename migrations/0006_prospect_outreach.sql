-- Prospect outreach + VerityX own book of business.
-- book_key is unique per tenant so "Open VerityX book" is idempotent.

alter table prospects add column if not exists book_key text;
alter table prospects add column if not exists contact_role text not null default '';
alter table prospects add column if not exists last_contacted_at timestamptz;
alter table prospects add column if not exists outreach_count integer not null default 0;

create unique index if not exists prospects_org_book_key_idx
  on prospects (organization_id, book_key)
  where book_key is not null and book_key <> '';

create table if not exists outreach_events (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  prospect_id text not null references prospects (id) on delete cascade,
  channel text not null default 'email',
  subject text not null default '',
  body text not null default '',
  status text not null default 'logged',
  created_at timestamptz not null default now()
);

create index if not exists outreach_events_org_idx on outreach_events (organization_id);
create index if not exists outreach_events_prospect_idx on outreach_events (prospect_id, created_at desc);
