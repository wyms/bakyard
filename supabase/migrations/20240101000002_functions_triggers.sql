-- =============================================================================
-- Migration: 20240101000002_functions_triggers.sql
-- Description: Transactional booking function, spot-management triggers,
--              order-to-booking sync trigger, and feed interaction logging.
-- =============================================================================

-- =============================================================================
-- book_session() - Atomic booking with row-level locking
-- =============================================================================

create or replace function book_session(
  p_session_id uuid,
  p_user_id    uuid,
  p_guests     int default 0
)
returns bookings
language plpgsql
security definer
as $$
declare
  v_session   sessions;
  v_booking   bookings;
  v_needed    int;
begin
  v_needed := 1 + p_guests;

  -- Lock the session row to prevent race conditions
  select *
    into v_session
    from sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'Session % not found', p_session_id;
  end if;

  if v_session.status <> 'open' then
    raise exception 'Session % is not open for booking (status: %)',
      p_session_id, v_session.status;
  end if;

  if v_session.spots_remaining < v_needed then
    raise exception 'Not enough spots remaining. Needed: %, available: %',
      v_needed, v_session.spots_remaining;
  end if;

  -- Decrement spots
  update sessions
     set spots_remaining = spots_remaining - v_needed
   where id = p_session_id;

  -- Mark session as full if no spots left
  if v_session.spots_remaining - v_needed = 0 then
    update sessions
       set status = 'full'
     where id = p_session_id;
  end if;

  -- Insert the booking
  insert into bookings (session_id, user_id, status, guests)
  values (p_session_id, p_user_id, 'reserved', p_guests)
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function book_session is
  'Atomically reserves a spot (+ optional guests) in a session with row-level locking.';

-- =============================================================================
-- TRIGGER: Safety decrement on booking insert
-- =============================================================================
-- book_session() already handles decrementing, but if a booking is inserted
-- through another path (e.g. admin insert), this trigger provides a safety net.
-- It is skipped when spots_remaining was already decremented in the same
-- transaction by book_session() by checking a session-level advisory lock.

create or replace function trg_booking_inserted()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only act on new bookings with status 'reserved'
  if new.status = 'reserved' then
    -- Try to acquire a transaction-level advisory lock keyed on the session.
    -- book_session() acquires the same lock, so if it's already held we skip.
    if pg_try_advisory_xact_lock(hashtext(new.session_id::text)) then
      update sessions
         set spots_remaining = spots_remaining - (1 + new.guests)
       where id = new.session_id
         and spots_remaining >= (1 + new.guests);

      if not found then
        raise exception 'Not enough spots remaining for session %', new.session_id;
      end if;

      -- Mark full if needed
      update sessions
         set status = 'full'
       where id = new.session_id
         and spots_remaining = 0
         and status = 'open';
    end if;
    -- If the lock was already held (book_session path), do nothing --
    -- book_session already decremented spots.
  end if;

  return new;
end;
$$;

create trigger trg_after_booking_insert
  after insert on bookings
  for each row
  execute function trg_booking_inserted();

-- =============================================================================
-- TRIGGER: Increment spots_remaining when booking is cancelled
-- =============================================================================

create or replace function trg_booking_cancelled()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    update sessions
       set spots_remaining = spots_remaining + (1 + old.guests),
           status = case
                      when status = 'full' then 'open'
                      else status
                    end
     where id = new.session_id;

    -- Record cancellation timestamp
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

create trigger trg_after_booking_cancel
  before update on bookings
  for each row
  execute function trg_booking_cancelled();

-- =============================================================================
-- TRIGGER: Order paid -> Booking confirmed
-- =============================================================================

create or replace function trg_order_paid()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.status <> 'paid' and new.status = 'paid' then
    update bookings
       set status       = 'confirmed',
           confirmed_at = now()
     where id = new.booking_id
       and status <> 'confirmed';
  end if;

  return new;
end;
$$;

create trigger trg_after_order_status_change
  after update of status on orders
  for each row
  execute function trg_order_paid();

-- =============================================================================
-- TRIGGER: Log feed interaction on booking
-- =============================================================================
-- When a booking is inserted, automatically log a 'book' interaction for the
-- associated product so the recommendation engine can learn from it.

create or replace function trg_log_feed_interaction_on_booking()
returns trigger
language plpgsql
security definer
as $$
declare
  v_product_id uuid;
begin
  select product_id
    into v_product_id
    from sessions
   where id = new.session_id;

  if v_product_id is not null then
    insert into feed_interactions (user_id, product_id, interaction_type)
    values (new.user_id, v_product_id, 'book')
    on conflict do nothing;  -- idempotent
  end if;

  return new;
end;
$$;

create trigger trg_after_booking_log_interaction
  after insert on bookings
  for each row
  execute function trg_log_feed_interaction_on_booking();

-- =============================================================================
-- Update book_session to acquire advisory lock so the safety trigger skips
-- =============================================================================
-- We replace the original book_session to acquire the advisory lock before
-- inserting the booking, ensuring the safety trigger does not double-decrement.

create or replace function book_session(
  p_session_id uuid,
  p_user_id    uuid,
  p_guests     int default 0
)
returns bookings
language plpgsql
security definer
as $$
declare
  v_session   sessions;
  v_booking   bookings;
  v_needed    int;
begin
  v_needed := 1 + p_guests;

  -- Acquire advisory lock so the safety insert trigger knows to skip
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  -- Lock the session row to prevent race conditions
  select *
    into v_session
    from sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'Session % not found', p_session_id;
  end if;

  if v_session.status <> 'open' then
    raise exception 'Session % is not open for booking (status: %)',
      p_session_id, v_session.status;
  end if;

  if v_session.spots_remaining < v_needed then
    raise exception 'Not enough spots remaining. Needed: %, available: %',
      v_needed, v_session.spots_remaining;
  end if;

  -- Decrement spots
  update sessions
     set spots_remaining = spots_remaining - v_needed,
         status = case
                    when spots_remaining - v_needed = 0 then 'full'::session_status
                    else status
                  end
   where id = p_session_id;

  -- Insert the booking
  insert into bookings (session_id, user_id, status, guests)
  values (p_session_id, p_user_id, 'reserved', p_guests)
  returning * into v_booking;

  return v_booking;
end;
$$;
