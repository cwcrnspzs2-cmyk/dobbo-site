-- Dobbo-dashboard: databaseschema voor Supabase.
-- Alleen alec@dobbo.be kan gegevens lezen of wijzigen.
-- De website mag enkel bezoeken, vragenlijsten en boekingen toevoegen (niet lezen).

create extension if not exists pgcrypto;

-- ---------- Klanten ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,                 -- contactpersoon
  business text,                      -- naam van de zaak
  email text,
  phone text,
  website text,                       -- huidige site
  city text,
  sector text,
  stage text not null default 'lead'
    check (stage in ('lead','gesprek','voorschot','info','versie','afwerken','online','verloren')),
  package text check (package in ('start','groei','systeem')),
  price numeric(10,2),
  addons text,
  progress int not null default 0 check (progress between 0 and 100),
  next_step text,
  next_date date,
  deadline date,
  site_url text,                      -- nieuwe site, live
  preview_url text,                   -- bijna klare versie
  repo_url text,
  care_plan text not null default 'geen' check (care_plan in ('geen','beheer','beheer_plus')),
  care_since date,
  care_minutes_used int not null default 0,
  care_last_report date,
  source text default 'manueel',      -- cal, vragenlijst, manueel, outreach
  notes text
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  label text not null,                -- Voorschot 30%, Na akkoord 40%, Oplevering 30%, Beheer november
  amount numeric(10,2) not null,
  due date,
  paid_at date
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid references public.clients(id) on delete cascade,
  kind text not null default 'notitie', -- notitie, boeking, vragenlijst, status, betaling
  text text not null
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cal_uid text unique,
  start_time timestamptz,
  name text, email text, business text, website text, phone text, location text,
  status text not null default 'gepland',
  client_id uuid references public.clients(id) on delete set null,
  raw jsonb
);

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text, email text, business text, website text,
  answers jsonb not null default '{}'::jsonb,
  client_id uuid references public.clients(id) on delete set null
);

create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  sid text,
  type text not null check (type in ('view','click')),
  path text, ref text, label text, device text, lang text
);
create index if not exists site_events_created_idx on public.site_events (created_at desc);

-- ---------- Beveiliging ----------
create or replace function public.is_owner() returns boolean
language sql stable as $$ select coalesce(auth.jwt()->>'email','') = 'alec@dobbo.be' $$;

alter table public.clients        enable row level security;
alter table public.payments       enable row level security;
alter table public.activity       enable row level security;
alter table public.bookings       enable row level security;
alter table public.questionnaires enable row level security;
alter table public.site_events    enable row level security;

do $$ declare t text; begin
  foreach t in array array['clients','payments','activity','bookings','questionnaires','site_events'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

-- De website mag bezoeken en vragenlijsten toevoegen, maar nooit lezen.
drop policy if exists site_insert on public.site_events;
create policy site_insert on public.site_events for insert to anon
  with check (type in ('view','click') and length(coalesce(path,'')) < 200 and length(coalesce(label,'')) < 200
              and length(coalesce(ref,'')) < 200 and length(coalesce(sid,'')) < 64);

drop policy if exists form_insert on public.questionnaires;
create policy form_insert on public.questionnaires for insert to anon
  with check (length(answers::text) < 20000);  -- client_id zet de trigger zelf

grant insert on public.site_events, public.questionnaires to anon;

-- ---------- Automatisch bijwerken ----------
create or replace function public.touch_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated();

-- Vragenlijst binnen: koppel aan klant (op e-mail) of maak een nieuwe lead.
create or replace function public.link_questionnaire() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from clients where lower(email) = lower(new.email) order by created_at desc limit 1;
  if cid is null then
    insert into clients (name, business, email, website, stage, source)
    values (coalesce(nullif(new.name,''),'Onbekend'), new.business, lower(new.email), new.website, 'lead', 'vragenlijst')
    returning id into cid;
  else
    update clients set business = coalesce(business, new.business), website = coalesce(website, new.website) where id = cid;
  end if;
  new.client_id := cid;
  insert into activity (client_id, kind, text) values (cid, 'vragenlijst', 'Vragenlijst ingevuld');
  return new;
end $$;
drop trigger if exists questionnaire_link on public.questionnaires;
create trigger questionnaire_link before insert on public.questionnaires for each row execute function public.link_questionnaire();

-- Cal.com-webhook: elke boeking komt binnen als klant + boeking.
-- Cal.com stuurt {"triggerEvent": ..., "createdAt": ..., "payload": {...}}.
create or replace function public.cal_webhook("triggerEvent" text, "createdAt" text default null, payload jsonb default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(payload->'responses', '{}'::jsonb);
  a jsonb := payload->'attendees'->0;
  uid text := payload->>'uid';
  em text; nm text; biz text; site text; ph text; st timestamptz; cid uuid;
  function_val text;
begin
  if payload is null or "triggerEvent" is null or "triggerEvent" = 'PING' then return 'ok'; end if;
  em  := lower(coalesce(a->>'email', r->'email'->>'value', r->>'email'));
  nm  := coalesce(a->>'name', r->'name'->>'value', r->>'name');
  biz := coalesce(r->'Naam-van-je-zaak'->>'value', r->>'Naam-van-je-zaak');
  site:= coalesce(r->'Je-huidige-website--als-je-er-een-hebt'->>'value', r->>'Je-huidige-website--als-je-er-een-hebt');
  ph  := coalesce(r->'attendeePhoneNumber'->>'value', r->'location'->'value'->>'optionValue');
  st  := nullif(payload->>'startTime','')::timestamptz;

  if "triggerEvent" in ('BOOKING_CREATED','BOOKING_RESCHEDULED') then
    select id into cid from clients where lower(email) = em order by created_at desc limit 1;
    if cid is null then
      insert into clients (name, business, email, website, phone, stage, source, next_step, next_date, progress)
      values (coalesce(nm,'Onbekend'), biz, em, site, ph, 'gesprek', 'cal', 'Gratis gesprek', (st at time zone 'Europe/Brussels')::date, 5)
      returning id into cid;
    else
      update clients set
        stage = case when stage = 'lead' then 'gesprek' else stage end,
        business = coalesce(business, biz), website = coalesce(website, site), phone = coalesce(phone, ph),
        next_step = case when stage in ('lead','gesprek') then 'Gratis gesprek' else next_step end,
        next_date = case when stage in ('lead','gesprek') then (st at time zone 'Europe/Brussels')::date else next_date end
      where id = cid;
    end if;
    insert into bookings (cal_uid, start_time, name, email, business, website, phone, location, status, client_id, raw)
    values (uid, st, nm, em, biz, site, ph, payload->>'location', 'gepland', cid, payload)
    on conflict (cal_uid) do update set start_time = excluded.start_time, status = 'gepland';
    insert into activity (client_id, kind, text)
    values (cid, 'boeking', case when "triggerEvent" = 'BOOKING_RESCHEDULED' then 'Gesprek verzet naar ' else 'Gesprek geboekt voor ' end
            || to_char(st at time zone 'Europe/Brussels', 'DD/MM "om" HH24:MI'));
  elsif "triggerEvent" = 'BOOKING_CANCELLED' then
    update bookings set status = 'geannuleerd' where cal_uid = uid returning client_id into cid;
    if cid is not null then insert into activity (client_id, kind, text) values (cid, 'boeking', 'Gesprek geannuleerd'); end if;
  end if;
  return 'ok';
end $$;
revoke all on function public.cal_webhook(text, text, jsonb) from public;
grant execute on function public.cal_webhook(text, text, jsonb) to anon;
