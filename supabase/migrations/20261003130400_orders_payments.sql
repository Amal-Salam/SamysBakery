-- Milestone 2 — orders, order items, payments, refunds.
-- Spec: docs/Database.md §13–17, docs/Database_Security_&_Transaction_Specs.md §16–29.
-- Orders exist only after verified payment. Between payment initialization and
-- verification the pending checkout lives on the PENDING payment row
-- (owner decision 2026-10-03): order_id is NULL until the order is created.

create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- Fulfilment state is kept separate from payment state. BAKING is shown to people
-- as "Baking/Preparing".
create type public.order_status as enum (
  'PAID',
  'RECEIVED',
  'BAKING',
  'READY',
  'HANDED_TO_DELIVERY',
  'DELIVERED',
  'CANCELLED'
);

create type public.refund_status as enum ('NOT_REFUNDED', 'REFUNDED');

-- Rejects UPDATE/DELETE on append-only historical tables, for every role.
create function public.prevent_history_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = 'restrict_violation';
end;
$$;

-- Concurrency-safe order numbers: SAM-1001, SAM-1002, ... (never MAX()+1).
-- Gaps are possible if a transaction rolls back; uniqueness is what matters.
create sequence public.order_number_seq start with 1001 minvalue 1001;

create function public.generate_order_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'SAM-' || nextval('public.order_number_seq')::text;
$$;

revoke all on function public.generate_order_number() from public, anon, authenticated;
revoke all on sequence public.order_number_seq from public, anon, authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number()
    check (order_number ~ '^SAM-[0-9]{4,}$'),
  -- Account deletion policy is UNDECIDED: never cascade-delete orders.
  user_id uuid not null references public.profiles (id) on delete restrict,
  delivery_date date not null
    check (extract(isodow from delivery_date) between 2 and 6),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 30),
  email text not null check (char_length(email) between 3 and 254),
  delivery_address text not null check (char_length(delivery_address) between 1 and 300),
  delivery_city text not null check (char_length(delivery_city) between 1 and 100),
  delivery_state text not null check (char_length(delivery_state) between 1 and 100),
  delivery_additional_info text
    check (delivery_additional_info is null or char_length(delivery_additional_info) <= 500),
  special_notes text check (special_notes is null or char_length(special_notes) <= 500),
  subtotal numeric(12, 2) not null check (subtotal > 0),
  -- An order is only ever created from a verified payment.
  payment_status public.payment_status not null default 'PAID'
    check (payment_status in ('PAID', 'REFUNDED')),
  order_status public.order_status not null default 'PAID',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz not null,
  cancelled_at timestamptz,
  delivered_at timestamptz,
  constraint orders_cancelled_at_set check (order_status <> 'CANCELLED' or cancelled_at is not null),
  constraint orders_delivered_at_set check (order_status <> 'DELIVERED' or delivered_at is not null)
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_order_status_idx on public.orders (order_status);
create index orders_delivery_date_idx on public.orders (delivery_date);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Purchase-time snapshots: the historical truth of what was bought.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  weekly_menu_product_id uuid references public.weekly_menu_products (id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 120),
  product_description text not null default '' check (char_length(product_description) <= 2000),
  product_ingredients text not null default '' check (char_length(product_ingredients) <= 2000),
  product_image text check (product_image is null or char_length(product_image) <= 500),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint order_items_line_total_matches check (line_total = unit_price * quantity)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_weekly_menu_product_id_idx on public.order_items (weekly_menu_product_id);

-- Snapshots never change. The only permitted update is the FK being nulled by
-- ON DELETE SET NULL, which leaves every snapshot column untouched.
create function public.protect_order_item_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'order_items is append-only; DELETE is not permitted'
      using errcode = 'restrict_violation';
  end if;
  if (new.id, new.order_id, new.product_name, new.product_description, new.product_ingredients,
      new.product_image, new.unit_price, new.quantity, new.line_total, new.created_at)
     is distinct from
     (old.id, old.order_id, old.product_name, old.product_description, old.product_ingredients,
      old.product_image, old.unit_price, old.quantity, old.line_total, old.created_at)
     or new.weekly_menu_product_id is not null and new.weekly_menu_product_id is distinct from old.weekly_menu_product_id
  then
    raise exception 'order_items snapshots are immutable'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger order_items_immutable
  before update or delete on public.order_items
  for each row execute function public.protect_order_item_snapshot();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  provider text not null default 'PAYSTACK' check (provider = 'PAYSTACK'),
  reference text not null unique check (char_length(reference) between 1 and 100),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status public.payment_status not null default 'PENDING',
  provider_transaction_id text unique,
  -- Server-written pending checkout (items, prices, address, date, notes).
  -- Authoritative for order creation; never sourced from Paystack metadata.
  checkout_snapshot jsonb not null check (jsonb_typeof(checkout_snapshot) = 'object'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_paid_at_set check (status not in ('PAID', 'REFUNDED') or paid_at is not null)
);

-- One payment per order.
create unique index payments_order_id_key on public.payments (order_id) where order_id is not null;
create index payments_user_id_idx on public.payments (user_id);
create index payments_status_idx on public.payments (status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- Refunds are separate from cancellation and are only marked REFUNDED once the
-- provider confirms. Reconciliation details: UNDECIDED (Milestone 14).
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  status public.refund_status not null default 'NOT_REFUNDED',
  paystack_refund_id text unique,
  provider_status text check (provider_status is null or char_length(provider_status) <= 50),
  requested_at timestamptz,
  processed_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refunds_processed_at_set check (status <> 'REFUNDED' or processed_at is not null)
);

create index refunds_order_id_idx on public.refunds (order_id);
create index refunds_payment_id_idx on public.refunds (payment_id);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function public.set_updated_at();

revoke all on table public.orders, public.order_items, public.payments, public.refunds
  from anon, authenticated;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
