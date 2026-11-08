-- Demo seats used live-looking @siemensgamesa.com mailboxes for named
-- personas. Move them to the reserved .example TLD (RFC 2606): still
-- recognisable in a Siemens Gamesa demo, never a deliverable address.
-- Idempotent; rewrites rows seeded by 0003/0004 on databases that already ran them.
update tenant_seats
  set email = replace(email, '@siemensgamesa.com', '@siemensgamesa.example')
  where email like '%@siemensgamesa.com';
update ops_events
  set actor_email = replace(actor_email, '@siemensgamesa.com', '@siemensgamesa.example')
  where actor_email like '%@siemensgamesa.com';
