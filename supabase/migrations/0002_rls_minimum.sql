-- Minimal RLS baseline (deny-by-default for admin tables)
-- NOTE:
-- - Supabase service_role bypasses RLS (server-side only)
-- - Customer / admin access policies will be added when auth flow is implemented

begin;

-- Enable RLS (no policies -> deny by default)
alter table public.app_settings enable row level security;
alter table public.admin_allowed_ips enable row level security;
alter table public.admin_access_logs enable row level security;

-- (Optional) enable on other tables later:
-- alter table public.treatments enable row level security;
-- alter table public.business_days enable row level security;
-- alter table public.business_hours_overrides enable row level security;
-- alter table public.reservations enable row level security;

commit;


