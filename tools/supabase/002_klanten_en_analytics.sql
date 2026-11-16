-- Dobbo HQ, stap 2: klantaccounts, sites met tracking, rapporten en statistieken.
-- Klanten zien alleen hun eigen klantrij, betalingen, rapporten en sitebezoek. Notities en activiteit blijven privé.

-- ---------- Sites (dobbo.be zelf + elke klantensite) ----------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id) on delete cascade,   -- null = dobbo.be zelf
  domain text not null
);
insert into public.sites (id, domain) values ('00000000-0000-4000-8000-00000000d0b0', 'dobbo.be') on conflict (id) do nothing;

alter table public.site_events add column if not exists site_id uuid references public.sites(id) on delete cascade;
update public.site_events set site_id = '00000000-0000-4000-8000-00000000d0b0' where site_id is null;
alter table public.site_events drop constraint if exists site_events_type_check;
alter table public.site_events add constraint site_events_type_check check (type in ('view','click','form'));
create index if not exists site_events_site_idx on public.site_events (site_id, created_at desc);

-- ---------- Klantaccounts en aanvragen ----------
create table if not exists public.client_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  email text, name text, business text, website text, message text,
  status text not null default 'aanvraag' check (status in ('aanvraag','actief','geweigerd')),
  client_id uuid references public.clients(id) on delete set null
);

-- ---------- Rapporten van Alec aan de klant ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  period text,
  body text not null
);

-- ---------- Beveiliging ----------
create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from client_users where user_id = auth.uid() and status = 'actief'
$$;

alter table public.sites        enable row level security;
alter table public.client_users enable row level security;
alter table public.reports      enable row level security;

do $$ declare t text; begin
  foreach t in array array['sites','client_users','reports'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

drop policy if exists client_read on public.clients;
create policy client_read on public.clients for select to authenticated using (id = public.my_client_id());
drop policy if exists client_read on public.payments;
create policy client_read on public.payments for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_read on public.reports;
create policy client_read on public.reports for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_read on public.sites;
create policy client_read on public.sites for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_read on public.site_events;
create policy client_read on public.site_events for select to authenticated
  using (site_id in (select id from public.sites where client_id = public.my_client_id()));

-- Een ingelogde bezoeker mag enkel zijn eigen aanvraag zien en indienen, nooit zichzelf activeren.
drop policy if exists self_read on public.client_users;
create policy self_read on public.client_users for select to authenticated using (user_id = auth.uid());
drop policy if exists self_request on public.client_users;
create policy self_request on public.client_users for insert to authenticated
  with check (user_id = auth.uid() and status = 'aanvraag' and client_id is null
              and length(coalesce(message,'')) < 2000);

-- Tracker: bezoek mag binnenkomen voor een bestaande site, nooit gelezen worden.
drop policy if exists site_insert on public.site_events;
create policy site_insert on public.site_events for insert to anon, authenticated
  with check (site_id is not null and type in ('view','click','form')
              and length(coalesce(path,'')) < 200 and length(coalesce(label,'')) < 200
              and length(coalesce(ref,'')) < 200 and length(coalesce(sid,'')) < 64);
grant insert on public.site_events to authenticated;

-- Nieuwe aanvraag verschijnt in Alecs activiteit.
create or replace function public.log_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity (client_id, kind, text) values (null, 'aanvraag', 'Toegangsaanvraag van ' || coalesce(nullif(new.business,''), new.email));
  return new;
end $$;
drop trigger if exists client_users_log on public.client_users;
create trigger client_users_log after insert on public.client_users for each row execute function public.log_request();

-- ---------- Statistieken (draait met de rechten van wie vraagt: RLS blijft gelden) ----------
create or replace function public.site_stats(p_site uuid, p_days int default 30)
returns jsonb language sql stable security invoker set search_path = public as $$
with cur as (
  select * from site_events where site_id = p_site and created_at >= now() - make_interval(days => p_days)
), prev as (
  select * from site_events where site_id = p_site
    and created_at >= now() - make_interval(days => 2 * p_days) and created_at < now() - make_interval(days => p_days)
), sess as (
  select sid, count(*) filter (where type = 'view') v, count(*) filter (where type in ('click','form')) a from cur group by sid
), days as (
  select gs::date d from generate_series((now() at time zone 'Europe/Brussels')::date - (p_days - 1),
                                        (now() at time zone 'Europe/Brussels')::date, interval '1 day') gs
), per_day as (
  select (created_at at time zone 'Europe/Brussels')::date d,
         count(distinct sid) filter (where type = 'view') v,
         count(*) filter (where type in ('click','form')) a
  from cur group by 1
)
select jsonb_build_object(
  'visitors',      (select count(distinct sid) from cur where type = 'view'),
  'views',         (select count(*) from cur where type = 'view'),
  'actions',       (select count(*) from cur where type in ('click','form')),
  'prev_visitors', (select count(distinct sid) from prev where type = 'view'),
  'prev_views',    (select count(*) from prev where type = 'view'),
  'prev_actions',  (select count(*) from prev where type in ('click','form')),
  'live',          (select count(distinct sid) from site_events where site_id = p_site and created_at >= now() - interval '5 minutes'),
  'funnel',        jsonb_build_array((select count(*) from sess where v > 0), (select count(*) from sess where v > 1), (select count(*) from sess where a > 0)),
  'daily',         coalesce((select jsonb_agg(jsonb_build_object('d', days.d, 'v', coalesce(p.v, 0), 'a', coalesce(p.a, 0)) order by days.d)
                             from days left join per_day p on p.d = days.d), '[]'::jsonb),
  'pages',         coalesce((select jsonb_agg(jsonb_build_array(k, n)) from (select coalesce(nullif(path,''), '/') k, count(*) n from cur where type = 'view' group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
  'sources',       coalesce((select jsonb_agg(jsonb_build_array(k, n)) from (select coalesce(nullif(ref,''), 'Rechtstreeks') k, count(distinct sid) n from cur where type = 'view' group by 1 order by 2 desc limit 8) x), '[]'::jsonb),
  'devices',       coalesce((select jsonb_agg(jsonb_build_array(k, n)) from (select coalesce(nullif(device,''), 'Onbekend') k, count(distinct sid) n from cur where type = 'view' group by 1 order by 2 desc) x), '[]'::jsonb),
  'actions_top',   coalesce((select jsonb_agg(jsonb_build_array(k, n)) from (select coalesce(nullif(label,''), 'Onbekend') k, count(*) n from cur where type in ('click','form') group by 1 order by 2 desc limit 8) x), '[]'::jsonb)
)
$$;
revoke all on function public.site_stats(uuid, int) from public, anon;
grant execute on function public.site_stats(uuid, int) to authenticated;
