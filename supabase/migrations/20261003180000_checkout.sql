-- Milestone 8 — checkout preparation: ordering cutoff, delivery dates, addresses.
-- Spec: API contract §8, §10–11; PRD §15–16.
-- Owner decisions (2026-10-03):
--   * Initial ORDER_CUTOFF_TIME is 17:00 (Africa/Lagos); admin-editable, audited.
--   * After the cutoff, only TODAY stops being selectable.
--   * Deleting the default address promotes the most recently added remaining one.

-- ---------------------------------------------------------------------
-- Ordering cutoff (system_settings, never a frontend constant)
-- ---------------------------------------------------------------------

insert into public.system_settings (key, value)
values ('ORDER_CUTOFF_TIME', '"17:00"'::jsonb)
on conflict (key) do nothing;

create function public.order_cutoff_time()
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::time from public.system_settings where key = 'ORDER_CUTOFF_TIME'),
    '17:00'::time
  );
$$;

-- Customers may know the cutoff (it explains why today isn't offered).
grant execute on function public.order_cutoff_time() to anon, authenticated;

create function public.set_order_cutoff(new_cutoff text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  previous time;
  parsed time;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if new_cutoff !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'INVALID_CUTOFF' using errcode = 'P0001';
  end if;
  parsed := new_cutoff::time;
  previous := public.order_cutoff_time();

  insert into public.system_settings (key, value, updated_by)
  values ('ORDER_CUTOFF_TIME', to_jsonb(to_char(parsed, 'HH24:MI')), actor)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by;

  insert into public.audit_logs (actor_user_id, action, entity_type, metadata)
  values (actor, 'ORDER_CUTOFF_CHANGED', 'system_setting',
          jsonb_build_object('key', 'ORDER_CUTOFF_TIME',
                             'from', to_char(previous, 'HH24:MI'),
                             'to', to_char(parsed, 'HH24:MI')));
end;
$$;

revoke all on function public.set_order_cutoff(text) from public, anon;
grant execute on function public.set_order_cutoff(text) to authenticated;

-- ---------------------------------------------------------------------
-- Delivery dates: Tuesday–Saturday of the current published menu week,
-- never in the past, and today only before the cutoff (Lagos time).
-- ---------------------------------------------------------------------

create function public.eligible_delivery_dates()
returns setof date
language sql
stable
security definer
set search_path = ''
as $$
  with menu as (
    select week_start, week_end
      from public.weekly_menus
     where status = 'PUBLISHED' and week_end >= public.lagos_today()
     limit 1
  ),
  clock as (
    select public.lagos_today() as today,
           (now() at time zone 'Africa/Lagos')::time as now_time,
           public.order_cutoff_time() as cutoff
  )
  select d::date
    from menu, clock,
         generate_series(greatest(menu.week_start, clock.today), menu.week_end, interval '1 day') as d
   where extract(isodow from d) between 2 and 6
     and not (d::date = clock.today and clock.now_time >= clock.cutoff)
   order by d;
$$;

grant execute on function public.eligible_delivery_dates() to anon, authenticated;

-- Precise reason a date can't be used, for helpful errors.
--   VALID | MENU_UNAVAILABLE | ORDER_CUTOFF_PASSED | DELIVERY_DATE_INVALID
create function public.delivery_date_status(requested date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.weekly_menus where status = 'PUBLISHED' and week_end >= public.lagos_today()
    ) then 'MENU_UNAVAILABLE'
    when requested in (select public.eligible_delivery_dates()) then 'VALID'
    when requested = public.lagos_today()
         and extract(isodow from requested) between 2 and 6
         and exists (
           select 1 from public.weekly_menus
            where status = 'PUBLISHED' and requested between week_start and week_end
         ) then 'ORDER_CUTOFF_PASSED'
    else 'DELIVERY_DATE_INVALID'
  end;
$$;

grant execute on function public.delivery_date_status(date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Addresses: atomic default handling (SECURITY INVOKER: RLS applies, so a
-- customer can only ever touch their own addresses).
-- ---------------------------------------------------------------------

create function public.set_default_address(target_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.addresses where id = target_address_id;
  if owner_id is null or owner_id <> (select auth.uid()) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.addresses set is_default = false
   where user_id = owner_id and is_default and id <> target_address_id;
  update public.addresses set is_default = true where id = target_address_id;
end;
$$;

create function public.delete_address(target_address_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted record;
  replacement uuid;
begin
  delete from public.addresses
   where id = target_address_id and user_id = (select auth.uid())
  returning user_id, is_default into deleted;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if deleted.is_default then
    select id into replacement
      from public.addresses
     where user_id = deleted.user_id
     order by created_at desc, id desc
     limit 1;
    if replacement is not null then
      update public.addresses set is_default = true where id = replacement;
    end if;
  end if;
end;
$$;

revoke all on function public.set_default_address(uuid) from public, anon;
revoke all on function public.delete_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;
grant execute on function public.delete_address(uuid) to authenticated;
