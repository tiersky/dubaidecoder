-- AI market analyses, cached per (version slug, market, input fingerprint).
-- The fingerprint hashes everything the prompt was built from, so a tweak to
-- weights, budget, markets or industry yields a new row instead of a stale one.
-- Server-only: reads and writes go through the service role; no client policies.

create table public.market_insights (
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  market text not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  model text not null,
  content jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (slug, market, fingerprint)
);

create index market_insights_slug_market_idx
  on public.market_insights (slug, market, created_at desc);

alter table public.market_insights enable row level security;
alter table public.market_insights force row level security;
