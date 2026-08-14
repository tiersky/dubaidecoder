# Applying migrations

Requires the Supabase project credentials in `decoder-platform/.env.local`
(never committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, plus `SUPABASE_DB_URL` (the direct Postgres URL)
for migrations.

Apply with psql (or the Supabase SQL editor, pasting the file):

    psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_versions.sql

Verify: `select * from public.versions;` returns zero rows (not an error),
and an anon-key client with no session gets zero rows / RLS denial.
