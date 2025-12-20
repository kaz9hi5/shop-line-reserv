-- Migrate from phone number (SMS) to LINE user ID
begin;

-- =========================================================
-- Step 1: Add new columns to reservations table
-- =========================================================
alter table public.reservations
add column if not exists line_user_id text,
add column if not exists line_display_name text;

-- =========================================================
-- Step 2: Migrate existing data (if any)
-- =========================================================
-- Copy phone_e164 to line_user_id temporarily
-- In production, you may want to handle this differently
update public.reservations
set line_user_id = phone_e164
where line_user_id is null and phone_e164 is not null;

-- Copy phone_last4 to line_display_name temporarily
update public.reservations
set line_display_name = phone_last4
where line_display_name is null and phone_last4 is not null;

-- =========================================================
-- Step 3: Drop generated column and constraints
-- =========================================================
-- Drop the generated column phone_last4
alter table public.reservations
drop column if exists phone_last4;

-- Drop the old index
drop index if exists idx_reservations_phone;

-- =========================================================
-- Step 4: Make line_user_id NOT NULL and add constraints
-- =========================================================
-- First, ensure all rows have line_user_id
update public.reservations
set line_user_id = '' where line_user_id is null;

-- Make line_user_id NOT NULL
alter table public.reservations
alter column line_user_id set not null;

-- Add new index for line_user_id
create index if not exists idx_reservations_line_user_id on public.reservations (line_user_id);

-- =========================================================
-- Step 5: Drop old phone_e164 column
-- =========================================================
alter table public.reservations
drop column if exists phone_e164;

-- =========================================================
-- Step 6: Update customer_action_counters table
-- =========================================================
-- Add new column
alter table public.customer_action_counters
add column if not exists line_user_id text;

-- Migrate existing data
update public.customer_action_counters
set line_user_id = phone_e164
where line_user_id is null and phone_e164 is not null;

-- Ensure all rows have line_user_id (should not happen in practice, but safety check)
update public.customer_action_counters
set line_user_id = '' where line_user_id is null;

-- Make line_user_id NOT NULL
alter table public.customer_action_counters
alter column line_user_id set not null;

-- Create a new table with the correct structure
create table if not exists public.customer_action_counters_new (
  line_user_id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reset_at timestamptz,
  cancel_count int not null default 0 check (cancel_count >= 0),
  change_count int not null default 0 check (change_count >= 0)
);

-- Copy data from old table to new table
insert into public.customer_action_counters_new (
  line_user_id,
  created_at,
  updated_at,
  reset_at,
  cancel_count,
  change_count
)
select
  line_user_id,
  created_at,
  updated_at,
  reset_at,
  cancel_count,
  change_count
from public.customer_action_counters;

-- Drop old table
drop table if exists public.customer_action_counters;

-- Rename new table to original name
alter table public.customer_action_counters_new
rename to customer_action_counters;

-- Recreate trigger
drop trigger if exists trg_customer_action_counters_updated_at on public.customer_action_counters;
create trigger trg_customer_action_counters_updated_at
before update on public.customer_action_counters
for each row execute function public.set_updated_at();

-- =========================================================
-- Step 7: Update mark_arrived_and_reset_counts function
-- =========================================================
create or replace function public.mark_arrived_and_reset_counts(p_reservation_id uuid)
returns void
language plpgsql
as $$
declare
  v_line_user_id text;
begin
  select line_user_id into v_line_user_id
  from public.reservations
  where id = p_reservation_id;

  if v_line_user_id is null then
    raise exception 'reservation not found: %', p_reservation_id;
  end if;

  update public.reservations
  set arrived_at = now()
  where id = p_reservation_id;

  insert into public.customer_action_counters (line_user_id, cancel_count, change_count, reset_at)
  values (v_line_user_id, 0, 0, now())
  on conflict (line_user_id)
  do update set
    cancel_count = 0,
    change_count = 0,
    reset_at = excluded.reset_at;
end;
$$;

commit;

