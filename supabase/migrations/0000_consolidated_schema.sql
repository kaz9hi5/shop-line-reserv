-- Consolidated schema for shop-line-reserv
-- This file consolidates all migrations into a single schema definition
-- Latest structure as of migration 0001 (includes line_users table)

begin;

-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- =========================================================
-- App settings (singleton)
-- =========================================================
create table if not exists public.app_settings (
  id boolean primary key default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- reservation cancellation / modification deadline (hours before start)
  reservation_deadline_hours int not null default 24 check (reservation_deadline_hours between 1 and 48),

  -- default business hours
  default_open_time time not null default '10:00',
  default_close_time time not null default '19:00',

  -- default lunch break
  default_lunch_enabled boolean not null default false,
  default_lunch_start time,
  default_lunch_end time
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

-- =========================================================
-- Staff table (店員テーブル)
-- =========================================================
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  name text not null,
  role text not null check (role in ('manager', 'staff'))
);

create index if not exists idx_staff_deleted_at on public.staff (deleted_at);

-- Insert initial manager record
insert into public.staff (name, role) values ('店長', 'manager')
on conflict do nothing;

-- =========================================================
-- Admin: IP allowlist (physical delete, no soft-delete)
-- =========================================================
create table if not exists public.admin_allowed_ips (
  ip text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  device_fingerprint text
  staff_id uuid references public.staff (id)
);

create index if not exists idx_admin_allowed_ips_device_fingerprint 
on public.admin_allowed_ips (device_fingerprint) 
where device_fingerprint is not null;

create index if not exists idx_admin_allowed_ips_staff_id
on public.admin_allowed_ips (staff_id);

comment on column public.admin_allowed_ips.device_fingerprint is 'Device fingerprint for device-based identification';
comment on column public.admin_allowed_ips.staff_id is 'Optional linkage to staff (for management purposes). Role is determined from staff.role when staff_id is linked.';

-- =========================================================
-- Treatments (施術メニュー) - physical delete
-- =========================================================
create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  name text not null,
  description text not null default '',
  duration_minutes int not null check (duration_minutes between 1 and 24*60),
  price_yen int not null check (price_yen >= 0),

  sort_order int not null default 0
);

-- =========================================================
-- Business day settings (per specific date and staff)
-- =========================================================
create table if not exists public.business_days (
  day date not null,
  staff_id uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null check (status in ('open','holiday','closed')),
  
  primary key (day, staff_id)
);

create index if not exists idx_business_days_staff_id 
on public.business_days (staff_id);

-- Business hour overrides (per specific date and staff)
create table if not exists public.business_hours_overrides (
  day date not null,
  staff_id uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  open_time time not null,
  close_time time not null,

  lunch_enabled boolean not null default false,
  lunch_start time,
  lunch_end time,
  
  primary key (day, staff_id)
);

create index if not exists idx_business_hours_overrides_staff_id 
on public.business_hours_overrides (staff_id);

-- =========================================================
-- Reservations
-- =========================================================
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- user identity (LINE-based)
  line_user_id text not null,
  line_display_name text,
  user_name text not null,

  -- menu
  treatment_id uuid references public.treatments (id),
  treatment_name_snapshot text not null default '',
  treatment_duration_minutes_snapshot int not null default 0,
  treatment_price_yen_snapshot int not null default 0,

  -- schedule
  start_at timestamptz not null,
  end_at timestamptz not null,

  -- visit confirmation
  arrived_at timestamptz,

  via text not null default 'web' check (via in ('web','phone','admin'))
);

create index if not exists idx_reservations_start_at on public.reservations (start_at);
create index if not exists idx_reservations_line_user_id on public.reservations (line_user_id);
create index if not exists idx_reservations_deleted_at on public.reservations (deleted_at);
create index if not exists idx_reservations_arrived_at on public.reservations (arrived_at);

-- Prevent overlaps for active reservations (single shop)
-- Uses stored end_at so that duration changes later do not retroactively shift bookings.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_no_overlap_active'
  ) then
    alter table public.reservations
      add constraint reservations_no_overlap_active
      exclude using gist (
        tstzrange(start_at, end_at) with &&
      )
      where (deleted_at is null);
  end if;
end $$;


-- =========================================================
-- LINE Users table (お友達登録情報)
-- =========================================================
create table if not exists public.line_users (
  line_user_id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- LINE user information
  line_display_name text,
  name text,
  
  -- Profile information (can be updated via LINE API)
  picture_url text,
  
  -- Status
  is_friend boolean not null default true, -- false when user blocks/unfriends
  unfriended_at timestamptz
);

create index if not exists idx_line_users_is_friend on public.line_users (is_friend);
create index if not exists idx_line_users_created_at on public.line_users (created_at);

comment on table public.line_users is 'LINE users who have added the bot as a friend';
comment on column public.line_users.line_user_id is 'LINE user ID (primary key)';
comment on column public.line_users.line_display_name is 'LINE display name';
comment on column public.line_users.name is 'User name (can be set manually or from LINE profile)';
comment on column public.line_users.is_friend is 'Whether the user is still a friend (false when blocked/unfriended)';
comment on column public.line_users.unfriended_at is 'Timestamp when user unfriended/blocked';

-- =========================================================
-- User action counters (per LINE user ID)
-- Note: Table name kept as customer_action_counters for backward compatibility
-- =========================================================
create table if not exists public.customer_action_counters (
  line_user_id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reset_at timestamptz,

  cancel_count int not null default 0 check (cancel_count >= 0),
  change_count int not null default 0 check (change_count >= 0)
);

-- =========================================================
-- Helper Functions
-- =========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Verify manager name (used by admin gate before IP is allowlisted).
-- Returns only boolean, never exposes the manager name.
create or replace function public.verify_manager_name(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    where s.role = 'manager'
      and s.deleted_at is null
      and s.name = btrim(p_name)
  );
$$;

-- Check whether an IP is allowlisted for admin access.
create or replace function public.is_admin_ip_allowed(
  p_ip text,
  p_device_fingerprint text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_allowed_ips a
    where a.ip = btrim(p_ip)
  );
$$;

-- Update device fingerprint for an allowlisted IP (called on each admin access).
create or replace function public.touch_admin_allowed_ip_fingerprint(
  p_ip text,
  p_device_fingerprint text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.admin_allowed_ips
  set device_fingerprint = nullif(p_device_fingerprint, ''),
      updated_at = now()
  where ip = btrim(p_ip);
end;
$$;

-- Gate-only helper: add IP to allowlist if (and only if) manager name matches.
-- Note: Even when manager name verification succeeds, staff_id is kept NULL.
-- Role is determined from staff.role when staff_id is linked later.
create or replace function public.gate_add_allowed_ip(
  p_ip text,
  p_manager_name text,
  p_device_fingerprint text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  v_ok := public.verify_manager_name(p_manager_name);
  if not v_ok then
    return false;
  end if;

  insert into public.admin_allowed_ips (ip, device_fingerprint, staff_id)
  values (btrim(p_ip), nullif(p_device_fingerprint, ''), null)
  on conflict (ip)
  do update set
    device_fingerprint = excluded.device_fingerprint,
    staff_id = excluded.staff_id,
    updated_at = now();

  return true;
end;
$$;

-- Snapshot treatment fields + compute end_at on insert/update when treatment_id changes or start_at changes.
create or replace function public.reservations_apply_treatment_snapshot()
returns trigger
language plpgsql
as $$
declare
  t record;
begin
  if new.treatment_id is null then
    raise exception 'treatment_id is required';
  end if;

  select id, name, duration_minutes, price_yen
    into t
  from public.treatments
  where id = new.treatment_id;

  if not found then
    raise exception 'treatment_id not found: %', new.treatment_id;
  end if;

  new.treatment_name_snapshot := t.name;
  new.treatment_duration_minutes_snapshot := t.duration_minutes;
  new.treatment_price_yen_snapshot := t.price_yen;
  new.end_at := new.start_at + make_interval(mins => t.duration_minutes);

  return new;
end;
$$;

-- Helper: mark arrived and reset counts in one call.
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
    raise exception 'reservation not found or line_user_id is null: %', p_reservation_id;
  end if;

  -- Mark reservation as arrived
  update public.reservations
  set arrived_at = now()
  where id = p_reservation_id;

  -- Physical delete customer_action_counters record
  delete from public.customer_action_counters
  where line_user_id = v_line_user_id;
end;
$$;

-- =========================================================
-- Triggers
-- =========================================================
drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_staff_updated_at on public.staff;
create trigger trg_staff_updated_at
before update on public.staff
for each row execute function public.set_updated_at();

drop trigger if exists trg_admin_allowed_ips_updated_at on public.admin_allowed_ips;
create trigger trg_admin_allowed_ips_updated_at
before update on public.admin_allowed_ips
for each row execute function public.set_updated_at();

drop trigger if exists trg_treatments_updated_at on public.treatments;
create trigger trg_treatments_updated_at
before update on public.treatments
for each row execute function public.set_updated_at();

drop trigger if exists trg_business_days_updated_at on public.business_days;
create trigger trg_business_days_updated_at
before update on public.business_days
for each row execute function public.set_updated_at();

drop trigger if exists trg_business_hours_overrides_updated_at on public.business_hours_overrides;
create trigger trg_business_hours_overrides_updated_at
before update on public.business_hours_overrides
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservations_apply_snapshot on public.reservations;
create trigger trg_reservations_apply_snapshot
before insert or update of treatment_id, start_at
on public.reservations
for each row execute function public.reservations_apply_treatment_snapshot();

drop trigger if exists trg_line_users_updated_at on public.line_users;
create trigger trg_line_users_updated_at
before update on public.line_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_customer_action_counters_updated_at on public.customer_action_counters;
create trigger trg_customer_action_counters_updated_at
before update on public.customer_action_counters
for each row execute function public.set_updated_at();

-- =========================================================
-- Row Level Security (RLS)
-- =========================================================

alter table public.app_settings enable row level security;
alter table public.staff enable row level security;
alter table public.admin_allowed_ips enable row level security;
alter table public.treatments enable row level security;
alter table public.business_days enable row level security;
alter table public.business_hours_overrides enable row level security;
alter table public.reservations enable row level security;
alter table public.customer_action_counters enable row level security;
alter table public.line_users enable row level security;

-- =========================================================
-- RLS Policies
-- =========================================================
-- Note: Edge Function uses service_role which bypasses RLS
-- These policies are for direct database access scenarios

-- RLS policies for admin_allowed_ips
-- Allow read access to check own IP/device
drop policy if exists "Allow read own IP record" on public.admin_allowed_ips;
create policy "Allow read own IP record"
  on public.admin_allowed_ips
  for select
  using (true); -- Edge Function will filter by IP/device

-- RLS policies for reservations
-- Staff can read all reservations
drop policy if exists "Allow staff to read reservations" on public.reservations;
create policy "Allow staff to read reservations"
  on public.reservations
  for select
  using (true); -- Edge Function will enforce role-based access
-- Enable RLS on all tables

-- Staff can insert reservations
drop policy if exists "Allow staff to insert reservations" on public.reservations;
create policy "Allow staff to insert reservations"
  on public.reservations
  for insert
  with check (true); -- Edge Function will enforce role-based access

-- Staff can update reservations
drop policy if exists "Allow staff to update reservations" on public.reservations;
create policy "Allow staff to update reservations"
  on public.reservations
  for update
  using (true)
  with check (true); -- Edge Function will enforce role-based access

-- Staff can delete reservations (logical delete)
drop policy if exists "Allow staff to delete reservations" on public.reservations;
create policy "Allow staff to delete reservations"
  on public.reservations
  for delete
  using (true); -- Edge Function will enforce role-based access

-- RLS policies for treatments (manager only)
-- Note: Edge Function enforces manager-only access
drop policy if exists "Allow read treatments" on public.treatments;
create policy "Allow read treatments"
  on public.treatments
  for select
  using (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow insert treatments" on public.treatments;
create policy "Allow insert treatments"
  on public.treatments
  for insert
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow update treatments" on public.treatments;
create policy "Allow update treatments"
  on public.treatments
  for update
  using (true)
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow delete treatments" on public.treatments;
create policy "Allow delete treatments"
  on public.treatments
  for delete
  using (true); -- Edge Function will enforce manager-only access

-- RLS policies for business_days (manager only)
drop policy if exists "Allow read business_days" on public.business_days;
create policy "Allow read business_days"
  on public.business_days
  for select
  using (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow insert business_days" on public.business_days;
create policy "Allow insert business_days"
  on public.business_days
  for insert
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow update business_days" on public.business_days;
create policy "Allow update business_days"
  on public.business_days
  for update
  using (true)
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow delete business_days" on public.business_days;
create policy "Allow delete business_days"
  on public.business_days
  for delete
  using (true); -- Edge Function will enforce manager-only access

-- RLS policies for business_hours_overrides (manager only)
drop policy if exists "Allow read business_hours_overrides" on public.business_hours_overrides;
create policy "Allow read business_hours_overrides"
  on public.business_hours_overrides
  for select
  using (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow insert business_hours_overrides" on public.business_hours_overrides;
create policy "Allow insert business_hours_overrides"
  on public.business_hours_overrides
  for insert
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow update business_hours_overrides" on public.business_hours_overrides;
create policy "Allow update business_hours_overrides"
  on public.business_hours_overrides
  for update
  using (true)
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow delete business_hours_overrides" on public.business_hours_overrides;
create policy "Allow delete business_hours_overrides"
  on public.business_hours_overrides
  for delete
  using (true); -- Edge Function will enforce manager-only access

-- RLS policies for app_settings (manager only)
drop policy if exists "Allow read app_settings" on public.app_settings;
create policy "Allow read app_settings"
  on public.app_settings
  for select
  using (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow insert app_settings" on public.app_settings;
create policy "Allow insert app_settings"
  on public.app_settings
  for insert
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow update app_settings" on public.app_settings;
create policy "Allow update app_settings"
  on public.app_settings
  for update
  using (true)
  with check (true); -- Edge Function will enforce manager-only access

-- RLS policies for customer_action_counters (staff and manager)
drop policy if exists "Allow insert customer_action_counters" on public.customer_action_counters;
create policy "Allow insert customer_action_counters"
  on public.customer_action_counters
  for insert
  with check (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow update customer_action_counters" on public.customer_action_counters;
create policy "Allow update customer_action_counters"
  on public.customer_action_counters
  for update
  using (true)
  with check (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow read customer_action_counters" on public.customer_action_counters;
create policy "Allow read customer_action_counters"
  on public.customer_action_counters
  for select
  using (true); -- Edge Function will enforce role-based access

-- RLS policies for staff
drop policy if exists "Allow read staff" on public.staff;
create policy "Allow read staff"
  on public.staff
  for select
  using (true); -- Edge Function will enforce role-based access

drop policy if exists "Allow insert staff" on public.staff;
create policy "Allow insert staff"
  on public.staff
  for insert
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow update staff" on public.staff;
create policy "Allow update staff"
  on public.staff
  for update
  using (true)
  with check (true); -- Edge Function will enforce manager-only access

drop policy if exists "Allow delete staff" on public.staff;
create policy "Allow delete staff"
  on public.staff
  for delete
  using (true); -- Edge Function will enforce manager-only access

-- RLS policies for line_users
-- Allow read access (for admin and staff)
drop policy if exists "Allow read line_users" on public.line_users;
create policy "Allow read line_users"
  on public.line_users
  for select
  using (true); -- Edge Function will enforce role-based access

-- Allow insert (for webhook)
drop policy if exists "Allow insert line_users" on public.line_users;
create policy "Allow insert line_users"
  on public.line_users
  for insert
  with check (true); -- Edge Function will enforce access

-- Allow update (for webhook and admin)
drop policy if exists "Allow update line_users" on public.line_users;
create policy "Allow update line_users"
  on public.line_users
  for update
  using (true)
  with check (true); -- Edge Function will enforce access

commit;

