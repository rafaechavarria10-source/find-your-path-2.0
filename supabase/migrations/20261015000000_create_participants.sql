create table public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null default '',
  school text not null default '',
  grad_year text not null default '',
  role text not null check (role in ('estudiante', 'tutor')),
  events text[] not null default '{}',
  athlete boolean not null default false,
  sport text not null default '',
  recommended_event text,
  results jsonb not null,
  consent boolean not null check (consent),
  privacy_notice_version text not null,
  consented_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  source text not null default 'find-your-path'
);

create index participants_submitted_at_idx on public.participants (submitted_at desc);
create index participants_email_idx on public.participants (lower(email));

alter table public.participants enable row level security;

revoke all on table public.participants from anon, authenticated;
grant all on table public.participants to service_role;
