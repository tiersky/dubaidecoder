# Applying migrations

Requires the Supabase project credentials in `decoder-platform/.env.local`
(never committed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, plus `SUPABASE_DB_URL` (the direct Postgres URL)
for migrations.

Apply with psql (or the Supabase SQL editor, pasting the file):

    psql -1 "$SUPABASE_DB_URL" -f supabase/migrations/0001_versions.sql

`-1` runs the file as a single transaction, so a mid-file failure leaves
nothing half-applied.

Verify: `select * from public.versions;` returns zero rows (not an error),
and an anon-key client with no session gets zero rows / RLS denial.

The `config` jsonb column is the single source of truth for a version; the
scalar columns (`slug`, `name`, `currency`, `default_budget`) are derived
from it and must be re-derived on every write by the service-role write
path.
