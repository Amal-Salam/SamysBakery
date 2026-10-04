-- Milestone 17 — audit coverage for "significant administrative changes"
-- (AGENTS.md §36; Database_Security_&_Transaction_Specs.md §30).
--
-- Already audited by their database functions: MENU_CREATED/PUBLISHED/
-- UNPUBLISHED/EXPIRED, PRODUCT_DELETED, INVENTORY_INCREASED, ORDER_CREATED,
-- ORDER_STATUS_CHANGED, ORDER_CANCELLED, REFUND_INITIATED/REQUESTED/
-- CONFIRMED/FAILED, payment anomalies, settings changes, ACCOUNT_DELETED.
--
-- Added here, as triggers so no code path (app, script or SQL) can skip them:
--   * ACCOUNT_ADMIN_ACTION      — a profile's role changes (e.g. promote to ADMIN)
--   * PRODUCT_CREATED/UPDATED   — Product Library records
--   * PRODUCT_IMAGE_ADDED/REMOVED
--   * CATEGORY_CREATED/UPDATED/DELETED
--   * MENU_PRODUCT_ADDED/UPDATED/REMOVED — weekly price, quantity, threshold, text
-- The actor is the signed-in user, or NULL for operator/system changes.

-- ---------------------------------------------------------------------
-- Account role changes
-- ---------------------------------------------------------------------

create function public.audit_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (actor, 'ACCOUNT_ADMIN_ACTION', 'account', new.id,
          jsonb_build_object('change', 'ROLE_CHANGED', 'from', old.role, 'to', new.role,
                             'name', new.full_name,
                             'via', case when actor is null then 'OPERATOR' else 'APP' end));
  return new;
end;
$$;

create trigger profiles_audit_role_change
  after update of role on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.audit_profile_role_change();

-- ---------------------------------------------------------------------
-- Product Library
-- ---------------------------------------------------------------------

create function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'PRODUCT_CREATED', 'product', new.id, jsonb_build_object('name', new.name));
    return new;
  end if;

  -- Archiving ("delete") is audited by archive_product() as PRODUCT_DELETED.
  if old.deleted_at is distinct from new.deleted_at then
    return new;
  end if;
  if old.name is distinct from new.name then changed := array_append(changed, 'name'); end if;
  if old.slug is distinct from new.slug then changed := array_append(changed, 'slug'); end if;
  if old.description is distinct from new.description then changed := array_append(changed, 'description'); end if;
  if old.ingredients is distinct from new.ingredients then changed := array_append(changed, 'ingredients'); end if;
  if old.category_id is distinct from new.category_id then changed := array_append(changed, 'category'); end if;
  if cardinality(changed) = 0 then
    return new;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'PRODUCT_UPDATED', 'product', new.id,
          jsonb_strip_nulls(jsonb_build_object(
            'name', new.name,
            'previous_name', case when old.name is distinct from new.name then old.name end,
            'fields', to_jsonb(changed))));
  return new;
end;
$$;

create trigger products_audit
  after insert or update on public.products
  for each row execute function public.audit_product_change();

create function public.audit_product_image_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  image record;
begin
  if tg_op = 'INSERT' then image := new; else image := old; end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()),
          case when tg_op = 'INSERT' then 'PRODUCT_IMAGE_ADDED' else 'PRODUCT_IMAGE_REMOVED' end,
          'product', image.product_id,
          jsonb_build_object('storage_path', image.storage_path,
                             'name', (select p.name from public.products p where p.id = image.product_id)));
  return null;
end;
$$;

create trigger product_images_audit
  after insert or delete on public.product_images
  for each row execute function public.audit_product_image_change();

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------

create function public.audit_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.name is not distinct from new.name and old.slug is not distinct from new.slug then
    return null; -- display order only
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()),
          'CATEGORY_' || case tg_op when 'INSERT' then 'CREATED' when 'UPDATE' then 'UPDATED' else 'DELETED' end,
          'category',
          coalesce(new.id, old.id),
          jsonb_strip_nulls(jsonb_build_object(
            'name', coalesce(new.name, old.name),
            'previous_name', case when tg_op = 'UPDATE' and old.name is distinct from new.name then old.name end)));
  return null;
end;
$$;

create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function public.audit_category_change();

-- ---------------------------------------------------------------------
-- Weekly-menu products (entity = the weekly menu, so its activity is one list)
-- ---------------------------------------------------------------------

create function public.audit_menu_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
  other_fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'MENU_PRODUCT_ADDED', 'weekly_menu', new.weekly_menu_id,
            jsonb_build_object('weekly_menu_product_id', new.id, 'name', new.name_snapshot, 'price', new.price,
                               'weekly_quantity', new.weekly_quantity, 'low_stock_threshold', new.low_stock_threshold));
    return null;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), 'MENU_PRODUCT_REMOVED', 'weekly_menu', old.weekly_menu_id,
            jsonb_build_object('weekly_menu_product_id', old.id, 'name', old.name_snapshot));
    return null;
  end if;

  -- UPDATE: only admin-editable fields (locking on first order is not an admin change).
  if old.name_snapshot is distinct from new.name_snapshot then
    changes := changes || jsonb_build_object('name', jsonb_build_object('from', old.name_snapshot, 'to', new.name_snapshot));
  end if;
  if old.price is distinct from new.price then
    changes := changes || jsonb_build_object('price', jsonb_build_object('from', old.price, 'to', new.price));
  end if;
  if old.weekly_quantity is distinct from new.weekly_quantity then
    changes := changes || jsonb_build_object('weekly_quantity',
                 jsonb_build_object('from', old.weekly_quantity, 'to', new.weekly_quantity));
  end if;
  if old.low_stock_threshold is distinct from new.low_stock_threshold then
    changes := changes || jsonb_build_object('low_stock_threshold',
                 jsonb_build_object('from', old.low_stock_threshold, 'to', new.low_stock_threshold));
  end if;
  if old.description_snapshot is distinct from new.description_snapshot then other_fields := array_append(other_fields, 'description'); end if;
  if old.ingredients_snapshot is distinct from new.ingredients_snapshot then other_fields := array_append(other_fields, 'ingredients'); end if;
  if old.image_snapshot is distinct from new.image_snapshot then other_fields := array_append(other_fields, 'photo'); end if;

  if changes = '{}'::jsonb and cardinality(other_fields) = 0 then
    return null;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'MENU_PRODUCT_UPDATED', 'weekly_menu', new.weekly_menu_id,
          jsonb_build_object('weekly_menu_product_id', new.id, 'name', new.name_snapshot,
                             'changes', changes, 'fields', to_jsonb(other_fields)));
  return null;
end;
$$;

create trigger weekly_menu_products_audit
  after insert or update or delete on public.weekly_menu_products
  for each row execute function public.audit_menu_product_change();

-- Trigger functions are not callable by clients.
revoke all on function public.audit_profile_role_change() from public, anon, authenticated;
revoke all on function public.audit_product_change() from public, anon, authenticated;
revoke all on function public.audit_product_image_change() from public, anon, authenticated;
revoke all on function public.audit_category_change() from public, anon, authenticated;
revoke all on function public.audit_menu_product_change() from public, anon, authenticated;
