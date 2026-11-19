-- Mess Extras schema. Demo-grade security: permissive RLS for the anon key.
create table if not exists users (
  id text primary key, roll_no text unique not null, name text not null, room text not null,
  role text not null check (role in ('student','mess'))
);
create table if not exists items (
  id text primary key, name text not null, price_paise int not null, grams_per_plate int not null,
  shelf_life_days int not null, offered_weekdays int[] not null, default_plates int not null, active boolean not null
);
create table if not exists offerings (
  id text primary key, item_id text not null references items(id), date date not null,
  cutoff_at timestamptz not null, status text not null check (status in ('open','closed')),
  forecast_plates int not null, forecast_buy_grams int not null, forecast_reason text not null,
  purchased_grams int, purchase_assumed boolean not null default false,
  capacity_plates int, requested_plates int, confirmed_plates int, buffer_plates int,
  walkins_sold int not null default 0, closed_at timestamptz,
  unique (item_id, date)
);
create table if not exists bookings (
  id text primary key, offering_id text not null references offerings(id), user_id text not null references users(id),
  plates_requested int not null check (plates_requested between 1 and 10), plates_confirmed int,
  price_paise int not null,
  status text not null check (status in ('active','cancelled','confirmed','shortfall_cancelled')),
  token text unique not null, short_code text unique not null,
  created_at timestamptz not null, cancelled_at timestamptz, served_at timestamptz
);
create table if not exists charges (
  id text primary key, user_id text not null references users(id), booking_id text unique not null references bookings(id),
  amount_paise int not null, charged_on date not null
);
create table if not exists stock_batches (
  id text primary key, item_id text not null references items(id), grams_initial int not null,
  grams_remaining int not null, purchased_on date not null, expires_on date not null, written_off_at timestamptz
);
create table if not exists notifications (
  id text primary key, audience text not null check (audience in ('user','students','mess')),
  user_id text references users(id), kind text not null, title text not null, body text not null,
  dedupe_key text unique not null, created_at timestamptz not null, read_at timestamptz
);
create table if not exists app_settings (
  id int primary key default 1 check (id = 1), demo_now timestamptz, demo_set_at timestamptz
);
insert into app_settings (id) values (1) on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['users','items','offerings','bookings','charges','stock_batches','notifications','app_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table offerings, bookings, notifications, app_settings, stock_batches;
  exception when others then null; end;
end $$;

-- Booking: only while the offering is open (row lock serialises with apply_close).
create or replace function create_booking(p jsonb) returns void language plpgsql as $$
declare st text;
begin
  select status into st from offerings where id = p->>'offering_id' for update;
  if st is null then raise exception 'Offering not found'; end if;
  if st <> 'open' then raise exception 'Booking closed for today'; end if;
  insert into bookings select * from jsonb_populate_record(null::bookings, p);
end $$;

create or replace function cancel_booking(p_id text, p_at timestamptz) returns void language plpgsql as $$
declare st text; bst text;
begin
  select o.status, b.status into st, bst from bookings b join offerings o on o.id = b.offering_id
    where b.id = p_id for update of o;
  if st is null then raise exception 'Booking not found'; end if;
  if st <> 'open' then raise exception 'Cancellation closed at 5 pm'; end if;
  if bst <> 'active' then raise exception 'Booking is not active'; end if;
  update bookings set status = 'cancelled', cancelled_at = p_at where id = p_id;
end $$;

-- Apply a close computed by the client. Exactly once: returns false if already closed.
create or replace function apply_close(p_offering text, p jsonb) returns boolean language plpgsql as $$
declare st text; o jsonb := p->'offering';
begin
  select status into st from offerings where id = p_offering for update;
  if st is distinct from 'open' then return false; end if;
  update offerings set status = 'closed', closed_at = (o->>'closed_at')::timestamptz,
    capacity_plates = (o->>'capacity_plates')::int, requested_plates = (o->>'requested_plates')::int,
    confirmed_plates = (o->>'confirmed_plates')::int, buffer_plates = (o->>'buffer_plates')::int,
    purchased_grams = (o->>'purchased_grams')::int, purchase_assumed = (o->>'purchase_assumed')::boolean
  where id = p_offering;
  update bookings b set status = x.status, plates_confirmed = x.plates_confirmed
    from jsonb_populate_recordset(null::bookings, p->'bookings') x where b.id = x.id;
  insert into charges select * from jsonb_populate_recordset(null::charges, p->'charges') on conflict (booking_id) do nothing;
  insert into stock_batches select * from jsonb_populate_recordset(null::stock_batches, p->'batches')
    on conflict (id) do update set grams_remaining = excluded.grams_remaining;
  insert into notifications select * from jsonb_populate_recordset(null::notifications, p->'notifications')
    on conflict (dedupe_key) do nothing;
  return true;
end $$;

create or replace function record_purchase(p_offering text, p_batch jsonb) returns void language plpgsql as $$
declare st text;
begin
  select status into st from offerings where id = p_offering for update;
  if st <> 'open' then raise exception 'Bookings already closed'; end if;
  insert into stock_batches select * from jsonb_populate_record(null::stock_batches, p_batch);
  update offerings set purchased_grams = coalesce(purchased_grams, 0) + (p_batch->>'grams_initial')::int where id = p_offering;
end $$;

create or replace function mark_served(p_id text, p_at timestamptz) returns boolean language sql as $$
  with u as (update bookings set served_at = p_at where id = p_id and served_at is null returning 1)
  select exists(select 1 from u);
$$;

create or replace function increment_walkin(p_offering text) returns boolean language sql as $$
  with u as (update offerings set walkins_sold = walkins_sold + 1
    where id = p_offering and status = 'closed' and walkins_sold < coalesce(buffer_plates, 0) returning 1)
  select exists(select 1 from u);
$$;

create or replace function wipe_demo() returns void language sql as $$
  truncate notifications, charges, bookings, stock_batches, offerings, items, users cascade;
  update app_settings set demo_now = null, demo_set_at = null where id = 1;
$$;

-- Newer Supabase projects don't grant the API roles access to tables made in SQL. Demo-grade: grant it all.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
