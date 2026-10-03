-- Milestone 4 — Product Library operations.
-- Owner decisions (2026-10-03):
--   * Product photos live in a PUBLIC bucket; only admins may write.
--   * "Delete product" always archives (deleted_at) and is audited.
--   * Archiving is blocked while the product is on the PUBLISHED or DRAFT menu.

-- ---------------------------------------------------------------------
-- Storage: public product-images bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve files by URL without a SELECT policy, so none is added:
-- the bucket cannot be listed through the API. Writes are admin-only.
create policy "product-images: admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- Admins need to read object rows to delete/replace them through the API.
create policy "product-images: admins read"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- ---------------------------------------------------------------------
-- archive_product(): the only way to "delete" a Product Library product.
-- ---------------------------------------------------------------------
create function public.archive_product(target_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  product record;
  had_history boolean;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select id, name, slug, deleted_at
    into product
    from public.products
   where id = target_product_id
   for update;

  if not found or product.deleted_at is not null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from public.weekly_menu_products wmp
      join public.weekly_menus wm on wm.id = wmp.weekly_menu_id
     where wmp.product_id = target_product_id
       and wm.status in ('PUBLISHED', 'DRAFT')
  ) then
    raise exception 'PRODUCT_ON_ACTIVE_MENU' using errcode = 'P0001';
  end if;

  had_history := exists (
    select 1 from public.weekly_menu_products where product_id = target_product_id
  );

  update public.products set deleted_at = now() where id = target_product_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'PRODUCT_DELETED',
    'product',
    target_product_id,
    jsonb_build_object('name', product.name, 'slug', product.slug, 'had_history', had_history)
  );

  return jsonb_build_object('had_history', had_history);
end;
$$;

revoke all on function public.archive_product(uuid) from public, anon;
grant execute on function public.archive_product(uuid) to authenticated;
