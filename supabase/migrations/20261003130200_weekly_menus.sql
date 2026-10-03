-- Milestone 2 — weekly menus and weekly-menu products. Spec: docs/Database.md §6–8.

create type public.menu_status as enum ('DRAFT', 'PUBLISHED', 'EXPIRED');

create table public.weekly_menus (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  status public.menu_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  published_at timestamptz,
  expired_at timestamptz,
  -- Active menu runs Tuesday → Saturday.
  constraint weekly_menus_starts_tuesday check (extract(isodow from week_start) = 2),
  constraint weekly_menus_ends_saturday check (week_end = week_start + 4),
  constraint weekly_menus_published_at_set
    check (status <> 'PUBLISHED' or published_at is not null),
  constraint weekly_menus_expired_at_set
    check (status <> 'EXPIRED' or expired_at is not null)
);

create index weekly_menus_status_idx on public.weekly_menus (status);

-- Exactly one published/current menu and at most one draft at a time.
create unique index weekly_menus_one_published
  on public.weekly_menus ((true))
  where status = 'PUBLISHED';
create unique index weekly_menus_one_draft
  on public.weekly_menus ((true))
  where status = 'DRAFT';

-- A product as sold in a specific week. Snapshots keep historical menus stable
-- when the Product Library changes. name_snapshot, price and weekly_quantity
-- lock after the first order (locked_at); enforced in Milestone 5.
create table public.weekly_menu_products (
  id uuid primary key default gen_random_uuid(),
  weekly_menu_id uuid not null references public.weekly_menus (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 120),
  description_snapshot text not null default '' check (char_length(description_snapshot) <= 2000),
  ingredients_snapshot text not null default '' check (char_length(ingredients_snapshot) <= 2000),
  image_snapshot text check (image_snapshot is null or char_length(image_snapshot) <= 500),
  price numeric(12, 2) not null check (price > 0),
  weekly_quantity integer not null check (weekly_quantity >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  constraint weekly_menu_products_unique_product unique (weekly_menu_id, product_id)
);

create index weekly_menu_products_weekly_menu_id_idx on public.weekly_menu_products (weekly_menu_id);
create index weekly_menu_products_product_id_idx on public.weekly_menu_products (product_id);

create trigger weekly_menu_products_set_updated_at
  before update on public.weekly_menu_products
  for each row execute function public.set_updated_at();

revoke all on table public.weekly_menus, public.weekly_menu_products from anon, authenticated;
alter table public.weekly_menus enable row level security;
alter table public.weekly_menu_products enable row level security;
