-- Milestone 2 — Product Library: categories, products, product images.
-- Spec: docs/Database.md §4–5. Categories per owner decision (2026-10-03):
-- lightweight, admin-managed, optional; deleting a category leaves products uncategorized.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Initial categories. Data, not code: admins can rename, reorder or delete them.
insert into public.categories (name, slug, display_order) values
  ('Cakes', 'cakes', 1),
  ('Bread', 'bread', 2),
  ('Pastries', 'pastries', 3)
on conflict (slug) do nothing;

-- Permanent catalogue record. Soft-deleted via deleted_at so weekly menus and
-- historical orders keep their references.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  description text not null default '' check (char_length(description) <= 2000),
  ingredients text not null default '' check (char_length(ingredients) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index products_category_id_idx on public.products (category_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Image metadata; files live in Supabase Storage (visibility strategy: UNDECIDED).
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);

revoke all on table public.categories, public.products, public.product_images from anon, authenticated;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
