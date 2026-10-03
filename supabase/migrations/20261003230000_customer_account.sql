-- Milestone 13 — customer account: profile edits and account deletion.
-- Owner decisions (2026-10-03):
--   * "Delete my account" = delete + anonymize: login, profile, addresses and
--     cart are removed; past orders stay for the bakery's records with the
--     customer's personal details replaced by placeholders. The email can be
--     used to sign up again.
--   * Blocked while any order is still in progress (not DELIVERED/CANCELLED)
--     or a payment is pending.

-- ---------------------------------------------------------------------
-- Orders, payments and audit entries outlive the customer's account.
-- ---------------------------------------------------------------------

alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments
  add constraint payments_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.audit_logs drop constraint audit_logs_actor_user_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_user_id_fkey foreign key (actor_user_id) references public.profiles (id) on delete set null;

-- Audit log stays append-only; the single permitted change is clearing the
-- actor when that account is deleted (performed by the FK above).
create function public.protect_audit_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_user_id is not null and new.actor_user_id is null
     and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then
    return new;
  end if;
  raise exception 'audit_logs is append-only; % is not permitted', tg_op using errcode = 'restrict_violation';
end;
$$;

drop trigger audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.protect_audit_log();

-- ---------------------------------------------------------------------
-- delete_my_account(): the signed-in customer deletes their own account.
-- ---------------------------------------------------------------------

create function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role public.app_role;
  anonymized_orders integer;
begin
  if actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select role into actor_role from public.profiles where id = actor for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Admin accounts are managed by the bakery, not deleted from the storefront.
  if actor_role = 'ADMIN' then
    raise exception 'ADMIN_ACCOUNT' using errcode = 'P0001';
  end if;

  -- Never lose delivery details for an order still being fulfilled.
  if exists (
    select 1 from public.orders
     where user_id = actor and order_status not in ('DELIVERED', 'CANCELLED')
  ) then
    raise exception 'ORDERS_IN_PROGRESS' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where user_id = actor and status = 'PENDING') then
    raise exception 'PAYMENT_IN_PROGRESS' using errcode = 'P0001';
  end if;

  -- Anonymize the customer's personal details on historical orders.
  update public.orders
     set recipient_name = 'Deleted customer',
         phone = 'removed',
         email = 'deleted-customer@invalid',
         delivery_address = 'Removed',
         delivery_city = 'Removed',
         delivery_state = 'Removed',
         delivery_additional_info = null,
         special_notes = null
   where user_id = actor;
  get diagnostics anonymized_orders = row_count;

  -- Payment snapshots keep only what the bakery needs (priced lines, totals).
  update public.payments
     set checkout_snapshot = (checkout_snapshot - 'customer' - 'address' - 'special_notes')
                             || jsonb_build_object('anonymized', true)
   where user_id = actor;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (null, 'ACCOUNT_DELETED', 'account', actor,
          jsonb_build_object('orders_anonymized', anonymized_orders));

  -- Profile delete cascades addresses and cart, and detaches orders,
  -- payments and audit entries (FKs above). Then remove the login itself.
  delete from public.profiles where id = actor;
  delete from auth.users where id = actor;

  return jsonb_build_object('orders_anonymized', anonymized_orders);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
