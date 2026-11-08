-- Lock every app table behind row-level security with no policies.
-- On Supabase, tables in "public" are otherwise reachable through its
-- auto-generated REST API with the project's anon key. The app itself
-- connects as the table owner (postgres), which bypasses RLS, so nothing
-- in VerityX changes. Re-run safely; any later migration that creates a
-- table enables RLS on it the same way.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
