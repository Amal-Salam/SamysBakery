-- Milestone 2 — carts. Spec: docs/Database.md §12. Carts never reserve inventory.

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  weekly_menu_product_id uuid not null references public.weekly_menu_products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Adding the same product again increases quantity instead of adding a line.
  constraint cart_items_one_line_per_product unique (cart_id, weekly_menu_product_id)
);

create index cart_items_cart_id_idx on public.cart_items (cart_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

revoke all on table public.carts, public.cart_items from anon, authenticated;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
