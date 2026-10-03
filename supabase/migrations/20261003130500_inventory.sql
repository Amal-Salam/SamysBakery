-- Milestone 2 — inventory reservations and adjustments. Spec: docs/Database.md §9–11.
-- available = weekly_quantity + sum(adjustments) - active reservations.
-- There is deliberately no mutable available_quantity column.
-- Placed after orders/payments because reservations reference both.

create type public.reservation_type as enum ('PAYMENT_TEMPORARY', 'ORDER_CONFIRMED');
create type public.reservation_status as enum ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONVERTED');

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  weekly_menu_product_id uuid not null references public.weekly_menu_products (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reservation_type public.reservation_type not null,
  status public.reservation_status not null default 'ACTIVE',
  -- Temporary-reservation timeout is UNDECIDED and will be configurable.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint inventory_reservations_temporary_shape check (
    reservation_type <> 'PAYMENT_TEMPORARY'
    or (payment_id is not null and expires_at is not null)
  ),
  constraint inventory_reservations_confirmed_shape check (
    reservation_type <> 'ORDER_CONFIRMED' or order_id is not null
  ),
  constraint inventory_reservations_released_at_set check (
    status not in ('RELEASED', 'EXPIRED') or released_at is not null
  )
);

create index inventory_reservations_product_status_idx
  on public.inventory_reservations (weekly_menu_product_id, status);
create index inventory_reservations_expires_at_idx
  on public.inventory_reservations (expires_at)
  where status = 'ACTIVE';
create index inventory_reservations_order_id_idx on public.inventory_reservations (order_id);
create index inventory_reservations_payment_id_idx on public.inventory_reservations (payment_id);

-- Admin stock increases. Positive only; append-only for auditability.
create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  weekly_menu_product_id uuid not null references public.weekly_menu_products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  reason text not null check (char_length(reason) between 1 and 500),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index inventory_adjustments_weekly_menu_product_id_idx
  on public.inventory_adjustments (weekly_menu_product_id);

create trigger inventory_adjustments_append_only
  before update or delete on public.inventory_adjustments
  for each row execute function public.prevent_history_modification();

revoke all on table public.inventory_reservations, public.inventory_adjustments
  from anon, authenticated;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_adjustments enable row level security;
