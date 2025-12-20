-- Initial schema for shopSmsReserv
-- Assumptions:
-- - Single shop
-- - Reservations are soft-deleted via deleted_at
-- - Admin access is IP allowlist based (whitelist)

begin;

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- Enums (as text + check for portability)

-- =========================================================
-- App settings (singleton-ish)
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
  default_lunch_end time,

  -- access logging
  admin_access_log_enabled boolean not null default true
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- Admin: IP allowlist (add = allow, remove = deny)
-- Keep deleted history by soft-delete.
-- =========================================================
create table if not exists public.admin_allowed_ips (
  ip text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_admin_allowed_ips_updated_at on public.admin_allowed_ips;
create trigger trg_admin_allowed_ips_updated_at
before update on public.admin_allowed_ips
for each row execute function public.set_updated_at();

-- Access logs (admin)
create table if not exists public.admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip text not null,
  result text not null check (result in ('allowed','denied')),
  path text not null default '/',
  user_agent text,
  note text
);

create index if not exists idx_admin_access_logs_created_at on public.admin_access_logs (created_at desc);
create index if not exists idx_admin_access_logs_ip on public.admin_access_logs (ip);
create index if not exists idx_admin_access_logs_result on public.admin_access_logs (result);

-- =========================================================
-- Treatments (施術メニュー)
-- =========================================================
create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  name text not null,
  description text not null default '',
  duration_minutes int not null check (duration_minutes between 1 and 24*60),
  price_yen int not null check (price_yen >= 0),

  sort_order int not null default 0
);

drop trigger if exists trg_treatments_updated_at on public.treatments;
create trigger trg_treatments_updated_at
before update on public.treatments
for each row execute function public.set_updated_at();

create index if not exists idx_treatments_active on public.treatments (deleted_at);

-- =========================================================
-- Business day settings (per specific date)
-- - If no row exists -> "unset"
-- =========================================================
create table if not exists public.business_days (
  day date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null check (status in ('open','holiday','closed'))
);

drop trigger if exists trg_business_days_updated_at on public.business_days;
create trigger trg_business_days_updated_at
before update on public.business_days
for each row execute function public.set_updated_at();

-- Business hour overrides (per specific date)
create table if not exists public.business_hours_overrides (
  day date primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  open_time time not null,
  close_time time not null,

  lunch_enabled boolean not null default false,
  lunch_start time,
  lunch_end time
);

drop trigger if exists trg_business_hours_overrides_updated_at on public.business_hours_overrides;
create trigger trg_business_hours_overrides_updated_at
before update on public.business_hours_overrides
for each row execute function public.set_updated_at();

-- =========================================================
-- Reservations
-- =========================================================
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- customer identity
  customer_name text not null,
  phone_e164 text not null,
  phone_last4 text generated always as (right(phone_e164, 4)) stored,

  -- menu
  treatment_id uuid references public.treatments (id),
  treatment_name_snapshot text not null default '',
  treatment_duration_minutes_snapshot int not null default 0,
  treatment_price_yen_snapshot int not null default 0,

  -- schedule
  start_at timestamptz not null,
  end_at timestamptz not null,

  via text not null default 'web' check (via in ('web','phone','admin'))
);

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

create index if not exists idx_reservations_start_at on public.reservations (start_at);
create index if not exists idx_reservations_phone on public.reservations (phone_e164);
create index if not exists idx_reservations_deleted_at on public.reservations (deleted_at);

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
  where id = new.treatment_id and deleted_at is null;

  if not found then
    raise exception 'treatment_id not found or deleted: %', new.treatment_id;
  end if;

  new.treatment_name_snapshot := t.name;
  new.treatment_duration_minutes_snapshot := t.duration_minutes;
  new.treatment_price_yen_snapshot := t.price_yen;
  new.end_at := new.start_at + make_interval(mins => t.duration_minutes);

  return new;
end;
$$;

drop trigger if exists trg_reservations_apply_snapshot on public.reservations;
create trigger trg_reservations_apply_snapshot
before insert or update of treatment_id, start_at
on public.reservations
for each row execute function public.reservations_apply_treatment_snapshot();

commit;


