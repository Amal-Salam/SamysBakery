-- Mobile M2 — live cart sync: only carts is published, and line changes touch it.
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select is(
  (select string_agg(tablename::text, ',' order by tablename::text collate "C") from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'),
  'carts', 'only carts is published to Realtime (no items, orders, payments or profiles)');

update public.weekly_menus
   set status = 'EXPIRED', expired_at = coalesce(expired_at, now()), published_at = coalesce(published_at, now()),
       week_start = week_start - 7000, week_end = week_end - 7000;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'a@example.com');
insert into public.products (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'Loaf', 'sync-loaf');
insert into public.weekly_menus (id, week_start, week_end, status, published_at) values
  ('20000000-0000-0000-0000-000000000001', menu_week_start_for(lagos_today()), menu_week_start_for(lagos_today()) + 4, 'PUBLISHED', now());
insert into public.weekly_menu_products (id, weekly_menu_id, product_id, name_snapshot, price, weekly_quantity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Loaf', 5000, 9);
insert into public.carts (id, user_id, updated_at) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '2001-01-01');

create temp table stamps (k text primary key, v timestamptz) on commit drop;

insert into public.cart_items (cart_id, weekly_menu_product_id, quantity)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1);
insert into stamps select 'insert', updated_at from public.carts where id = '40000000-0000-0000-0000-000000000001';
select ok((select v from stamps where k = 'insert') > '2001-01-01', 'adding a line touches the cart');

update public.carts set updated_at = '2001-01-01' where id = '40000000-0000-0000-0000-000000000001';
update public.cart_items set quantity = 2 where cart_id = '40000000-0000-0000-0000-000000000001';
select ok((select updated_at from public.carts where id = '40000000-0000-0000-0000-000000000001') > '2001-01-01',
  'changing a quantity touches the cart');

update public.carts set updated_at = '2001-01-01' where id = '40000000-0000-0000-0000-000000000001';
delete from public.cart_items where cart_id = '40000000-0000-0000-0000-000000000001';
select ok((select updated_at from public.carts where id = '40000000-0000-0000-0000-000000000001') > '2001-01-01',
  'removing a line touches the cart');

select ok(not has_function_privilege('authenticated', 'public.touch_cart()', 'execute'), 'touch_cart is not callable by clients');
select ok(not has_function_privilege('anon', 'public.touch_cart()', 'execute'), 'touch_cart is not callable by visitors');

-- RLS on the published table: a customer reads only their own cart row (what Realtime enforces).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'b@example.com');
insert into public.carts (user_id) values ('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select results_eq($$select user_id from public.carts$$, $$values ('00000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'customer A can see only their own cart row');
set local role anon;
select throws_ok($$select * from public.carts$$, '42501', null, 'visitors cannot read carts at all');

select * from finish();
rollback;
