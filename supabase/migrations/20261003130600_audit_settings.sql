-- Milestone 2 — audit log and system settings. Spec: docs/Database.md §18–19.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- NULL for system actions (e.g. automatic menu expiry).
  actor_user_id uuid references public.profiles (id) on delete restrict,
  action text not null check (action ~ '^[A-Z][A-Z_]*$' and char_length(action) <= 64),
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.prevent_history_modification();

-- Configurable operational values (e.g. ORDER_CUTOFF_TIME). No defaults are seeded:
-- the initial cutoff time is UNDECIDED and must not be hardcoded.
create table public.system_settings (
  key text primary key check (key ~ '^[A-Z][A-Z_]*$' and char_length(key) <= 64),
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create trigger system_settings_set_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

revoke all on table public.audit_logs, public.system_settings from anon, authenticated;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;
