-- =============================================================================
-- Migration: 20240101000000_initial_schema.sql
-- Description: Create all enums, tables, indexes, and constraints for Bakyard
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

-- =============================================================================
-- ENUMS
-- =============================================================================

create type skill_level as enum (
  'beginner',
  'intermediate',
  'advanced',
  'pro'
);

create type user_role as enum (
  'player',
  'coach',
  'admin'
);

create type product_type as enum (
  'court_rental',
  'open_play',
  'coaching',
  'clinic',
  'tournament',
  'community_day',
  'food_addon'
);

create type session_status as enum (
  'open',
  'full',
  'in_progress',
  'completed',
  'cancelled'
);

create type booking_status as enum (
  'reserved',
  'confirmed',
  'cancelled',
  'no_show'
);

create type order_status as enum (
  'pending',
  'paid',
  'refunded',
  'failed'
);

create type membership_tier as enum (
  'local_player',
  'sand_regular',
  'founders'
);

create type membership_status as enum (
  'active',
  'past_due',
  'cancelled'
);

create type interaction_type as enum (
  'view',
  'tap',
  'book',
  'dismiss'
);

create type pricing_rule_type as enum (
  'peak',
  'off_peak',
  'weekend',
  'holiday',
  'surge'
);

create type notification_type as enum (
  'booking_confirm',
  'payment_reminder',
  'session_update',
  'membership',
  'promo'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table users (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  skill_level skill_level,
  role        user_role   not null default 'player',
  stripe_customer_id text,
  push_token  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table users is 'Application-level user profile, linked 1-to-1 with auth.users.';

-- ---------------------------------------------------------------------------
-- courts
-- ---------------------------------------------------------------------------
create table courts (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  surface_type  text not null default 'sand',
  is_available  boolean not null default true,
  sort_order    int
);

comment on table courts is 'Physical courts available for booking.';

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table products (
  id                uuid primary key default uuid_generate_v4(),
  type              product_type not null,
  title             text not null,
  description       text,
  image_url         text,
  base_price_cents  int,
  capacity          int,
  duration_minutes  int,
  tags              text[],
  coach_id          uuid references users (id) on delete set null,
  is_recurring      boolean not null default false,
  recurrence_rule   jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table products is 'Catalog of bookable products / experiences.';

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table sessions (
  id               uuid primary key default uuid_generate_v4(),
  product_id       uuid not null references products (id) on delete cascade,
  court_id         uuid references courts (id) on delete set null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  price_cents      int not null,
  spots_total      int not null,
  spots_remaining  int not null,
  status           session_status not null default 'open',
  weather_snapshot jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Prevent overlapping bookings on the same court
  constraint sessions_no_court_overlap
    exclude using gist (
      court_id with =,
      tstzrange(starts_at, ends_at) with &&
    )
);

comment on table sessions is 'Concrete time-slot instances of a product.';

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table bookings (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references sessions (id) on delete cascade,
  user_id       uuid not null references users (id) on delete cascade,
  status        booking_status not null default 'reserved',
  reserved_at   timestamptz not null default now(),
  confirmed_at  timestamptz,
  cancelled_at  timestamptz,
  guests        int not null default 0,

  constraint bookings_unique_user_session unique (session_id, user_id)
);

comment on table bookings is 'A user''s reservation / booking for a session.';

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create table memberships (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references users (id) on delete cascade,
  tier                    membership_tier not null,
  stripe_subscription_id  text,
  status                  membership_status not null default 'active',
  discount_percent        int not null,
  priority_booking_hours  int not null,
  guest_passes_remaining  int not null,
  current_period_start    timestamptz not null,
  current_period_end      timestamptz not null,
  created_at              timestamptz not null default now()
);

comment on table memberships is 'Recurring membership subscriptions.';

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table orders (
  id                        uuid primary key default uuid_generate_v4(),
  booking_id                uuid not null references bookings (id) on delete cascade,
  user_id                   uuid not null references users (id) on delete cascade,
  amount_cents              int not null,
  discount_cents            int not null default 0,
  membership_id             uuid references memberships (id) on delete set null,
  stripe_payment_intent_id  text,
  status                    order_status not null default 'pending',
  is_split                  boolean not null default false,
  split_group_id            uuid,
  created_at                timestamptz not null default now()
);

comment on table orders is 'Payment records tied to bookings.';

-- ---------------------------------------------------------------------------
-- coach_profiles
-- ---------------------------------------------------------------------------
create table coach_profiles (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users (id) on delete cascade,
  bio                   text,
  certifications        text[],
  hourly_rate_cents     int,
  revenue_share_percent int,
  rating                numeric,
  is_active             boolean not null default true,

  constraint coach_profiles_user_unique unique (user_id)
);

comment on table coach_profiles is 'Extended profile for coaches.';

-- ---------------------------------------------------------------------------
-- session_chat_messages
-- ---------------------------------------------------------------------------
create table session_chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  message     text not null,
  created_at  timestamptz not null default now()
);

comment on table session_chat_messages is 'In-session chat messages visible to participants.';

-- ---------------------------------------------------------------------------
-- feed_interactions
-- ---------------------------------------------------------------------------
create table feed_interactions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references users (id) on delete cascade,
  product_id       uuid not null references products (id) on delete cascade,
  interaction_type interaction_type not null,
  created_at       timestamptz not null default now()
);

comment on table feed_interactions is 'Tracks user interactions with the product feed for personalisation.';

-- ---------------------------------------------------------------------------
-- pricing_rules
-- ---------------------------------------------------------------------------
create table pricing_rules (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  rule_type     pricing_rule_type not null,
  multiplier    numeric not null,
  days_of_week  int[],
  start_time    time,
  end_time      time,
  is_active     boolean not null default true
);

comment on table pricing_rules is 'Dynamic pricing rules applied to session prices.';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users (id) on delete cascade,
  title       text not null,
  body        text not null,
  type        notification_type not null,
  data        jsonb,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table notifications is 'Push / in-app notification log.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Sessions: look up by product, by time range, by status
create index idx_sessions_product_id on sessions (product_id);
create index idx_sessions_starts_at  on sessions (starts_at);
create index idx_sessions_status     on sessions (status);

-- Bookings: look up by user, by session
create index idx_bookings_user_id    on bookings (user_id);
create index idx_bookings_session_id on bookings (session_id);

-- Orders: look up by user, by booking
create index idx_orders_user_id    on orders (user_id);
create index idx_orders_booking_id on orders (booking_id);

-- Memberships: look up by user
create index idx_memberships_user_id on memberships (user_id);

-- Session chat: look up by session
create index idx_session_chat_session_id on session_chat_messages (session_id);

-- Feed interactions: look up by user + product
create index idx_feed_interactions_user_id    on feed_interactions (user_id);
create index idx_feed_interactions_product_id on feed_interactions (product_id);

-- Notifications: look up by user, unread
create index idx_notifications_user_id on notifications (user_id);
create index idx_notifications_unread  on notifications (user_id) where is_read = false;

-- updated_at helper for auto-touch
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger trg_sessions_updated_at
  before update on sessions
  for each row execute function set_updated_at();
