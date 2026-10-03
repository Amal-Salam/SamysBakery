-- Milestone 5 — Weekly menu lifecycle, product locking, automatic expiry.
-- Spec: PRD §3, §8; API contract §23–24; Database.md §6–8.
-- Owner decisions (2026-10-03):
--   * Business dates use Africa/Lagos.
--   * Create New Week targets the upcoming Tuesday (the current week when today is
--     Tue–Sat and it has not ended; never an ended week).
--   * Expiry runs from pg_cron, and reads treat an ended menu as closed even
--     before the job runs.
--   * PUBLISHED → DRAFT (unpublish) is allowed only while the menu has no orders.

-- ---------------------------------------------------------------------
-- Dates
-- ---------------------------------------------------------------------

create function public.lagos_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

grant execute on function public.lagos_today() to anon, authenticated;

-- Tuesday of the week a new menu should cover, given "today".
--   Mon → tomorrow, Sun → in two days, Tue–Sat → this week's Tuesday.
create function public.menu_week_start_for(today date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case extract(isodow from today)::int
    when 1 then today + 1
    when 7 then today + 2
    else today - (extract(isodow from today)::int - 2)
  end;
$$;

grant execute on function public.menu_week_start_for(date) to authenticated;

-- ---------------------------------------------------------------------
-- Read guard: a published menu whose Saturday has passed is closed to
-- customers immediately, even if the expiry job has not run yet.
-- ---------------------------------------------------------------------

create or replace function public.is_published_menu(menu_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weekly_menus
    where id = menu_id
      and status = 'PUBLISHED'
      and week_end >= public.lagos_today()
  );
$$;

create or replace function public.is_on_published_menu(target_product_id uuid)
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
      and wm.week_end >= public.lagos_today()
  );
$$;

drop policy "weekly_menus: anyone can read the published menu" on public.weekly_menus;
create policy "weekly_menus: anyone can read the published menu"
  on public.weekly_menus for select to anon, authenticated
  using (status = 'PUBLISHED' and week_end >= public.lagos_today());

-- ---------------------------------------------------------------------
-- Expiry (system operation; not callable by clients)
-- ---------------------------------------------------------------------

create function public.expire_ended_menus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  menu record;
  expired_count integer := 0;
begin
  for menu in
    select id, status, week_start, week_end
      from public.weekly_menus
     where status in ('PUBLISHED', 'DRAFT')
       and week_end < public.lagos_today()
     for update
  loop
    update public.weekly_menus
       set status = 'EXPIRED', expired_at = now()
     where id = menu.id;

    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      null,
      'MENU_EXPIRED',
      'weekly_menu',
      menu.id,
      jsonb_build_object(
        'previous_status', menu.status,
        'week_start', menu.week_start,
        'week_end', menu.week_end
      )
    );
    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

revoke all on function public.expire_ended_menus() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Admin lifecycle operations (audited, transactional)
-- ---------------------------------------------------------------------

create function public.create_weekly_menu()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  start_date date;
  new_id uuid;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Serialise concurrent "Create New Week" clicks.
  lock table public.weekly_menus in share row exclusive mode;

  perform public.expire_ended_menus();

  if exists (select 1 from public.weekly_menus where status in ('PUBLISHED', 'DRAFT')) then
    raise exception 'MENU_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  start_date := public.menu_week_start_for(public.lagos_today());

  if exists (select 1 from public.weekly_menus where week_start = start_date) then
    raise exception 'WEEK_ALREADY_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.weekly_menus (week_start, week_end, status)
  values (start_date, start_date + 4, 'DRAFT')
  returning id into new_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'MENU_CREATED', 'weekly_menu', new_id,
          jsonb_build_object('week_start', start_date, 'week_end', start_date + 4));

  return new_id;
end;
$$;

create function public.publish_weekly_menu(target_menu_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  menu record;
  product_count integer;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  lock table public.weekly_menus in share row exclusive mode;

  select id, status, week_start, week_end into menu
    from public.weekly_menus where id = target_menu_id for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if menu.status <> 'DRAFT' then
    raise exception 'MENU_NOT_DRAFT' using errcode = 'P0001';
  end if;
  if menu.week_end < public.lagos_today() then
    raise exception 'MENU_WEEK_ENDED' using errcode = 'P0001';
  end if;

  select count(*) into product_count
    from public.weekly_menu_products where weekly_menu_id = target_menu_id;
  if product_count = 0 then
    raise exception 'MENU_EMPTY' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.weekly_menus where status = 'PUBLISHED') then
    raise exception 'MENU_ALREADY_PUBLISHED' using errcode = 'P0001';
  end if;

  update public.weekly_menus
     set status = 'PUBLISHED', published_at = now()
   where id = target_menu_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'MENU_PUBLISHED', 'weekly_menu', target_menu_id,
          jsonb_build_object('week_start', menu.week_start, 'product_count', product_count));
end;
$$;

create function public.unpublish_weekly_menu(target_menu_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  menu record;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id, status, week_start into menu
    from public.weekly_menus where id = target_menu_id for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if menu.status <> 'PUBLISHED' then
    raise exception 'MENU_NOT_PUBLISHED' using errcode = 'P0001';
  end if;

  -- Any order, lock or reservation (including an in-progress payment) blocks it.
  if exists (
    select 1 from public.weekly_menu_products wmp
     where wmp.weekly_menu_id = target_menu_id
       and (
         wmp.locked_at is not null
         or exists (select 1 from public.order_items oi where oi.weekly_menu_product_id = wmp.id)
         or exists (select 1 from public.inventory_reservations r where r.weekly_menu_product_id = wmp.id)
       )
  ) then
    raise exception 'MENU_HAS_ORDERS' using errcode = 'P0001';
  end if;

  update public.weekly_menus
     set status = 'DRAFT', published_at = null
   where id = target_menu_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'MENU_UNPUBLISHED', 'weekly_menu', target_menu_id,
          jsonb_build_object('week_start', menu.week_start));
end;
$$;

revoke all on function public.create_weekly_menu() from public, anon;
revoke all on function public.publish_weekly_menu(uuid) from public, anon;
revoke all on function public.unpublish_weekly_menu(uuid) from public, anon;
grant execute on function public.create_weekly_menu() to authenticated;
grant execute on function public.publish_weekly_menu(uuid) to authenticated;
grant execute on function public.unpublish_weekly_menu(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Weekly-menu product rules (enforced for every role, including the server)
--   * Expired menus are historical: no inserts, edits or removals.
--   * Archived Product Library products cannot be added.
--   * After the first order (locked_at), name, price and weekly quantity are
--     locked; description, ingredients and photo stay editable.
--   * A product with orders or reservations cannot be removed from the menu.
-- ---------------------------------------------------------------------

create function public.enforce_weekly_menu_product_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  menu_id uuid := case when tg_op = 'DELETE' then old.weekly_menu_id else new.weekly_menu_id end;
  menu_status public.menu_status;
begin
  select status into menu_status from public.weekly_menus where id = menu_id;
  if menu_status = 'EXPIRED' then
    raise exception 'MENU_EXPIRED' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    if exists (select 1 from public.products where id = new.product_id and deleted_at is not null) then
      raise exception 'PRODUCT_ARCHIVED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.weekly_menu_id is distinct from old.weekly_menu_id
       or new.product_id is distinct from old.product_id then
      raise exception 'WEEKLY_PRODUCT_IMMUTABLE_LINK' using errcode = 'P0001';
    end if;
    if old.locked_at is not null and new.locked_at is null then
      raise exception 'WEEKLY_PRODUCT_LOCKED' using errcode = 'P0001';
    end if;
    if old.locked_at is not null and (
         new.name_snapshot is distinct from old.name_snapshot
         or new.price is distinct from old.price
         or new.weekly_quantity is distinct from old.weekly_quantity
       ) then
      raise exception 'WEEKLY_PRODUCT_LOCKED' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- DELETE
  if old.locked_at is not null
     or exists (select 1 from public.order_items where weekly_menu_product_id = old.id)
     or exists (select 1 from public.inventory_reservations where weekly_menu_product_id = old.id)
  then
    raise exception 'WEEKLY_PRODUCT_HAS_ORDERS' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger weekly_menu_products_rules
  before insert or update or delete on public.weekly_menu_products
  for each row execute function public.enforce_weekly_menu_product_rules();

-- ---------------------------------------------------------------------
-- Scheduled expiry: hourly and idempotent, so a menu expires within the
-- first hour after Saturday ends in Lagos regardless of the server timezone.
-- ---------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'expire-ended-weekly-menus',
  '5 * * * *',
  $$select public.expire_ended_menus()$$
);
