-- Drafts are wizard state: one pending draft per slug, admin-only.
-- Separate table (not a column on versions) because RLS is row-level:
-- a draft column on a published row would be readable by that
-- project's viewers. versions now only ever holds published content.

create table public.version_drafts (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  config jsonb not null,
  workbook_path text not null,
  source_sheet text,
  source_index integer not null default 0,
  verify jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger version_drafts_set_updated_at
  before update on public.version_drafts
  for each row
  execute function public.set_updated_at();

alter table public.version_drafts enable row level security;
alter table public.version_drafts force row level security;

-- Admin-only reads; writes go through the service role (bypasses RLS),
-- so no insert/update/delete policies for authenticated.
create policy version_drafts_admin_read on public.version_drafts
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
