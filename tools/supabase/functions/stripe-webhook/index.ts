// Dobbo: Stripe-webhook. Zet een betaling meteen in Dobbo HQ, zonder op "Synchroniseer" te klikken.
// Echtheid: we geloven de inhoud van het bericht niet, maar halen het event zelf opnieuw op bij Stripe
// met STRIPE_SECRET_KEY (beperkte sleutel: Charges, Balance en Events alleen lezen). Geen tweede geheim nodig.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ error: 'alleen POST' }, 405);
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return ok({ error: 'not_connected' }, 503);

  let id = '';
  try { id = String((await req.json())?.id ?? ''); } catch { /* leeg */ }
  if (!/^evt_[A-Za-z0-9]+$/.test(id)) return ok({ error: 'geen event' }, 400);

  // 1. Event opnieuw ophalen bij Stripe: een vervalst bericht bestaat daar niet
  const r = await fetch('https://api.stripe.com/v1/events/' + id, { headers: { Authorization: 'Bearer ' + key } });
  if (!r.ok) return ok({ error: 'onbekend event' }, 400);
  const ev = await r.json();
  const c = ev?.data?.object;
  if (!c || c.object !== 'charge') return ok({ ok: true, skipped: ev?.type });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 2. Betaling opslaan (zelfde vorm als stripe-sync)
  const row = {
    id: c.id,
    created: new Date(c.created * 1000).toISOString(),
    amount: c.amount / 100,
    amount_refunded: (c.amount_refunded ?? 0) / 100,
    currency: c.currency,
    status: c.status,
    paid: !!c.paid && c.status === 'succeeded',
    email: (c.billing_details?.email ?? c.receipt_email ?? null)?.toLowerCase() ?? null,
    name: c.billing_details?.name ?? null,
    description: c.description ?? c.statement_descriptor ?? null,
    livemode: !!c.livemode,
    synced_at: new Date().toISOString(),
  };
  const { error } = await admin.from('stripe_charges').upsert(row, { onConflict: 'id' });
  if (error) return ok({ error: error.message }, 500);

  // 3. Koppelen aan een open schijf: zelfde klant (e-mail) en zelfde bedrag. Testbetalingen nooit.
  let matched = false;
  if (row.paid && row.livemode && row.email) {
    const { data: ch } = await admin.from('stripe_charges').select('payment_id').eq('id', row.id).single();
    const { data: cl } = await admin.from('clients').select('id').ilike('email', row.email).limit(1);
    if (!ch?.payment_id && cl?.length) {
      const { data: pay } = await admin.from('payments').select('*').eq('client_id', cl[0].id).is('paid_at', null)
        .eq('amount', Number(row.amount)).order('created_at').limit(1);
      if (pay?.length) {
        await admin.from('payments').update({ paid_at: row.created.slice(0, 10), stripe_charge_id: row.id }).eq('id', pay[0].id);
        await admin.from('stripe_charges').update({ payment_id: pay[0].id }).eq('id', row.id);
        await admin.from('activity').insert({ client_id: cl[0].id, kind: 'betaling', text: `${pay[0].label} betaald via Stripe (€${Number(row.amount).toFixed(2)})` });
        matched = true;
      }
    }
  }
  return ok({ ok: true, type: ev.type, matched });
});
