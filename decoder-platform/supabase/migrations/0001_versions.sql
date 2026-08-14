-- Decoder platform: versions + revision history.
-- PKs: bigint identity (single-DB, sequential). RLS on everything.

create table public.versions (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  currency text not null default 'USD',
  default_budget numeric not null check (default_budget > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.version_revisions (
  id bigint generated always as identity primary key,
  version_id bigint not null references public.versions (id) on delete cascade,
  revision integer not null,
  config jsonb not null,
  workbook_path text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (version_id, revision)
);

create index version_revisions_version_id_idx
  on public.version_revisions (version_id);

alter table public.versions enable row level security;
alter table public.versions force row level security;
alter table public.version_revisions enable row level security;
alter table public.version_revisions force row level security;

-- Admins read everything; viewers read published versions whose slug is in
-- their app_metadata.allowed_slugs. Writes happen only via the service role
-- (bypasses RLS), so no insert/update/delete policies for authenticated.
create policy versions_read on public.versions
  for select
  to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    or (
      status = 'published'
      and (select auth.jwt() -> 'app_metadata' -> 'allowed_slugs') ? slug
    )
  );

create policy version_revisions_admin_read on public.version_revisions
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Private bucket for uploaded workbooks; only the service role touches it.
insert into storage.buckets (id, name, public)
values ('workbooks', 'workbooks', false)
on conflict (id) do nothing;
