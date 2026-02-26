-- ---------------------------------------------------------------------------
-- Coach Portal Tables
-- Extends coach_profiles with portal-specific data:
--   coach_rates         — per-coach pricing (private/group/package/dropin)
--   attendance_sessions — a coach's logged session for a given date
--   attendance_records  — individual student check-in records
--   coach_notes         — daily backend notes (visible to all coaches)
--   coach_messages      — internal coaches-only chat
-- ---------------------------------------------------------------------------

-- coach_rates: stores the four rate types per coach
create table if not exists coach_rates (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references coach_profiles (id) on delete cascade,
  rate_type   text not null check (rate_type in ('private', 'group', 'package', 'dropin')),
  amount      int  not null check (amount >= 0),  -- dollars (not cents)
  updated_at  timestamptz not null default now(),

  constraint coach_rates_unique unique (coach_id, rate_type)
);

comment on table coach_rates is 'Per-coach pricing rates for the coach portal.';

-- attendance_sessions: one row per coach per day
create table if not exists attendance_sessions (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references coach_profiles (id) on delete cascade,
  session_date date not null default current_date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint attendance_sessions_unique unique (coach_id, session_date)
);

comment on table attendance_sessions is 'A coach-logged attendance session for a given date.';

-- attendance_records: individual student rows within a session
create table if not exists attendance_records (
  id                    uuid primary key default uuid_generate_v4(),
  attendance_session_id uuid not null references attendance_sessions (id) on delete cascade,
  student_name          text not null,
  present               boolean not null default false,
  added_at              timestamptz not null default now()
);

comment on table attendance_records is 'Individual student attendance records within a coach session.';

-- coach_notes: daily backend notes visible to all coaches
create table if not exists coach_notes (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references coach_profiles (id) on delete cascade,
  note_date   date not null default current_date,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint coach_notes_unique unique (coach_id, note_date)
);

comment on table coach_notes is 'Daily backend notes written by coaches, visible to all coaches.';

-- coach_messages: internal group chat
create table if not exists coach_messages (
  id          uuid primary key default uuid_generate_v4(),
  coach_id    uuid not null references coach_profiles (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

comment on table coach_messages is 'Internal coaches-only group chat messages.';

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table coach_rates         enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records  enable row level security;
alter table coach_notes         enable row level security;
alter table coach_messages      enable row level security;

-- coach_rates: coaches can read all, only write their own
create policy "coaches can read all rates"
  on coach_rates for select
  using (
    exists (select 1 from coach_profiles where user_id = auth.uid())
  );

create policy "coaches can upsert own rates"
  on coach_rates for all
  using (
    coach_id in (select id from coach_profiles where user_id = auth.uid())
  );

-- attendance_sessions: coaches can read all, write their own
create policy "coaches can read all attendance sessions"
  on attendance_sessions for select
  using (
    exists (select 1 from coach_profiles where user_id = auth.uid())
  );

create policy "coaches can manage own attendance sessions"
  on attendance_sessions for all
  using (
    coach_id in (select id from coach_profiles where user_id = auth.uid())
  );

-- attendance_records: coaches can read/write records for their own sessions
create policy "coaches can manage attendance records"
  on attendance_records for all
  using (
    attendance_session_id in (
      select id from attendance_sessions
      where coach_id in (select id from coach_profiles where user_id = auth.uid())
    )
  );

-- coach_notes: coaches can read all, write their own
create policy "coaches can read all notes"
  on coach_notes for select
  using (
    exists (select 1 from coach_profiles where user_id = auth.uid())
  );

create policy "coaches can manage own notes"
  on coach_notes for all
  using (
    coach_id in (select id from coach_profiles where user_id = auth.uid())
  );

-- coach_messages: all coaches can read and write
create policy "coaches can read all messages"
  on coach_messages for select
  using (
    exists (select 1 from coach_profiles where user_id = auth.uid())
  );

create policy "coaches can insert messages"
  on coach_messages for insert
  with check (
    coach_id in (select id from coach_profiles where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger coach_rates_updated_at
  before update on coach_rates
  for each row execute procedure update_updated_at();

create trigger attendance_sessions_updated_at
  before update on attendance_sessions
  for each row execute procedure update_updated_at();

create trigger coach_notes_updated_at
  before update on coach_notes
  for each row execute procedure update_updated_at();
