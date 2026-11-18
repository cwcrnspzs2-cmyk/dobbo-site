-- Dobbo, stap 3: inkomsten (beheer per maand, kosten), aanpassingsverzoeken, tijdregistratie,
-- bewaking van sites en bestanden aanleveren.

-- ---------- Betalingen: soort en periode ----------
alter table public.payments add column if not exists kind text not null default 'project';
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('project','beheer','extra'));
alter table public.payments add column if not exists period date;   -- eerste dag van de maand, voor beheer
create unique index if not exists payments_care_month on public.payments (client_id, period) where kind = 'beheer';

-- Maak voor elke beheerklant de rij van deze maand aan (idempotent). Draait maandelijks en bij het openen van HQ.
create or replace function public.ensure_care_payments() returns int
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', now() at time zone 'Europe/Brussels')::date; n int;
begin
  insert into payments (client_id, label, amount, kind, period, due)
  select c.id,
         'Beheer ' || (array['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'])[extract(month from m)::int] || ' ' || extract(year from m)::int,
         case c.care_plan when 'beheer' then 50 when 'beheer_plus' then 100 end,
         'beheer', m, m + 14
  from clients c
  where c.care_plan <> 'geen' and c.stage <> 'verloren'
    and (c.care_since is null or c.care_since <= (m + interval '1 month - 1 day')::date)
  on conflict (client_id, period) where kind = 'beheer' do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ensure_care_payments() from public, anon;
grant execute on function public.ensure_care_payments() to authenticated;

-- ---------- Kosten ----------
create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  day date not null default current_date,
  label text not null,
  amount numeric(10,2) not null,
  category text not null default 'tools',   -- tools, domein, advertenties, materiaal, andere
  monthly boolean not null default false     -- terugkerend elke maand
);

-- ---------- Aanpassingsverzoeken ----------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid default auth.uid(),
  title text not null,
  body text,
  status text not null default 'nieuw' check (status in ('nieuw','bezig','klaar')),
  minutes int not null default 0,
  done_at timestamptz
);

-- ---------- Tijdregistratie ----------
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  day date not null default current_date,
  client_id uuid references public.clients(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  minutes int not null check (minutes > 0 and minutes < 1440),
  note text,
  care boolean not null default false     -- telt mee voor het beheerplan van deze maand
);

-- ---------- Bewaking ----------
create table if not exists public.site_checks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  site_id uuid not null references public.sites(id) on delete cascade,
  ok boolean not null,
  status int,
  ms int,
  error text
);
create index if not exists site_checks_site_idx on public.site_checks (site_id, created_at desc);
create table if not exists public.site_check_pending (
  request_id bigint primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  started_at timestamptz not null default now()
);

-- ---------- Beveiliging ----------
alter table public.costs        enable row level security;
alter table public.requests     enable row level security;
alter table public.time_entries enable row level security;
alter table public.site_checks  enable row level security;
alter table public.site_check_pending enable row level security;
do $$ declare t text; begin
  foreach t in array array['costs','requests','time_entries','site_checks','site_check_pending'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (public.is_owner()) with check (public.is_owner())', t);
  end loop;
end $$;

drop policy if exists client_read on public.requests;
create policy client_read on public.requests for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_insert on public.requests;
create policy client_insert on public.requests for insert to authenticated
  with check (client_id = public.my_client_id() and status = 'nieuw' and minutes = 0 and length(title) < 200 and length(coalesce(body,'')) < 4000);
drop policy if exists client_read on public.site_checks;
create policy client_read on public.site_checks for select to authenticated
  using (site_id in (select id from public.sites where client_id = public.my_client_id()));

-- Nieuw verzoek verschijnt in Alecs activiteit.
create or replace function public.log_client_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity (client_id, kind, text) values (new.client_id, 'aanvraag', 'Aanpassing gevraagd: ' || new.title);
  return new;
end $$;
drop trigger if exists requests_log on public.requests;
create trigger requests_log after insert on public.requests for each row execute function public.log_client_request();

-- ---------- Bewaking uitvoeren (pg_net + pg_cron) ----------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Verwerk antwoorden van de vorige ronde en start een nieuwe.
create or replace function public.run_site_checks() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record; prev boolean; rid bigint;
begin
  -- 1. Resultaten van verzoeken die klaar zijn
  for r in
    select p.request_id, p.site_id, p.started_at, h.status_code, h.timed_out, h.error_msg, h.created
    from site_check_pending p join net._http_response h on h.id = p.request_id
  loop
    select ok into prev from site_checks where site_id = r.site_id order by created_at desc limit 1;
    insert into site_checks (site_id, ok, status, ms, error)
    values (r.site_id, coalesce(r.status_code between 200 and 399, false) and not coalesce(r.timed_out, false), r.status_code,
            greatest(0, extract(epoch from (r.created - r.started_at)) * 1000)::int,
            case when r.timed_out then 'Geen antwoord binnen 10 s' else left(r.error_msg, 200) end);
    -- melding enkel bij een wissel
    if prev is distinct from (coalesce(r.status_code between 200 and 399, false) and not coalesce(r.timed_out, false)) then
      insert into activity (client_id, kind, text)
      select s.client_id, 'bewaking',
             case when coalesce(r.status_code between 200 and 399, false) and not coalesce(r.timed_out, false)
                  then 'Site weer online: ' || s.domain
                  else 'Site onbereikbaar: ' || s.domain || coalesce(' (' || r.status_code || ')', '') end
      from sites s where s.id = r.site_id and (prev is not null or not (coalesce(r.status_code between 200 and 399, false)));
    end if;
    delete from site_check_pending where request_id = r.request_id;
  end loop;
  -- 2. Verzoeken zonder antwoord na 2 minuten: onbereikbaar
  insert into site_checks (site_id, ok, error)
  select site_id, false, 'Geen antwoord' from site_check_pending where started_at < now() - interval '2 minutes';
  delete from site_check_pending where started_at < now() - interval '2 minutes';
  -- 3. Nieuwe ronde over alle sites
  for r in select id, domain from sites loop
    select net.http_get(url := 'https://' || r.domain || '/', timeout_milliseconds := 10000) into rid;
    insert into site_check_pending (request_id, site_id) values (rid, r.id);
  end loop;
  -- 4. Oude metingen opruimen (90 dagen)
  delete from site_checks where created_at < now() - interval '90 days';
end $$;
revoke all on function public.run_site_checks() from public, anon;
grant execute on function public.run_site_checks() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('dobbo-site-checks','dobbo-care-payments');
select cron.schedule('dobbo-site-checks', '*/15 * * * *', $$select public.run_site_checks()$$);
select cron.schedule('dobbo-care-payments', '5 6 1 * *', $$select public.ensure_care_payments()$$);

-- ---------- Bestanden aanleveren (opslag) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800) on conflict (id) do nothing;

drop policy if exists "dobbo owner files" on storage.objects;
create policy "dobbo owner files" on storage.objects for all to authenticated
  using (bucket_id = 'client-files' and public.is_owner()) with check (bucket_id = 'client-files' and public.is_owner());
drop policy if exists "dobbo client files read" on storage.objects;
create policy "dobbo client files read" on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = public.my_client_id()::text);
drop policy if exists "dobbo client files upload" on storage.objects;
create policy "dobbo client files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files' and (storage.foldername(name))[1] = public.my_client_id()::text);
