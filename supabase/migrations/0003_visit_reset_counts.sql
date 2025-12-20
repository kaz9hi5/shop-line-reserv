-- Add visit confirmation + reset counters (per phone number)
begin;

-- Track customer cancel/change counts by phone number.
create table if not exists public.customer_action_counters (
  phone_e164 text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reset_at timestamptz,

  cancel_count int not null default 0 check (cancel_count >= 0),
  change_count int not null default 0 check (change_count >= 0)
);

drop trigger if exists trg_customer_action_counters_updated_at on public.customer_action_counters;
create trigger trg_customer_action_counters_updated_at
before update on public.customer_action_counters
for each row execute function public.set_updated_at();

-- Mark reservation as arrived (visited).
alter table public.reservations
add column if not exists arrived_at timestamptz;

create index if not exists idx_reservations_arrived_at on public.reservations (arrived_at);

-- Helper: mark arrived and reset counts in one call.
create or replace function public.mark_arrived_and_reset_counts(p_reservation_id uuid)
returns void
language plpgsql
as $$
declare
  v_phone text;
begin
  select phone_e164 into v_phone
  from public.reservations
  where id = p_reservation_id;

  if v_phone is null then
    raise exception 'reservation not found: %', p_reservation_id;
  end if;

  update public.reservations
  set arrived_at = now()
  where id = p_reservation_id;

  insert into public.customer_action_counters (phone_e164, cancel_count, change_count, reset_at)
  values (v_phone, 0, 0, now())
  on conflict (phone_e164)
  do update set
    cancel_count = 0,
    change_count = 0,
    reset_at = excluded.reset_at;
end;
$$;

commit;


