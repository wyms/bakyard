-- =============================================================================
-- Migration: 20240101000001_rls_policies.sql
-- Description: Enable RLS on all tables, create helper functions, and define
--              row-level security policies for Bakyard.
-- =============================================================================

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

alter table users                 enable row level security;
alter table courts                enable row level security;
alter table products              enable row level security;
alter table sessions              enable row level security;
alter table bookings              enable row level security;
alter table orders                enable row level security;
alter table memberships           enable row level security;
alter table coach_profiles        enable row level security;
alter table session_chat_messages enable row level security;
alter table feed_interactions     enable row level security;
alter table pricing_rules         enable row level security;
alter table notifications         enable row level security;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check whether the current authenticated user has the admin role.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from users
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Check whether the current authenticated user has the coach role.
create or replace function is_coach()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from users
    where id = auth.uid()
      and role = 'coach'
  );
$$;

-- Check whether the current authenticated user has a non-cancelled booking
-- for the given session, making them a participant.
create or replace function is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from bookings
    where session_id = p_session_id
      and user_id = auth.uid()
      and status <> 'cancelled'
  );
$$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- Any authenticated user can read user profiles (public fields).
create policy "users: read all profiles"
  on users for select
  to authenticated
  using (true);

-- Users can only update their own row.
create policy "users: update own"
  on users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users can insert their own profile row (sign-up).
create policy "users: insert own"
  on users for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- courts
-- ---------------------------------------------------------------------------

-- All authenticated users can read courts.
create policy "courts: read all"
  on courts for select
  to authenticated
  using (true);

-- Only admins can insert courts.
create policy "courts: admin insert"
  on courts for insert
  to authenticated
  with check (is_admin());

-- Only admins can update courts.
create policy "courts: admin update"
  on courts for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Only admins can delete courts.
create policy "courts: admin delete"
  on courts for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

-- All authenticated users can read active products.
create policy "products: read all"
  on products for select
  to authenticated
  using (true);

-- Admins can insert products.
create policy "products: admin insert"
  on products for insert
  to authenticated
  with check (is_admin());

-- Admins can update any product; coaches can update products they own.
create policy "products: admin or coach owner update"
  on products for update
  to authenticated
  using (is_admin() or (is_coach() and coach_id = auth.uid()))
  with check (is_admin() or (is_coach() and coach_id = auth.uid()));

-- Admins can delete products.
create policy "products: admin delete"
  on products for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------

-- All authenticated users can read sessions.
create policy "sessions: read all"
  on sessions for select
  to authenticated
  using (true);

-- Admins can insert sessions.
create policy "sessions: admin insert"
  on sessions for insert
  to authenticated
  with check (is_admin());

-- Admins or the owning coach can update sessions.
create policy "sessions: admin or coach owner update"
  on sessions for update
  to authenticated
  using (
    is_admin()
    or exists (
      select 1
      from products p
      where p.id = product_id
        and p.coach_id = auth.uid()
        and is_coach()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1
      from products p
      where p.id = product_id
        and p.coach_id = auth.uid()
        and is_coach()
    )
  );

-- Admins can delete sessions.
create policy "sessions: admin delete"
  on sessions for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

-- Users can read their own bookings; admins can read all.
create policy "bookings: read own or admin"
  on bookings for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Users can create bookings for themselves.
create policy "bookings: insert own"
  on bookings for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update their own bookings (e.g. cancel); admins can update any.
create policy "bookings: update own or admin"
  on bookings for update
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

-- Users can read their own orders; admins can read all.
create policy "orders: read own or admin"
  on orders for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Users can insert orders for themselves.
create policy "orders: insert own"
  on orders for insert
  to authenticated
  with check (user_id = auth.uid());

-- Admins can update orders (e.g. mark refunded).
create policy "orders: admin update"
  on orders for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------

-- Users can read their own membership; admins can read all.
create policy "memberships: read own or admin"
  on memberships for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Admins can insert memberships.
create policy "memberships: admin insert"
  on memberships for insert
  to authenticated
  with check (is_admin());

-- Admins can update memberships.
create policy "memberships: admin update"
  on memberships for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Admins can delete memberships.
create policy "memberships: admin delete"
  on memberships for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- coach_profiles
-- ---------------------------------------------------------------------------

-- All authenticated users can read coach profiles.
create policy "coach_profiles: read all"
  on coach_profiles for select
  to authenticated
  using (true);

-- Coaches can insert their own profile.
create policy "coach_profiles: insert own"
  on coach_profiles for insert
  to authenticated
  with check (user_id = auth.uid() and is_coach());

-- Coaches can update their own profile.
create policy "coach_profiles: update own"
  on coach_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session_chat_messages
-- ---------------------------------------------------------------------------

-- Participants of a session can read messages for that session.
create policy "session_chat: read if participant"
  on session_chat_messages for select
  to authenticated
  using (is_session_participant(session_id));

-- Participants of a session can send messages.
create policy "session_chat: insert if participant"
  on session_chat_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_session_participant(session_id)
  );

-- ---------------------------------------------------------------------------
-- feed_interactions
-- ---------------------------------------------------------------------------

-- Users can read their own interactions.
create policy "feed_interactions: read own"
  on feed_interactions for select
  to authenticated
  using (user_id = auth.uid());

-- Users can create their own interactions.
create policy "feed_interactions: insert own"
  on feed_interactions for insert
  to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- pricing_rules
-- ---------------------------------------------------------------------------

-- All authenticated users can read pricing rules.
create policy "pricing_rules: read all"
  on pricing_rules for select
  to authenticated
  using (true);

-- Only admins can insert pricing rules.
create policy "pricing_rules: admin insert"
  on pricing_rules for insert
  to authenticated
  with check (is_admin());

-- Only admins can update pricing rules.
create policy "pricing_rules: admin update"
  on pricing_rules for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Only admins can delete pricing rules.
create policy "pricing_rules: admin delete"
  on pricing_rules for delete
  to authenticated
  using (is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

-- Users can read their own notifications.
create policy "notifications: read own"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Users can update their own notifications (mark as read).
create policy "notifications: update own"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can create notifications for any user.
create policy "notifications: admin insert"
  on notifications for insert
  to authenticated
  with check (is_admin());
