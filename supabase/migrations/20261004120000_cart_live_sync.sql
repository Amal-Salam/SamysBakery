-- Mobile M2 — live cart sync between the website and the mobile app.
--
-- Design (minimal data on the live channel):
--   * Only public.carts is published to Supabase Realtime. Each client
--     subscribes to its OWN cart row (filter user_id = its id); RLS
--     ("carts: customers read own") decides who receives each change.
--   * Every insert/update/delete of a cart line "touches" its cart row
--     (updated_at), so a subscriber learns "your cart changed" — the event
--     carries no products or prices — and re-reads the cart through the
--     normal, server-evaluated path.
--   * cart_items is deliberately NOT published: Realtime cannot apply RLS to
--     DELETE events, which would leak deleted row ids to other subscribers.

create function public.touch_cart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.carts
     set updated_at = now()
   where id = coalesce(new.cart_id, old.cart_id);
  return null;
end;
$$;

revoke all on function public.touch_cart() from public, anon, authenticated;

create trigger cart_items_touch_cart
  after insert or update or delete on public.cart_items
  for each row execute function public.touch_cart();

alter publication supabase_realtime add table public.carts;
