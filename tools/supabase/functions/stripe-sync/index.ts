// Dobbo: haalt Stripe-betalingen op en vinkt overeenkomende schijven af.
// Geheim nodig: STRIPE_SECRET_KEY (beperkte sleutel, alleen lezen: Charges en Balance).
// Alleen alec@dobbo.be mag deze functie aanroepen.
import { createClient } from 'npm:@supabase/supabase-js@2';

const OWNER = 'alec@dobbo.be';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1. Enkel de eigenaar
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user || user.email?.toLowerCase() !== OWNER) return json({ error: 'Geen toegang' }, 403);

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) return json({ error: 'not_connected', message: 'Er staat nog geen Stripe-sleutel in Supabase.' }, 200);
  const stripe = (path: string) => fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key } }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? 'Stripe gaf een fout');
    return j;
  });

  try {
    // 2. Betalingen ophalen: alles de eerste keer, daarna vanaf 3 dagen voor de laatste
    const { data: last } = await admin.from('stripe_charges').select('created').order('created', { ascending: false }).limit(1);
    const since = last?.[0] ? Math.floor(new Date(last[0].created).getTime() / 1000) - 3 * 86400 : 0;
    let after: string | undefined, n = 0, livemode = true;
    do {
      const p = new URLSearchParams({ limit: '100' });
      if (since) p.set('created[gte]', String(since));
      if (after) p.set('starting_after', after);
      const page = await stripe('charges?' + p);
      const rows = page.data.map((c: any) => ({
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
      }));
      if (rows.length) { livemode = rows[0].livemode; const { error } = await admin.from('stripe_charges').upsert(rows, { onConflict: 'id', ignoreDuplicates: false }); if (error) throw error; }
      n += rows.length;
      after = page.has_more ? page.data[page.data.length - 1].id : undefined;
    } while (after && n < 5000);

    // 3. Koppelen aan open schijven: zelfde klant (e-mail) en zelfde bedrag
    const { data: open } = await admin.from('stripe_charges').select('*').eq('paid', true).is('payment_id', null);
    let matched = 0;
    for (const ch of open ?? []) {
      if (!ch.email) continue;
      const { data: cl } = await admin.from('clients').select('id,business,name').ilike('email', ch.email).limit(1);
      if (!cl?.length) continue;
      const { data: pay } = await admin.from('payments').select('*').eq('client_id', cl[0].id).is('paid_at', null)
        .eq('amount', Number(ch.amount)).order('created_at').limit(1);
      if (!pay?.length) continue;
      await admin.from('payments').update({ paid_at: ch.created.slice(0, 10), stripe_charge_id: ch.id }).eq('id', pay[0].id);
      await admin.from('stripe_charges').update({ payment_id: pay[0].id }).eq('id', ch.id);
      await admin.from('activity').insert({ client_id: cl[0].id, kind: 'betaling', text: `${pay[0].label} betaald via Stripe (€${Number(ch.amount).toFixed(2)})` });
      matched++;
    }

    // 4. Saldo
    const bal = await stripe('balance');
    const sum = (arr: any[]) => (arr ?? []).filter((x) => x.currency === 'eur').reduce((a, x) => a + x.amount, 0) / 100;
    return json({ ok: true, synced: n, matched, livemode, balance: { available: sum(bal.available), pending: sum(bal.pending) } });
  } catch (e) {
    return json({ error: 'stripe', message: String((e as Error).message ?? e) }, 200);
  }
});
