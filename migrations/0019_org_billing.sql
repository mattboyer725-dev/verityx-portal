-- One row per organization: its supplier-side and buyer-side plans, kept in
-- sync from Stripe subscription webhooks, or set by the owner for invoiced
-- customers (status 'manual'). No row = free on both sides.
create table if not exists org_billing (
  organization_id text primary key,
  stripe_customer_id text,
  supplier_plan text not null default 'free',
  supplier_status text,
  supplier_period_end timestamptz,
  supplier_subscription_id text,
  buyer_plan text not null default 'free',
  buyer_status text,
  buyer_period_end timestamptz,
  buyer_subscription_id text,
  note text not null default '',
  updated_at timestamptz not null default now()
);
create index if not exists org_billing_customer_idx on org_billing (stripe_customer_id);
alter table org_billing enable row level security;
