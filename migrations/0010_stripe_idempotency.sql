-- SEC-02 parity: at most one billing.paid_stripe audit row per Stripe event id,
-- enforced by the database so concurrent webhook deliveries cannot double-audit.
create unique index if not exists audit_logs_stripe_event_uidx
  on audit_logs (request_id)
  where action = 'billing.paid_stripe';
