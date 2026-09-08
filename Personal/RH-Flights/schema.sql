-- R"H Flight Info — run this once in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists public.rh_flights (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  name         text not null,
  phone        text not null,
  from_city    text,          -- the city the traveler is leaving from (one per person,
                              -- not per leg; see the note in index.html)

  -- To E"Y (required)
  to_day       text not null,
  to_time      text not null,                                -- display value, e.g. "9:30"
  to_ampm      text not null check (to_ampm in ('AM','PM')),
  to_minutes   integer not null,                             -- 0-1439, used for sorting + matching
  to_airline   text not null,
  to_airport   text,

  -- From E"Y (optional)
  from_day     text,
  from_time    text,
  from_ampm    text check (from_ampm in ('AM','PM')),
  from_minutes integer,
  from_airline text,
  from_airport text,

  comments     text
);

-- Already created the table before these columns existed? Run this much on
-- its own; it is safe to run more than once.
alter table public.rh_flights add column if not exists from_airline text;
alter table public.rh_flights add column if not exists to_airport   text;
alter table public.rh_flights add column if not exists from_airport text;
alter table public.rh_flights add column if not exists from_city    text;
notify pgrst, 'reload schema';

create index if not exists rh_flights_to_idx   on public.rh_flights (to_day, to_minutes);
create index if not exists rh_flights_from_idx on public.rh_flights (from_day, from_minutes);

alter table public.rh_flights enable row level security;

-- The page uses the publishable (anon) key, so anon needs read / insert / update.
-- No delete policy is created, so rows cannot be removed from the browser.
drop policy if exists "rh_flights read"   on public.rh_flights;
drop policy if exists "rh_flights insert" on public.rh_flights;
drop policy if exists "rh_flights update" on public.rh_flights;

create policy "rh_flights read"
  on public.rh_flights for select
  to anon, authenticated
  using (true);

create policy "rh_flights insert"
  on public.rh_flights for insert
  to anon, authenticated
  with check (true);

create policy "rh_flights update"
  on public.rh_flights for update
  to anon, authenticated
  using (true) with check (true);
