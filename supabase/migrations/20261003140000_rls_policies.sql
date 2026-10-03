-- Milestone 3 — Row Level Security policies and grants.
-- Spec: docs/Database_Security_&_Transaction_Specs.md §4–9, docs/Database.md §21.
--
-- PUBLIC   → published catalogue only.
-- CUSTOMER → own profile, addresses, cart, orders, order items, payments.
-- ADMIN    → read all operational data; write catalogue data.
-- SERVER   → audited/transactional operations (order creation, payments,
--            reservations, stock increases, status changes, menu publication,
--            product deletion, refunds) run through SECURITY DEFINER functions
--            added in later milestones. They are NOT writable through these grants,
--            so the audit trail cannot be bypassed from a client.

-- Helper: true when the menu is the published (customer-visible) menu.
create function public.is_published_menu(menu_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weekly_menus
    where id = menu_id and status = 'PUBLISHED'
  );
$$;

revoke all on function public.is_published_menu(uuid) from public;
grant execute on function public.is_published_menu(uuid) to anon, authenticated;

-- Helper: true when the Product Library product is on the published menu.
create function public.is_on_published_menu(target_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.weekly_menu_products wmp
    join public.weekly_menus wm on wm.id = wmp.weekly_menu_id
    where wmp.product_id = target_product_id
      and wm.status = 'PUBLISHED'
  );
$$;

revoke all on function public.is_on_published_menu(uuid) from public;
grant execute on function public.is_on_published_menu(uuid) to anon, authenticated;

-- Helper: true when the cart belongs to the current user.
create function public.owns_cart(target_cart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.carts
    where id = target_cart_id and user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_cart(uuid) from public, anon;
grant execute on function public.owns_cart(uuid) to authenticated;

-- Helper: true when the order belongs to the current user.
create function public.owns_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where id = target_order_id and user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_order(uuid) from public, anon;
grant execute on function public.owns_order(uuid) to authenticated;

-- =====================================================================
-- Public catalogue
-- =====================================================================

grant select on table public.categories to anon, authenticated;
create policy "categories: anyone can read"
  on public.categories for select to anon, authenticated
  using (true);

grant select on table public.weekly_menus to anon, authenticated;
create policy "weekly_menus: anyone can read the published menu"
  on public.weekly_menus for select to anon, authenticated
  using (status = 'PUBLISHED');
create policy "weekly_menus: admins read all"
  on public.weekly_menus for select to authenticated
  using ((select public.is_admin()));

grant select on table public.weekly_menu_products to anon, authenticated;
create policy "weekly_menu_products: anyone can read published menu products"
  on public.weekly_menu_products for select to anon, authenticated
  using (public.is_published_menu(weekly_menu_id));
create policy "weekly_menu_products: admins read all"
  on public.weekly_menu_products for select to authenticated
  using ((select public.is_admin()));

grant select on table public.products to anon, authenticated;
create policy "products: anyone can read products on the published menu"
  on public.products for select to anon, authenticated
  using (deleted_at is null and public.is_on_published_menu(id));
create policy "products: admins read all"
  on public.products for select to authenticated
  using ((select public.is_admin()));

grant select on table public.product_images to anon, authenticated;
create policy "product_images: anyone can read images of published products"
  on public.product_images for select to anon, authenticated
  using (public.is_on_published_menu(product_id));
create policy "product_images: admins read all"
  on public.product_images for select to authenticated
  using ((select public.is_admin()));

-- =====================================================================
-- Customer-owned data
-- =====================================================================

grant select, insert, update, delete on table public.addresses to authenticated;
create policy "addresses: customers read own"
  on public.addresses for select to authenticated
  using (user_id = (select auth.uid()));
create policy "addresses: customers insert own"
  on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "addresses: customers update own"
  on public.addresses for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "addresses: customers delete own"
  on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "addresses: admins read all"
  on public.addresses for select to authenticated
  using ((select public.is_admin()));

grant select, delete on table public.carts to authenticated;
grant insert (user_id) on table public.carts to authenticated;
create policy "carts: customers read own"
  on public.carts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "carts: customers create own"
  on public.carts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "carts: customers delete own"
  on public.carts for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "carts: admins read all"
  on public.carts for select to authenticated
  using ((select public.is_admin()));

-- Cart lines may only point at products on the published menu. Availability and
-- quantity limits are still re-validated server-side before checkout.
grant select, delete on table public.cart_items to authenticated;
grant insert (cart_id, weekly_menu_product_id, quantity) on table public.cart_items to authenticated;
grant update (quantity) on table public.cart_items to authenticated;
create policy "cart_items: customers read own"
  on public.cart_items for select to authenticated
  using (public.owns_cart(cart_id));
create policy "cart_items: customers add published products to own cart"
  on public.cart_items for insert to authenticated
  with check (
    public.owns_cart(cart_id)
    and exists (
      select 1 from public.weekly_menu_products wmp
      where wmp.id = weekly_menu_product_id
        and public.is_published_menu(wmp.weekly_menu_id)
    )
  );
create policy "cart_items: customers update own"
  on public.cart_items for update to authenticated
  using (public.owns_cart(cart_id))
  with check (public.owns_cart(cart_id));
create policy "cart_items: customers delete own"
  on public.cart_items for delete to authenticated
  using (public.owns_cart(cart_id));
create policy "cart_items: admins read all"
  on public.cart_items for select to authenticated
  using ((select public.is_admin()));

-- Orders, items and payments are read-only for customers; they are created and
-- changed only by server-side transactional functions.
grant select on table public.orders to authenticated;
create policy "orders: customers read own"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "orders: admins read all"
  on public.orders for select to authenticated
  using ((select public.is_admin()));

grant select on table public.order_items to authenticated;
create policy "order_items: customers read items of own orders"
  on public.order_items for select to authenticated
  using (public.owns_order(order_id));
create policy "order_items: admins read all"
  on public.order_items for select to authenticated
  using ((select public.is_admin()));

grant select on table public.payments to authenticated;
create policy "payments: customers read own"
  on public.payments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "payments: admins read all"
  on public.payments for select to authenticated
  using ((select public.is_admin()));

-- =====================================================================
-- Admin-only operational data (read). Writes go through audited functions.
-- =====================================================================

grant select on table public.refunds to authenticated;
create policy "refunds: admins read all"
  on public.refunds for select to authenticated
  using ((select public.is_admin()));

grant select on table public.inventory_reservations to authenticated;
create policy "inventory_reservations: admins read all"
  on public.inventory_reservations for select to authenticated
  using ((select public.is_admin()));

grant select on table public.inventory_adjustments to authenticated;
create policy "inventory_adjustments: admins read all"
  on public.inventory_adjustments for select to authenticated
  using ((select public.is_admin()));

grant select on table public.audit_logs to authenticated;
create policy "audit_logs: admins read all"
  on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

grant select on table public.system_settings to authenticated;
create policy "system_settings: admins read all"
  on public.system_settings for select to authenticated
  using ((select public.is_admin()));

-- =====================================================================
-- Admin catalogue writes (non-audited edits). Product deletion is a soft
-- delete via an audited function, so deleted_at is not client-writable.
-- Weekly-menu creation/publication/expiry are functions (Milestone 5);
-- locked-field enforcement is a Milestone 5 trigger; locked_at is set only by
-- order creation.
-- =====================================================================

grant insert, update, delete on table public.categories to authenticated;
create policy "categories: admins insert"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy "categories: admins update"
  on public.categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "categories: admins delete"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

grant insert (category_id, name, slug, description, ingredients) on table public.products to authenticated;
grant update (category_id, name, slug, description, ingredients) on table public.products to authenticated;
create policy "products: admins insert"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "products: admins update"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant insert (product_id, storage_path, alt_text, display_order) on table public.product_images to authenticated;
grant update (alt_text, display_order) on table public.product_images to authenticated;
grant delete on table public.product_images to authenticated;
create policy "product_images: admins insert"
  on public.product_images for insert to authenticated
  with check ((select public.is_admin()));
create policy "product_images: admins update"
  on public.product_images for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "product_images: admins delete"
  on public.product_images for delete to authenticated
  using ((select public.is_admin()));

grant insert (
  weekly_menu_id, product_id, name_snapshot, description_snapshot, ingredients_snapshot,
  image_snapshot, price, weekly_quantity, low_stock_threshold
) on table public.weekly_menu_products to authenticated;
grant update (
  name_snapshot, description_snapshot, ingredients_snapshot, image_snapshot,
  price, weekly_quantity, low_stock_threshold
) on table public.weekly_menu_products to authenticated;
grant delete on table public.weekly_menu_products to authenticated;
create policy "weekly_menu_products: admins insert"
  on public.weekly_menu_products for insert to authenticated
  with check ((select public.is_admin()));
create policy "weekly_menu_products: admins update"
  on public.weekly_menu_products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "weekly_menu_products: admins delete"
  on public.weekly_menu_products for delete to authenticated
  using ((select public.is_admin()));
