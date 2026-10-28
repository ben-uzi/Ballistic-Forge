-- 0005 — Row-level security.
--
-- Default stance: every table has RLS enabled and no policy grants more than it
-- has to. User data is owner-only. Reference data is world-readable but
-- admin-writable. Aggregates stay invisible to non-admins until the reveal flag
-- is switched on — enforced here, not in the UI.

-- ── Helpers that depend on the tables above ──────────────────────────────────

/*
 * SECURITY DEFINER on purpose: the function runs as its owner, which bypasses
 * row-level security on `profiles`. Without that, a policy on `profiles` that
 * calls this function would recurse into itself. search_path is pinned so
 * definer rights cannot be redirected at a shadowed table.
 */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the calling user has the admin role. SECURITY DEFINER to avoid RLS recursion on profiles.';

create or replace function public.field_data_is_public()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.app_flags where key = 'field_data_public'),
    false
  );
$$;

comment on function public.field_data_is_public() is
  'Reads the field_data_public flag. Aggregates stay invisible to non-admins until it is true.';

-- ── Enable RLS everywhere ────────────────────────────────────────────────────

alter table public.manufacturers enable row level security;
alter table public.cartridges enable row level security;
alter table public.bullets enable row level security;
alter table public.factory_loads enable row level security;
alter table public.suppressors enable row level security;

alter table public.profiles enable row level security;
alter table public.rifles enable row level security;
alter table public.loads enable row level security;
alter table public.rifle_suppressors enable row level security;
alter table public.sessions enable row level security;
alter table public.shot_strings enable row level security;
alter table public.drop_observations enable row level security;
alter table public.poi_shift_observations enable row level security;
alter table public.entitlements enable row level security;
alter table public.events enable row level security;

alter table public.field_aggregates enable row level security;
alter table public.suppressor_deltas enable row level security;
alter table public.app_flags enable row level security;
alter table public.waitlist enable row level security;
alter table public.feedback enable row level security;
alter table public.corrections enable row level security;

-- ── Reference data: public read, admin write ─────────────────────────────────

create policy manufacturers_read on public.manufacturers
  for select to anon, authenticated using (true);
create policy manufacturers_write on public.manufacturers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cartridges_read on public.cartridges
  for select to anon, authenticated using (true);
create policy cartridges_write on public.cartridges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy bullets_read on public.bullets
  for select to anon, authenticated using (true);
create policy bullets_write on public.bullets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy factory_loads_read on public.factory_loads
  for select to anon, authenticated using (true);
create policy factory_loads_write on public.factory_loads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy suppressors_read on public.suppressors
  for select to anon, authenticated using (true);
create policy suppressors_write on public.suppressors
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Profiles ─────────────────────────────────────────────────────────────────

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));

-- A user may edit their own profile but not promote themselves: the role and
-- flagged columns are locked down by the trigger below.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() is null only when there is no end-user session: a migration, the
  -- SQL editor, or the service role. RLS already keeps anon off this table, so
  -- that case is a trusted server context and is allowed through.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change a profile role';
    end if;
    if new.flagged is distinct from old.flagged then
      raise exception 'Only an admin can flag an account';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ── Owner-only user data ─────────────────────────────────────────────────────
--
-- `(select auth.uid())` rather than a bare call: the planner evaluates it once
-- per statement instead of once per row.

create policy rifles_owner on public.rifles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy loads_owner on public.loads
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy rifle_suppressors_owner on public.rifle_suppressors
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sessions_owner on public.sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy shot_strings_owner on public.shot_strings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy drop_observations_owner on public.drop_observations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy poi_shift_observations_owner on public.poi_shift_observations
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Admins can read user data for the flagged-session review queue, but never write it.
create policy sessions_admin_read on public.sessions
  for select to authenticated using (public.is_admin());
create policy shot_strings_admin_read on public.shot_strings
  for select to authenticated using (public.is_admin());
create policy drop_observations_admin_read on public.drop_observations
  for select to authenticated using (public.is_admin());
create policy poi_shift_admin_read on public.poi_shift_observations
  for select to authenticated using (public.is_admin());

-- ── Entitlements: readable by the owner, written only by the service role ────

create policy entitlements_select_own on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- ── Events: write-only for clients ───────────────────────────────────────────

create policy events_insert on public.events
  for insert to anon, authenticated with check (true);
create policy events_admin_read on public.events
  for select to authenticated using (public.is_admin());

-- ── Aggregates: gated by the reveal flag ─────────────────────────────────────

create policy field_aggregates_read on public.field_aggregates
  for select to anon, authenticated
  using (public.field_data_is_public() or public.is_admin());

create policy suppressor_deltas_read on public.suppressor_deltas
  for select to anon, authenticated
  using (public.field_data_is_public() or public.is_admin());

-- ── Flags: world-readable, admin-writable ────────────────────────────────────

create policy app_flags_read on public.app_flags
  for select to anon, authenticated using (true);
create policy app_flags_write on public.app_flags
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Waitlist: anyone may sign up, only admins may read the list ──────────────

create policy waitlist_insert on public.waitlist
  for insert to anon, authenticated with check (true);
create policy waitlist_admin_read on public.waitlist
  for select to authenticated using (public.is_admin());

-- ── Feedback and corrections ─────────────────────────────────────────────────

create policy feedback_insert on public.feedback
  for insert to anon, authenticated with check (true);
create policy feedback_select_own on public.feedback
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

create policy corrections_insert on public.corrections
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy corrections_select_own on public.corrections
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy corrections_admin_update on public.corrections
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Grants ───────────────────────────────────────────────────────────────────
--
-- Supabase sets sensible defaults, but being explicit keeps the intent in the
-- migration. RLS still decides which rows these roles actually see.

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on
  public.rifles,
  public.loads,
  public.rifle_suppressors,
  public.sessions,
  public.shot_strings,
  public.drop_observations,
  public.poi_shift_observations,
  public.profiles
to authenticated;
grant insert on public.events, public.waitlist, public.feedback to anon, authenticated;
grant insert on public.corrections to authenticated;
grant update on public.corrections, public.app_flags to authenticated;
grant insert, update, delete on
  public.manufacturers,
  public.cartridges,
  public.bullets,
  public.factory_loads,
  public.suppressors
to authenticated;
