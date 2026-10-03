-- Milestone 2 — customer addresses. Spec: docs/Database.md §3.
-- RLS is enabled with no policies (deny-all) until Milestone 3 adds them.

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 50),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 30),
  address_line text not null check (char_length(address_line) between 1 and 300),
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  additional_info text check (additional_info is null or char_length(additional_info) <= 500),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);

-- A customer may have many addresses but only one default.
create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

revoke all on table public.addresses from anon, authenticated;
alter table public.addresses enable row level security;

-- profiles(role) index from the security spec §33.
create index profiles_role_idx on public.profiles (role);
