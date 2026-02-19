-- =============================================================================
-- Migration: 20240101000003_cron_jobs.sql
-- Description: pg_cron scheduled jobs for reservation expiry, weather sync,
--              and session completion.
-- =============================================================================

-- Enable the pg_cron extension (available on Supabase by default)
create extension if not exists pg_cron;

-- Grant usage so pg_cron can execute functions in our schema
grant usage on schema public to postgres;

-- =============================================================================
-- 1. Release expired reservations (every 5 minutes)
-- =============================================================================
-- Bookings in 'reserved' status that were not confirmed within 10 minutes
-- are automatically cancelled, freeing the spots back up.

create or replace function release_expired_reservations()
returns void
language plpgsql
security definer
as $$
begin
  update bookings
     set status       = 'cancelled',
         cancelled_at = now()
   where status = 'reserved'
     and reserved_at < now() - interval '10 minutes';
  -- The trg_after_booking_cancel trigger will increment spots_remaining
  -- for each cancelled booking automatically.
end;
$$;

select cron.schedule(
  'release-expired-reservations',   -- job name
  '*/5 * * * *',                    -- every 5 minutes
  $$select release_expired_reservations()$$
);

-- =============================================================================
-- 2. Sync weather snapshots (every 30 minutes)
-- =============================================================================
-- Placeholder function: the actual weather API call is handled by an Edge
-- Function invoked via pg_net or a separate service.  This cron job triggers
-- the Edge Function endpoint.

create or replace function sync_weather_snapshots()
returns void
language plpgsql
security definer
as $$
begin
  -- Update sessions happening in the next 24 hours with a placeholder.
  -- In production, replace this with a call to the weather Edge Function
  -- via pg_net: select net.http_post(url, ...).
  --
  -- For now we mark the weather_snapshot as stale so the Edge Function
  -- knows which rows to refresh.
  update sessions
     set weather_snapshot = coalesce(weather_snapshot, '{}'::jsonb)
           || jsonb_build_object('_refresh_requested_at', now())
   where starts_at between now() and now() + interval '24 hours'
     and status in ('open', 'full');
end;
$$;

select cron.schedule(
  'sync-weather-snapshots',          -- job name
  '*/30 * * * *',                    -- every 30 minutes
  $$select sync_weather_snapshots()$$
);

-- =============================================================================
-- 3. Complete past sessions (daily at midnight UTC)
-- =============================================================================
-- Sessions whose end time has passed and are still marked 'open', 'full', or
-- 'in_progress' are transitioned to 'completed'.

create or replace function complete_past_sessions()
returns void
language plpgsql
security definer
as $$
begin
  update sessions
     set status = 'completed'
   where ends_at < now()
     and status in ('open', 'full', 'in_progress');
end;
$$;

select cron.schedule(
  'complete-past-sessions',          -- job name
  '0 0 * * *',                       -- daily at midnight UTC
  $$select complete_past_sessions()$$
);
