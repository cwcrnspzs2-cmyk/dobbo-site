import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, OWNER_EMAIL } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Vaste waarden ---------------- */
const STAGES = [
  ['lead', 'Lead', 0, 'gray'],
  ['gesprek', 'Gesprek gepland', 5, ''],
  ['voorschot', 'Wacht op voorschot', 10, 'amber'],
  ['info', 'Info verzamelen', 25, ''],
  ['versie', 'Bijna klare versie', 60, ''],
  ['afwerken', 'Afwerken', 85, ''],
  ['online', 'Online', 100, 'green'],
  ['verloren', 'Niet doorgegaan', 0, 'red'],
];
const ST = Object.fromEntries(STAGES.map(([k, l, p, c]) => [k, { label: l, progress: p, color: c }]));
const PACKAGES = { start: 'Start', groei: 'Groei', systeem: 'Systeem' };
const CARE = { geen: { label: 'Geen', price: 0, minutes: 0 }, beheer: { label: 'Beheer', price: 50, minutes: 30 }, beheer_plus: { label: 'Beheer+', price: 100, minutes: 120 } };
const BUILDING = ['voorschot', 'info', 'versie', 'afwerken'];

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const ROUTES = [
  ['overzicht', 'Overzicht', 'home'],
  ['klanten', 'Klanten', 'users'],
  ['beheer', 'Beheer', 'shield'],
  ['site', 'Site', 'chart'],
  ['outreach', 'Outreach', 'send', true],
];

/* ---------------- Hulpjes ---------------- */
const eur = (n) => '€' + Number(n || 0).toLocaleString('nl-BE', { maximumFractionDigits: 0 });
const today = () => new Date(new Date().toDateString());
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '');
const fmtDT = (d) => new Date(d).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const isLate = (d) => d && new Date(d) < today();
function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}
async function q(promise) {
  const { data, error } = await promise;
  if (error) { console.error(error); toast('Fout: ' + error.message); throw error; }
  return data;
}

/* ---------------- Login ---------------- */
async function boot() {
  try { localStorage.setItem('dobbo_notrack', '1'); } catch (e) {} // je eigen bezoeken aan dobbo.be niet meetellen
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (SUPABASE_URL.includes('PROJECT')) {
    $('#login').classList.remove('hidden');
    $('#login-msg').textContent = 'Supabase is nog niet gekoppeld (config.js).';
    $('#login-btn').disabled = true;
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) return start(session);
  showLogin();
  sb.auth.onAuthStateChange((_e, s) => { if (s && $('#app').classList.contains('hidden')) start(s); });
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
  const form = $('#login-form'), email = $('#login-email'), code = $('#login-code'), btn = $('#login-btn'), msg = $('#login-msg');
  let sent = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    msg.className = 'msg';
    btn.disabled = true;
    try {
      if (!sent) {
        if (email.value.trim().toLowerCase() !== OWNER_EMAIL) throw new Error('Alleen ' + OWNER_EMAIL + ' heeft toegang.');
        const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        sent = true;
        code.classList.remove('hidden');
        code.focus();
        btn.textContent = 'Inloggen';
        msg.textContent = 'Mail verstuurd naar ' + email.value + '. Klik op de link in die mail, of vul de code in als die erin staat.';
      } else {
        const { data, error } = await sb.auth.verifyOtp({ email: email.value.trim(), token: code.value.trim(), type: 'email' });
        if (error) throw error;
        start(data.session);
      }
    } catch (err) {
      msg.className = 'msg err';
      msg.textContent = err.message;
    } finally { btn.disabled = false; }
  };
}

function start(session) {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent = session.user.email;
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const nav = ROUTES.map(([id, label, ic, soon]) => `<a href="#${id}" data-r="${id}">${icon(ic)}<span>${label}</span>${soon ? '<span class="soon">binnenkort</span>' : ''}</a>`).join('');
  $('#nav').innerHTML = nav;
  $('#tabbar').innerHTML = ROUTES.filter((r) => !r[3]).map(([id, label, ic]) => `<a href="#${id}" data-r="${id}">${icon(ic)}<span>${label}</span></a>`).join('');
  window.addEventListener('hashchange', route);
  $('#scrim').onclick = closePanel;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  route();
}

function route() {
  const [r, id] = (location.hash.slice(1) || 'overzicht').split('/');
  document.querySelectorAll('[data-r]').forEach((a) => (a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const view = { overzicht, klanten, beheer, site, outreach }[r] || overzicht;
  view().catch(() => {});
  if (r === 'klanten' && id) openClient(id);
}

function header(title, sub, actions = '') {
  return `<div class="top"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div>${actions}</div></div>`;
}

/* ---------------- Overzicht ---------------- */
async function overzicht() {
  const v = $('#view');
  v.innerHTML = header('Overzicht', new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })) + '<p class="empty">Laden…</p>';
  const [clients, payments, act, events, bookings] = await Promise.all([
    q(sb.from('clients').select('*')),
    q(sb.from('payments').select('*')),
    q(sb.from('activity').select('*, clients(name,business)').order('created_at', { ascending: false }).limit(12)),
    q(sb.from('site_events').select('type,sid,created_at').gte('created_at', daysAgo(7))),
    q(sb.from('bookings').select('*').eq('status', 'gepland').gte('start_time', new Date().toISOString()).order('start_time').limit(5)),
  ]);
  const newLeads = clients.filter((c) => c.created_at > daysAgo(7)).length;
  const building = clients.filter((c) => BUILDING.includes(c.stage)).length;
  const open = payments.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const mrr = clients.filter((c) => c.stage !== 'verloren').reduce((s, c) => s + CARE[c.care_plan].price, 0);
  const visitors = new Set(events.filter((e) => e.type === 'view').map((e) => e.sid)).size;
  const ctas = events.filter((e) => e.type === 'click').length;

  const next = clients
    .filter((c) => c.next_step && c.stage !== 'verloren')
    .sort((a, b) => (a.next_date || '9999') < (b.next_date || '9999') ? -1 : 1)
    .slice(0, 8);

  v.innerHTML = header('Overzicht', new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }),
    `<button class="btn btn-blue" id="new-client">${icon('plus')}Nieuwe klant</button>`) + `
  <div class="kpis">
    <div class="kpi"><span>Nieuwe leads</span><b>${newLeads}</b><small>laatste 7 dagen</small></div>
    <div class="kpi"><span>In opbouw</span><b>${building}</b><small>sites in de maak</small></div>
    <div class="kpi"><span>Nog te ontvangen</span><b>${eur(open)}</b><small>openstaande schijven</small></div>
    <div class="kpi"><span>Beheer per maand</span><b>${eur(mrr)}</b><small>vaste inkomsten</small></div>
    <div class="kpi"><span>Bezoekers</span><b>${visitors}</b><small>dobbo.be, 7 dagen</small></div>
    <div class="kpi"><span>Klikken op boeken</span><b>${ctas}</b><small>7 dagen</small></div>
  </div>
  <div class="two">
    <div class="grid">
      <div class="card"><h2>Volgende stappen</h2><div class="list">${next.length ? next.map((c) => `
        <div class="row" data-open="${c.id}"><div class="main"><b>${esc(c.next_step)}</b><span>${esc(c.business || c.name)}</span></div>
        <span class="date ${isLate(c.next_date) ? 'late' : ''}">${fmtDate(c.next_date)}</span></div>`).join('') : '<p class="empty">Geen open stappen.</p>'}</div></div>
      <div class="card"><h2>Komende gesprekken</h2><div class="list">${bookings.length ? bookings.map((b) => `
        <div class="row" ${b.client_id ? `data-open="${b.client_id}"` : ''}><div class="main"><b>${esc(b.business || b.name)}</b><span>${esc(b.name)} · ${esc(b.email)}</span></div>
        <span class="date">${fmtDT(b.start_time)}</span></div>`).join('') : '<p class="empty">Nog niets geboekt.</p>'}</div></div>
    </div>
    <div class="card"><h2>Recente activiteit</h2><div class="log">${act.length ? act.map((a) => `
      <div><time>${fmtDT(a.created_at)}</time><span><b>${esc(a.clients?.business || a.clients?.name || '')}</b> ${esc(a.text)}</span></div>`).join('') : '<p class="empty">Nog geen activiteit.</p>'}</div></div>
  </div>`;
  v.querySelectorAll('[data-open]').forEach((r) => (r.onclick = () => (location.hash = 'klanten/' + r.dataset.open)));
  $('#new-client').onclick = newClient;
}

/* ---------------- Klanten ---------------- */
let filter = '';
async function klanten() {
  const v = $('#view');
  const clients = await q(sb.from('clients').select('*').order('updated_at', { ascending: false }));
  const f = filter.toLowerCase();
  const shown = clients.filter((c) => !f || [c.name, c.business, c.email, c.city].join(' ').toLowerCase().includes(f));
  v.innerHTML = header('Klanten', `${clients.filter((c) => c.stage !== 'verloren').length} actief`,
    `<button class="btn btn-blue" id="new-client">${icon('plus')}Nieuwe klant</button>`) + `
  <div class="toolbar"><input type="text" id="search" placeholder="Zoek op naam, zaak, stad…" value="${esc(filter)}"></div>
  <div class="board">${STAGES.map(([k, label]) => {
    const list = shown.filter((c) => c.stage === k);
    return `<div class="col"><h3>${label}<em>${list.length}</em></h3>${list.map((c) => `
      <div class="ccard" data-open="${c.id}" tabindex="0">
        <b>${esc(c.business || c.name)}</b>
        <span class="sub">${esc(c.business ? c.name : c.email || '')}</span>
        ${!['lead', 'verloren'].includes(k) ? `<div class="bar"><i style="width:${c.progress}%"></i></div>` : ''}
        <div class="meta">${c.care_plan !== 'geen' ? `<span class="pill green">${CARE[c.care_plan].label}</span>` : c.package ? `<span class="pill gray">${PACKAGES[c.package]}</span>` : '<span></span>'}
        ${c.next_date ? `<span class="date ${isLate(c.next_date) ? 'late' : ''}">${fmtDate(c.next_date)}</span>` : ''}</div>
      </div>`).join('')}</div>`;
  }).join('')}</div>`;
  v.querySelectorAll('[data-open]').forEach((r) => {
    r.onclick = () => (location.hash = 'klanten/' + r.dataset.open);
    r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); };
  });
  const s = $('#search');
  s.oninput = () => { filter = s.value; clearTimeout(s.t); s.t = setTimeout(() => klanten().then(() => { const n = $('#search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 250); };
  $('#new-client').onclick = newClient;
}

async function newClient() {
  const name = prompt('Naam van de klant (contactpersoon)?');
  if (!name) return;
  const business = prompt('Naam van de zaak? (mag leeg)') || null;
  const [c] = await q(sb.from('clients').insert({ name, business, source: 'manueel' }).select());
  await q(sb.from('activity').insert({ client_id: c.id, kind: 'status', text: 'Klant aangemaakt' }));
  location.hash = 'klanten/' + c.id;
}

/* ---------------- Klantdetail ---------------- */
function closePanel() {
  const p = $('#panel');
  if (!p.classList.contains('open')) return;
  p.classList.remove('open');
  p.setAttribute('inert', '');
  $('#scrim').classList.remove('open');
  if (location.hash.startsWith('#klanten/')) history.replaceState(null, '', '#klanten');
  if ((location.hash.slice(1) || '').startsWith('klanten')) klanten().catch(() => {});
}

async function openClient(id) {
  const [c] = await q(sb.from('clients').select('*').eq('id', id));
  if (!c) return toast('Klant niet gevonden');
  const [payments, act, bookings, quest] = await Promise.all([
    q(sb.from('payments').select('*').eq('client_id', id).order('created_at')),
    q(sb.from('activity').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(40)),
    q(sb.from('bookings').select('*').eq('client_id', id).order('start_time', { ascending: false })),
    q(sb.from('questionnaires').select('*').eq('client_id', id).order('created_at', { ascending: false })),
  ]);
  const p = $('#panel');
  const field = (k, label, type = 'text', cls = '') => `<label class="f ${cls}">${label}<input type="${type}" data-k="${k}" value="${esc(c[k] ?? '')}"></label>`;
  const sel = (k, label, opts) => `<label class="f">${label}<select data-k="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(c[k] ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const care = CARE[c.care_plan];
  p.innerHTML = `
  <div class="p-head"><h2>${esc(c.business || c.name)}</h2><span class="saved" id="saved">Opgeslagen</span>
    <button class="btn btn-ghost btn-sm" id="p-close" aria-label="Sluiten">${icon('x')}</button></div>
  <div class="p-body">
    <div class="card"><h2>Status</h2>
      <div class="stages" id="stages">${STAGES.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${c.stage === k}">${l}</button>`).join('')}</div>
      <div class="fields" style="margin-top:14px">
        <label class="f full">Vooruitgang: <span id="prog-v">${c.progress}%</span><input type="range" min="0" max="100" step="5" data-k="progress" value="${c.progress}"></label>
        ${field('next_step', 'Volgende stap', 'text', 'full')}
        ${field('next_date', 'Wanneer', 'date')}
        ${field('deadline', 'Deadline', 'date')}
      </div>
    </div>
    <div class="card"><h2>Gegevens</h2><div class="fields">
      ${field('name', 'Contactpersoon')}${field('business', 'Zaak')}
      ${field('email', 'E-mail', 'email')}${field('phone', 'Telefoon', 'tel')}
      ${field('city', 'Stad')}${field('sector', 'Sector')}
      ${field('website', 'Huidige site', 'url', 'full')}
      ${field('preview_url', 'Link bijna klare versie', 'url', 'full')}
      ${field('site_url', 'Live site', 'url', 'full')}
    </div></div>
    <div class="card"><h2>Pakket en betalingen</h2><div class="fields">
      ${sel('package', 'Pakket', [['', 'Nog niet gekozen'], ...Object.entries(PACKAGES)])}
      ${field('price', 'Prijs (€)', 'number')}
      ${field('addons', 'Extra’s', 'text', 'full')}
    </div>
    <div style="margin-top:14px">${payments.length ? payments.map((pay) => `
      <div class="pay"><input type="checkbox" data-pay="${pay.id}" ${pay.paid_at ? 'checked' : ''} aria-label="Betaald">
      <span>${esc(pay.label)}${pay.paid_at ? ` <small class="date">betaald ${fmtDate(pay.paid_at)}</small>` : ''}</span>
      <span class="amt">${eur(pay.amount)}</span>
      <button class="btn btn-ghost btn-sm" data-delpay="${pay.id}" aria-label="Verwijder">${icon('x')}</button></div>`).join('')
      : `<button class="btn btn-ghost btn-sm" id="mk-pay" ${c.price ? '' : 'disabled'}>Maak schijven 30/40/30</button>${c.price ? '' : ' <small class="date">vul eerst de prijs in</small>'}`}
    </div></div>
    <div class="card"><h2>Beheer</h2><div class="fields">
      ${sel('care_plan', 'Plan', Object.entries(CARE).map(([k, v]) => [k, v.price ? `${v.label} (${eur(v.price)}/maand, ${v.minutes} min)` : v.label]))}
      ${field('care_since', 'Sinds', 'date')}
      ${c.care_plan !== 'geen' ? `
      <label class="f">Minuten deze maand: <span>${c.care_minutes_used} / ${care.minutes}</span>
        <div class="bar"><i style="width:${Math.min(100, (c.care_minutes_used / care.minutes) * 100)}%;${c.care_minutes_used > care.minutes ? 'background:var(--red)' : ''}"></i></div></label>
      <div style="display:flex;gap:8px;align-items:end"><button class="btn btn-ghost btn-sm" data-min="15">+15 min</button><button class="btn btn-ghost btn-sm" data-min="30">+30 min</button><button class="btn btn-ghost btn-sm" data-min="reset">Nieuwe maand</button></div>
      ${field('care_last_report', 'Laatste rapport', 'date')}` : ''}
    </div></div>
    ${quest.length ? `<div class="card"><h2>Vragenlijst</h2><dl class="qa">${Object.entries(quest[0].answers || {}).filter(([k, val]) => val && !k.startsWith('_')).map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(val) ? val.join(', ') : val)}</dd>`).join('')}</dl></div>` : ''}
    ${bookings.length ? `<div class="card"><h2>Gesprekken</h2><div class="list">${bookings.map((b) => `<div class="row" style="cursor:default"><div class="main"><b>${fmtDT(b.start_time)}</b><span>${esc(b.location || '')}</span></div><span class="pill ${b.status === 'geannuleerd' ? 'red' : ''}">${esc(b.status)}</span></div>`).join('')}</div></div>` : ''}
    <div class="card"><h2>Notities en geschiedenis</h2>
      <form id="note-form" style="display:flex;gap:8px;margin-bottom:14px"><input type="text" id="note" placeholder="Wat gebeurde er?"><button class="btn btn-blue btn-sm">Bewaar</button></form>
      <div class="log">${act.map((a) => `<div><time>${fmtDT(a.created_at)}</time><span>${esc(a.text)}</span></div>`).join('') || '<p class="empty">Nog niets.</p>'}</div>
    </div>
    <button class="btn btn-ghost btn-sm" id="del-client" style="justify-self:start;color:var(--red-deep)">Klant verwijderen</button>
  </div>`;
  p.removeAttribute('inert');
  requestAnimationFrame(() => { p.classList.add('open'); $('#scrim').classList.add('open'); });
  $('#p-close').onclick = closePanel;

  const save = async (patch, log) => {
    await q(sb.from('clients').update(patch).eq('id', id));
    Object.assign(c, patch);
    if (log) await q(sb.from('activity').insert({ client_id: id, kind: 'status', text: log }));
    const s = $('#saved'); s.classList.add('show'); clearTimeout(s.t); s.t = setTimeout(() => s.classList.remove('show'), 1200);
  };
  p.querySelectorAll('[data-k]').forEach((inp) => {
    inp.onchange = async () => {
      const k = inp.dataset.k;
      let val = inp.value === '' ? null : inp.value;
      if (['price', 'progress'].includes(k) && val !== null) val = Number(val);
      await save({ [k]: val }, k === 'care_plan' ? 'Beheer: ' + CARE[val || 'geen'].label : null);
      if (['care_plan', 'price', 'package'].includes(k)) openClient(id);
    };
    if (inp.type === 'range') inp.oninput = () => ($('#prog-v').textContent = inp.value + '%');
  });
  p.querySelectorAll('[data-s]').forEach((b) => (b.onclick = async () => {
    const s = b.dataset.s;
    if (s === c.stage) return;
    const patch = { stage: s };
    if (ST[s].progress > c.progress || s === 'online') patch.progress = ST[s].progress;
    await save(patch, 'Status: ' + ST[s].label);
    openClient(id);
  }));
  const mk = $('#mk-pay');
  if (mk) mk.onclick = async () => {
    const pr = Number(c.price);
    const a = Math.round(pr * 0.3), b = Math.round(pr * 0.4);
    await q(sb.from('payments').insert([
      { client_id: id, label: 'Voorschot 30%', amount: a },
      { client_id: id, label: 'Na akkoord 40%', amount: b },
      { client_id: id, label: 'Oplevering 30%', amount: pr - a - b },
    ]));
    openClient(id);
  };
  p.querySelectorAll('[data-pay]').forEach((cb) => (cb.onchange = async () => {
    const paid = cb.checked ? new Date().toISOString().slice(0, 10) : null;
    await q(sb.from('payments').update({ paid_at: paid }).eq('id', cb.dataset.pay));
    const pay = payments.find((x) => x.id === cb.dataset.pay);
    if (paid) await q(sb.from('activity').insert({ client_id: id, kind: 'betaling', text: `${pay.label} ontvangen (${eur(pay.amount)})` }));
    openClient(id);
  }));
  p.querySelectorAll('[data-delpay]').forEach((b) => (b.onclick = async () => {
    if (!confirm('Deze schijf verwijderen?')) return;
    await q(sb.from('payments').delete().eq('id', b.dataset.delpay));
    openClient(id);
  }));
  p.querySelectorAll('[data-min]').forEach((b) => (b.onclick = async () => {
    const m = b.dataset.min;
    await save({ care_minutes_used: m === 'reset' ? 0 : c.care_minutes_used + Number(m) }, m === 'reset' ? 'Beheer: nieuwe maand' : `Beheer: ${m} min gewerkt`);
    openClient(id);
  }));
  $('#note-form').onsubmit = async (e) => {
    e.preventDefault();
    const t = $('#note').value.trim();
    if (!t) return;
    await q(sb.from('activity').insert({ client_id: id, kind: 'notitie', text: t }));
    openClient(id);
  };
  $('#del-client').onclick = async () => {
    if (!confirm(`${c.business || c.name} definitief verwijderen? Betalingen en notities verdwijnen mee.`)) return;
    await q(sb.from('clients').delete().eq('id', id));
    closePanel();
  };
}

/* ---------------- Beheer ---------------- */
async function beheer() {
  const v = $('#view');
  const clients = await q(sb.from('clients').select('*').neq('care_plan', 'geen').order('business'));
  const mrr = clients.reduce((s, c) => s + CARE[c.care_plan].price, 0);
  v.innerHTML = header('Beheer', `${clients.length} klanten · ${eur(mrr)} per maand · ${eur(mrr * 12)} per jaar`) + `
  <div class="card">${clients.length ? `<table><thead><tr><th>Klant</th><th>Plan</th><th class="hide-sm">Sinds</th><th class="num">Minuten</th><th class="hide-sm">Laatste rapport</th><th class="num">Per maand</th></tr></thead><tbody>
  ${clients.map((c) => {
    const care = CARE[c.care_plan], over = c.care_minutes_used > care.minutes;
    const reportLate = !c.care_last_report || new Date(c.care_last_report) < new Date(Date.now() - 35 * 864e5);
    return `<tr class="click" data-open="${c.id}"><td><b>${esc(c.business || c.name)}</b><br><small class="date">${esc(c.site_url || '')}</small></td>
    <td><span class="pill green">${care.label}</span></td><td class="hide-sm date">${fmtDate(c.care_since)}</td>
    <td class="num ${over ? 'date late' : ''}">${c.care_minutes_used}/${care.minutes}</td>
    <td class="hide-sm date ${reportLate ? 'late' : ''}">${c.care_last_report ? fmtDate(c.care_last_report) : 'nog geen'}</td>
    <td class="num"><b>${eur(care.price)}</b></td></tr>`;
  }).join('')}</tbody></table>` : '<p class="empty">Nog geen beheerklanten. Kies een plan in de fiche van een klant.</p>'}</div>`;
  v.querySelectorAll('[data-open]').forEach((r) => (r.onclick = () => (location.hash = 'klanten/' + r.dataset.open)));
}

/* ---------------- Site ---------------- */
let range = 30;
async function site() {
  const v = $('#view');
  const ev = await q(sb.from('site_events').select('*').gte('created_at', daysAgo(range)).order('created_at').limit(20000));
  const views = ev.filter((e) => e.type === 'view'), clicks = ev.filter((e) => e.type === 'click');
  const visitors = new Set(views.map((e) => e.sid)).size;
  const days = [...Array(range)].map((_, i) => { const d = new Date(Date.now() - (range - 1 - i) * 864e5); return d.toISOString().slice(0, 10); });
  const perDay = Object.fromEntries(days.map((d) => [d, { v: new Set(), c: 0 }]));
  views.forEach((e) => perDay[e.created_at.slice(0, 10)]?.v.add(e.sid));
  clicks.forEach((e) => perDay[e.created_at.slice(0, 10)] && perDay[e.created_at.slice(0, 10)].c++);
  const count = (arr, key) => Object.entries(arr.reduce((m, e) => { const k = e[key] || '(direct)'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top = (rows) => { const max = rows[0]?.[1] || 1; return rows.length ? rows.map(([k, n]) => `<div><i style="transform:scaleX(${n / max})"></i><span>${esc(k)}</span><b>${n}</b></div>`).join('') : '<p class="empty">Nog geen data.</p>'; };

  const W = 720, H = 200, bw = W / range;
  const max = Math.max(1, ...days.map((d) => perDay[d].v.size));
  const bars = days.map((d, i) => {
    const h = (perDay[d].v.size / max) * (H - 30), hc = Math.min(h, (perDay[d].c / max) * (H - 30));
    return `<rect x="${i * bw + 2}" y="${H - 20 - h}" width="${bw - 4}" height="${h}" rx="3"><title>${d}: ${perDay[d].v.size} bezoekers, ${perDay[d].c} klikken</title></rect>
      ${hc ? `<rect class="cta" x="${i * bw + 2}" y="${H - 20 - hc}" width="${bw - 4}" height="${hc}" rx="3"/>` : ''}
      ${i % Math.ceil(range / 7) === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${fmtDate(d)}</text>` : ''}`;
  }).join('');

  v.innerHTML = header('Site', 'Bezoek op dobbo.be, zonder cookies',
    `<div class="seg">${[7, 30, 90].map((n) => `<button data-range="${n}" aria-pressed="${range === n}">${n} d</button>`).join('')}</div>`) + `
  <div class="kpis">
    <div class="kpi"><span>Bezoekers</span><b>${visitors}</b></div>
    <div class="kpi"><span>Paginaweergaven</span><b>${views.length}</b></div>
    <div class="kpi"><span>Klikken op boeken</span><b>${clicks.filter((c) => /boek|gesprek|cal/i.test(c.label || '')).length}</b></div>
    <div class="kpi"><span>Klik per bezoeker</span><b>${visitors ? Math.round((clicks.length / visitors) * 100) : 0}%</b></div>
  </div>
  <div class="card" style="margin-bottom:16px"><h2>Per dag</h2><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>
    <div class="legend"><span><i style="background:var(--blue)"></i>Bezoekers</span><span><i style="background:var(--red)"></i>Klikken</span></div></div>
  <div class="two">
    <div class="card"><h2>Pagina's</h2><div class="toplist">${top(count(views, 'path'))}</div></div>
    <div class="card"><h2>Komt van</h2><div class="toplist">${top(count(views, 'ref'))}</div></div>
    <div class="card"><h2>Kliks</h2><div class="toplist">${top(count(clicks, 'label'))}</div></div>
    <div class="card"><h2>Toestel en taal</h2><div class="toplist">${top([...count(views, 'device'), ...count(views, 'lang')])}</div></div>
  </div>`;
  v.querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => { range = Number(b.dataset.range); site(); }));
}

/* ---------------- Outreach ---------------- */
async function outreach() {
  $('#view').innerHTML = header('Outreach', 'Komt in een volgende versie') +
    '<div class="card"><p class="empty">Hier komen later je prospects, verstuurde mails en antwoorden. Leads uit outreach kan je nu al als klant toevoegen met bron "outreach".</p></div>';
}

boot();
