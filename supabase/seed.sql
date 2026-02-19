-- =============================================================================
-- Seed: supabase/seed.sql
-- Description: Development seed data for Bakyard
-- Run with: supabase db reset  (applies migrations then this file)
-- =============================================================================

-- =============================================================================
-- COURTS
-- =============================================================================

insert into courts (id, name, surface_type, is_available, sort_order) values
  (gen_random_uuid(), 'Court 1', 'sand', true,  1),
  (gen_random_uuid(), 'Court 2', 'sand', true,  2),
  (gen_random_uuid(), 'Court 3', 'sand', true,  3),
  (gen_random_uuid(), 'Court 4', 'sand', false, 4);   -- maintenance

-- Capture court IDs for session inserts
-- (We select by sort_order so the rest of the seed is deterministic.)
do $$
declare
  court1_id uuid;
  court2_id uuid;
  court3_id uuid;
  court4_id uuid;

  prod_court_rental  uuid;
  prod_open_play     uuid;
  prod_beginner      uuid;
  prod_competitive   uuid;
  prod_coaching      uuid;
  prod_kids_camp     uuid;
  prod_tournament    uuid;
  prod_community     uuid;
  prod_smoothie      uuid;

  base_date date := current_date;
begin

-- =============================================================================
-- Look up courts
-- =============================================================================

select id into court1_id from courts where sort_order = 1;
select id into court2_id from courts where sort_order = 2;
select id into court3_id from courts where sort_order = 3;
select id into court4_id from courts where sort_order = 4;

-- =============================================================================
-- PRODUCTS
-- =============================================================================

insert into products (id, type, title, description, image_url, base_price_cents, capacity, duration_minutes, tags, is_recurring, is_active)
values
  (gen_random_uuid(), 'court_rental',  'Court Rental',           'Reserve a court for your group.',                              'https://placehold.co/600x400?text=Court+Rental',       4000, null, 60,  '{all-levels}',               false, true),
  (gen_random_uuid(), 'open_play',     'Open Play',              'Drop in and play with whoever shows up.',                      'https://placehold.co/600x400?text=Open+Play',          1500, 16,   90,  '{all-levels,social}',        false, true),
  (gen_random_uuid(), 'clinic',        'Beginner Clinic',        'Learn the basics from our certified coaches.',                 'https://placehold.co/600x400?text=Beginner+Clinic',    2500, 12,   90,  '{beginner,instruction}',     false, true),
  (gen_random_uuid(), 'open_play',     'Competitive Open Play',  'Higher-level open play for experienced players.',              'https://placehold.co/600x400?text=Competitive+Play',   2000, 12,   120, '{advanced,competitive}',     false, true),
  (gen_random_uuid(), 'coaching',      'Private Coaching',       'One-on-one or small group coaching session.',                  'https://placehold.co/600x400?text=Private+Coaching',   8000, 4,    60,  '{all-levels,private}',       false, true),
  (gen_random_uuid(), 'clinic',        'Kids Camp',              'Fun-focused introduction to the sport for kids ages 6-12.',    'https://placehold.co/600x400?text=Kids+Camp',          3000, 16,   120, '{kids,beginner}',            false, true),
  (gen_random_uuid(), 'tournament',    'Weekend Tournament',     'Bring your A-game. Brackets posted Friday evening.',           'https://placehold.co/600x400?text=Weekend+Tournament', 5000, 32,   240, '{competitive,tournament}',   true,  true),
  (gen_random_uuid(), 'community_day', 'Community Day',          'Free community event -- come meet your neighbors on the sand.','https://placehold.co/600x400?text=Community+Day',         0, 50,   180, '{all-levels,social,free}',   false, true),
  (gen_random_uuid(), 'food_addon',    'Smoothie Bowl Add-on',   'Fresh acai smoothie bowl, made on-site.',                      'https://placehold.co/600x400?text=Smoothie+Bowl',      1200, null, 0,   '{food}',                     false, true);

-- Look up product IDs
select id into prod_court_rental from products where title = 'Court Rental';
select id into prod_open_play     from products where title = 'Open Play';
select id into prod_beginner      from products where title = 'Beginner Clinic';
select id into prod_competitive   from products where title = 'Competitive Open Play';
select id into prod_coaching      from products where title = 'Private Coaching';
select id into prod_kids_camp     from products where title = 'Kids Camp';
select id into prod_tournament    from products where title = 'Weekend Tournament';
select id into prod_community     from products where title = 'Community Day';
select id into prod_smoothie      from products where title = 'Smoothie Bowl Add-on';

-- =============================================================================
-- SESSIONS  (next 7 days, 2-3 per product, spread across courts)
-- =============================================================================

-- Court Rental -- 3 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_court_rental, court1_id,
    (base_date + 1) + time '09:00', (base_date + 1) + time '10:00', 4000, 1, 1, 'open'),
  (gen_random_uuid(), prod_court_rental, court2_id,
    (base_date + 2) + time '14:00', (base_date + 2) + time '15:00', 4000, 1, 1, 'open'),
  (gen_random_uuid(), prod_court_rental, court3_id,
    (base_date + 4) + time '18:00', (base_date + 4) + time '19:00', 6000, 1, 1, 'open');  -- peak pricing applied

-- Open Play -- 3 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_open_play, court1_id,
    (base_date + 1) + time '11:00', (base_date + 1) + time '12:30', 1500, 16, 16, 'open'),
  (gen_random_uuid(), prod_open_play, court2_id,
    (base_date + 3) + time '11:00', (base_date + 3) + time '12:30', 1500, 16, 16, 'open'),
  (gen_random_uuid(), prod_open_play, court3_id,
    (base_date + 5) + time '17:00', (base_date + 5) + time '18:30', 1500, 16, 16, 'open');

-- Beginner Clinic -- 2 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_beginner, court2_id,
    (base_date + 1) + time '08:00', (base_date + 1) + time '09:30', 2500, 12, 12, 'open'),
  (gen_random_uuid(), prod_beginner, court1_id,
    (base_date + 5) + time '08:00', (base_date + 5) + time '09:30', 2500, 12, 12, 'open');

-- Competitive Open Play -- 2 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_competitive, court3_id,
    (base_date + 2) + time '17:00', (base_date + 2) + time '19:00', 2000, 12, 12, 'open'),
  (gen_random_uuid(), prod_competitive, court1_id,
    (base_date + 6) + time '17:00', (base_date + 6) + time '19:00', 2000, 12, 12, 'open');

-- Private Coaching -- 3 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_coaching, court2_id,
    (base_date + 1) + time '15:00', (base_date + 1) + time '16:00', 8000, 4, 4, 'open'),
  (gen_random_uuid(), prod_coaching, court3_id,
    (base_date + 3) + time '09:00', (base_date + 3) + time '10:00', 8000, 4, 4, 'open'),
  (gen_random_uuid(), prod_coaching, court1_id,
    (base_date + 5) + time '15:00', (base_date + 5) + time '16:00', 8000, 4, 4, 'open');

-- Kids Camp -- 2 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_kids_camp, court1_id,
    (base_date + 2) + time '09:00', (base_date + 2) + time '11:00', 3000, 16, 16, 'open'),
  (gen_random_uuid(), prod_kids_camp, court2_id,
    (base_date + 6) + time '09:00', (base_date + 6) + time '11:00', 3000, 16, 16, 'open');

-- Weekend Tournament -- 2 sessions (placed on days 5 & 6, likely weekend)
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_tournament, court1_id,
    (base_date + 5) + time '10:00', (base_date + 5) + time '14:00', 5000, 32, 32, 'open'),
  (gen_random_uuid(), prod_tournament, court3_id,
    (base_date + 6) + time '10:00', (base_date + 6) + time '14:00', 5000, 32, 32, 'open');

-- Community Day -- 2 sessions
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_community, court3_id,
    (base_date + 3) + time '14:00', (base_date + 3) + time '17:00', 0, 50, 50, 'open'),
  (gen_random_uuid(), prod_community, court1_id,
    (base_date + 6) + time '14:00', (base_date + 6) + time '17:00', 0, 50, 50, 'open');

-- Smoothie Bowl Add-on -- no court, no duration (food item)
-- 3 sessions aligned with busy event days
insert into sessions (id, product_id, court_id, starts_at, ends_at, price_cents, spots_total, spots_remaining, status) values
  (gen_random_uuid(), prod_smoothie, null,
    (base_date + 1) + time '08:00', (base_date + 1) + time '08:00', 1200, 100, 100, 'open'),
  (gen_random_uuid(), prod_smoothie, null,
    (base_date + 3) + time '08:00', (base_date + 3) + time '08:00', 1200, 100, 100, 'open'),
  (gen_random_uuid(), prod_smoothie, null,
    (base_date + 5) + time '08:00', (base_date + 5) + time '08:00', 1200, 100, 100, 'open');

end $$;

-- =============================================================================
-- PRICING RULES
-- =============================================================================

insert into pricing_rules (id, name, rule_type, multiplier, days_of_week, start_time, end_time, is_active) values
  (gen_random_uuid(), 'Peak Hours',       'peak',     1.5,  '{1,2,3,4,5}', '17:00', '20:00', true),
  (gen_random_uuid(), 'Off-Peak Morning', 'off_peak', 0.8,  '{1,2,3,4,5}', '06:00', '10:00', true),
  (gen_random_uuid(), 'Weekend Premium',  'weekend',  1.25, '{0,6}',       '08:00', '20:00', true),
  (gen_random_uuid(), 'Holiday Surge',    'surge',    2.0,  '{0,1,2,3,4,5,6}', null, null,   false);
