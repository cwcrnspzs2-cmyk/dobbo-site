-- Dobbo, stap 4: Stripe-betalingen. Alleen Alec ziet ze; de Edge Function stripe-sync vult ze aan.
create table if not exists public.stripe_charges (
  id text primary key,                    -- ch_...
  created timestamptz not null,
  amount numeric(10,2) not null,          -- in euro
  amount_refunded numeric(10,2) not null default 0,
  currency text not null,
  status text not null,                   -- succeeded, failed, pending
  paid boolean not null default false,
  email text,
  name text,
  description text,
  livemode boolean not null default true,
  payment_id uuid references public.payments(id) on delete set null,
  synced_at timestamptz not null default now()
);
create index if not exists stripe_charges_created on public.stripe_charges (created desc);
alter table public.stripe_charges enable row level security;
drop policy if exists owner_all on public.stripe_charges;
create policy owner_all on public.stripe_charges for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.payments add column if not exists stripe_charge_id text;
