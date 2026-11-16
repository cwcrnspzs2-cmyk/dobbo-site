import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, OWNER_EMAIL } from './config.js?v=6';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- De werf: zeven fases van eerste gesprek tot online ---------------- */
const STAGES = [
  ['lead', 'Lead', 0],
  ['gesprek', 'Gesprek', 5],
  ['voorschot', 'Voorschot', 10],
  ['info', 'Info', 25],
  ['versie', 'Bijna klaar', 60],
  ['afwerken', 'Afwerken', 85],
  ['online', 'Online', 100],
];
const LONG = { lead: 'Lead', gesprek: 'Gesprek gepland', voorschot: 'Wacht op voorschot', info: 'Info verzamelen', versie: 'Bijna klare versie', afwerken: 'Afwerken', online: 'Online', verloren: 'Niet doorgegaan' };
const STAGE_I = Object.fromEntries(STAGES.map(([k], i) => [k, i]));
const PACKAGES = { start: 'Start', groei: 'Groei', systeem: 'Systeem' };
const CARE = { geen: { label: 'Geen', price: 0, minutes: 0 }, beheer: { label: 'Beheer', price: 50, minutes: 30 }, beheer_plus: { label: 'Beheer+', price: 100, minutes: 120 } };
const BUILDING = ['voorschot', 'info', 'versie', 'afwerken'];
const payOrder = (p) => { const i = ['Voorschot', 'Na akkoord', 'Oplevering'].findIndex((w) => p.label.startsWith(w)); return i < 0 ? 9 : i; };

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const ROUTES = [['overzicht', 'Overzicht', 'home'], ['klanten', 'Klanten', 'users'], ['beheer', 'Beheer', 'shield'], ['site', 'Site', 'chart']];

/* ---------------- Hulpjes ---------------- */
const eur = (n) => '€' + Number(n || 0).toLocaleString('nl-BE', { maximumFractionDigits: 0 });
const today = () => new Date(new Date().toDateString());
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '');
const fmtDT = (d) => new Date(d).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtShort = (d) => { const x = new Date(d), t = today(); return x >= t ? x.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }) : x.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }); };
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();
const isLate = (d) => d && new Date(d) < today();
const when = (d) => {
  if (!d) return '';
  const diff = Math.round((new Date(d) - today()) / 864e5);
  if (diff === 0) return 'vandaag';
  if (diff === 1) return 'morgen';
  if (diff < 0) return diff === -1 ? 'gisteren' : `${-diff} dagen te laat`;
  return fmtDate(d);
};
const title = (c) => esc(c.business || c.name);
const sub = (c) => esc(c.business ? c.name : c.email || '');

/** Werflijn: zeven segmentjes, gevuld tot de huidige fase. */
function track(stage, big = false) {
  const i = STAGE_I[stage] ?? -1;
  const cls = stage === 'online' ? ' done' : stage === 'verloren' ? ' stop' : '';
  return `<div class="track${big ? ' big' : ''}${cls}" role="img" aria-label="${LONG[stage]}">${STAGES.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>`;
}

function toast(t) {
  const el = $('#toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}
async function q(promise) {
  const { data, error } = await promise;
  if (error) { console.error(error); toast('Niet gelukt: ' + error.message); throw error; }
  return data;
}
/** Toon "Laden…" pas na 300 ms, zodat snelle antwoorden niet flitsen. */
function loading(v) { const t = setTimeout(() => { if (!v.dataset.ready) v.innerHTML = '<p class="empty">Laden…</p>'; }, 300); return () => { clearTimeout(t); v.dataset.ready = '1'; }; }

/* ---------------- Login ---------------- */
async function boot() {
  try { localStorage.setItem('dobbo_notrack', '1'); } catch (e) {} // eigen bezoeken aan dobbo.be niet meetellen
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
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
        const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        sent = true;
        code.classList.remove('hidden');
        btn.textContent = 'Inloggen met code';
        msg.textContent = 'Mail verstuurd. Klik op de link erin, of vul de code in als die erin staat.';
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
  const links = ROUTES.map(([id, label, ic]) => `<a href="#${id}" data-r="${id}">${icon(ic)}<span>${label}</span></a>`).join('');
  $('#nav').innerHTML = links;
  $('#tabbar').innerHTML = links;
  window.addEventListener('hashchange', route);
  $('#scrim').onclick = () => closePanel();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  route();
}

let current = '';
function route() {
  const [r, id] = (location.hash.slice(1) || 'overzicht').split('/');
  $$('[data-r]').forEach((a) => (a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const view = { overzicht, klanten, beheer, site }[r] || overzicht;
  if (r !== current || !id) { current = r; delete $('#view').dataset.ready; view().catch(() => {}); }
  if (r === 'klanten' && id) id === 'nieuw' ? openNew() : openClient(id);
  else closePanel(true);
}
const refresh = () => ({ overzicht, klanten, beheer, site }[current] || overzicht)().catch(() => {});

function header(h, p, actions = '') {
  return `<div class="top"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ''}</div>${actions}</div>`;
}
const newBtn = `<a class="btn btn-blue" href="#klanten/nieuw">${icon('plus')}Nieuwe klant</a>`;
const bindRows = (v) => $$('[data-open]', v).forEach((r) => {
  r.onclick = () => (location.hash = 'klanten/' + r.dataset.open);
  r.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } };
});

/* ---------------- Overzicht ---------------- */
async function overzicht() {
  const v = $('#view'), done = loading(v);
  const [clients, payments, act, events, bookings] = await Promise.all([
    q(sb.from('clients').select('*')),
    q(sb.from('payments').select('amount,paid_at')),
    q(sb.from('activity').select('*, clients(name,business)').order('created_at', { ascending: false }).limit(10)),
    q(sb.from('site_events').select('type,sid').gte('created_at', daysAgo(7))),
    q(sb.from('bookings').select('*').eq('status', 'gepland').gte('start_time', new Date().toISOString()).order('start_time').limit(5)),
  ]);
  done();
  const open = payments.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const mrr = clients.filter((c) => c.stage !== 'verloren').reduce((s, c) => s + CARE[c.care_plan].price, 0);
  const visitors = new Set(events.filter((e) => e.type === 'view').map((e) => e.sid)).size;
  const todo = clients
    .filter((c) => c.next_step && c.stage !== 'verloren')
    .sort((a, b) => (a.next_date || '9999') < (b.next_date || '9999') ? -1 : 1);

  const stat = (val, label) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;
  v.innerHTML = header('Overzicht', new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }), newBtn) + `
  <div class="card stats">
    ${stat(eur(open), 'Nog te ontvangen')}
    ${stat(eur(mrr), 'Beheer per maand')}
    ${stat(clients.filter((c) => BUILDING.includes(c.stage)).length, 'Sites in opbouw')}
    ${stat(clients.filter((c) => c.created_at > daysAgo(7)).length, 'Nieuwe leads, 7 d')}
    ${stat(visitors, 'Bezoekers, 7 d')}
    ${stat(events.filter((e) => e.type === 'click').length, 'Klikken, 7 d')}
  </div>
  <div class="overview">
    <section class="card"><h2>Te doen</h2>${todo.length ? `<div class="rows">${todo.map((c) => `
      <div class="r" data-open="${c.id}" tabindex="0">
        <div><div class="t">${esc(c.next_step)}</div><div class="s">${title(c)}</div></div>
        <div class="end">${track(c.stage)}<span class="date ${isLate(c.next_date) ? 'late' : ''}">${when(c.next_date)}</span></div>
      </div>`).join('')}</div>`
      : clients.length ? '<p class="empty">Niets gepland. Zet een volgende stap in de fiche van een klant.</p>'
      : `<p class="empty">Nog geen klanten. Boekingen via dobbo.be komen hier vanzelf binnen.</p>${newBtn.replace('btn-blue', 'btn-ghost btn-sm')}`}
    </section>
    <div class="stack">
      <section class="card"><h2>Gesprekken</h2>${bookings.length ? `<div class="rows">${bookings.map((b) => `
        <div class="r${b.client_id ? '' : ' static'}" ${b.client_id ? `data-open="${b.client_id}" tabindex="0"` : ''}>
          <div><div class="t">${esc(b.business || b.name)}</div><div class="s">${esc(b.name)}</div></div>
          <span class="date">${fmtDT(b.start_time)}</span></div>`).join('')}</div>` : '<p class="empty">Niets geboekt.</p>'}</section>
      <section class="card"><h2>Activiteit</h2>${act.length ? `<div class="log">${act.map((a) => `
        <div><time>${fmtShort(a.created_at)}</time><span>${a.clients ? `<b>${esc(a.clients.business || a.clients.name)}</b> · ` : ''}${esc(a.text)}</span></div>`).join('')}</div>` : '<p class="empty">Nog niets gebeurd.</p>'}</section>
    </div>
  </div>`;
  bindRows(v);
}

/* ---------------- Klanten ---------------- */
let filter = '', view = 'lopend';
async function klanten() {
  const v = $('#view'), done = loading(v);
  const clients = await q(sb.from('clients').select('*').order('next_date', { ascending: true, nullsFirst: false }));
  done();
  const groups = { lopend: clients.filter((c) => !['online', 'verloren'].includes(c.stage)), online: clients.filter((c) => c.stage === 'online'), gestopt: clients.filter((c) => c.stage === 'verloren') };
  const f = filter.toLowerCase();
  const shown = groups[view].filter((c) => !f || [c.name, c.business, c.email, c.city].join(' ').toLowerCase().includes(f));
  const row = (c) => `
    <div class="r client" data-open="${c.id}" tabindex="0">
      <div><div class="t">${title(c)}</div><div class="s">${sub(c)}</div></div>
      <div class="next">${esc(c.next_step || '')}${c.next_date ? ` <span class="date ${isLate(c.next_date) ? 'late' : ''}">· ${when(c.next_date)}</span>` : ''}</div>
      <div class="end">${c.care_plan !== 'geen' ? `<span class="tag green">${CARE[c.care_plan].label}</span>` : ''}${track(c.stage)}</div>
    </div>`;
  let body;
  if (!shown.length) body = `<div class="card"><p class="empty">${f ? 'Niets gevonden.' : view === 'lopend' ? 'Geen lopende werven.' : view === 'online' ? 'Nog geen sites online.' : 'Niemand afgehaakt.'}</p></div>`;
  else if (view === 'lopend') {
    body = `<section class="card">${STAGES.slice(0, 6).map(([k]) => { const list = shown.filter((c) => c.stage === k); return list.length ? `<div class="group"><h3>${LONG[k]}<small>${list.length}</small></h3><div class="rows">${list.map(row).join('')}</div></div>` : ''; }).join('')}</section>`;
  } else body = `<section class="card"><div class="rows">${shown.map(row).join('')}</div></section>`;

  v.innerHTML = header('Klanten', '', newBtn) + `
  <div class="toolbar">
    <div class="seg" role="group" aria-label="Toon">${[['lopend', 'Lopend'], ['online', 'Online'], ['gestopt', 'Gestopt']].map(([k, l]) => `<button type="button" data-view="${k}" aria-pressed="${view === k}">${l}<em>${groups[k].length}</em></button>`).join('')}</div>
    <input type="text" id="search" placeholder="Zoek op naam, zaak of stad" value="${esc(filter)}" aria-label="Zoek">
  </div>${body}`;
  bindRows(v);
  $$('[data-view]', v).forEach((b) => (b.onclick = () => { view = b.dataset.view; klanten(); }));
  const s = $('#search');
  s.oninput = () => { filter = s.value; clearTimeout(s.t); s.t = setTimeout(() => klanten().then(() => { const n = $('#search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 200); };
}

/* ---------------- Paneel ---------------- */
let lastFocus = null;
function showPanel(html, key) {
  const p = $('#panel');
  const same = p.classList.contains('open') && p.dataset.key === key;
  const scroll = same ? $('.p-body', p)?.scrollTop || 0 : 0;
  p.innerHTML = html;
  p.dataset.key = key;
  if (scroll) $('.p-body', p).scrollTop = scroll; // bewaren bij elke wijziging: niet terug naar boven springen
  if (!same) {
    lastFocus = document.activeElement;
    p.removeAttribute('inert');
    requestAnimationFrame(() => { p.classList.add('open'); $('#scrim').classList.add('open'); });
    setTimeout(() => $('[data-close]', p)?.focus({ preventScroll: true }), 50);
  }
  $('[data-close]', p).onclick = () => closePanel();
}
function closePanel(quiet) {
  const p = $('#panel');
  if (!p.classList.contains('open')) return;
  p.classList.remove('open');
  p.setAttribute('inert', '');
  $('#scrim').classList.remove('open');
  if (location.hash.startsWith('#klanten/')) history.replaceState(null, '', '#klanten');
  lastFocus?.focus?.({ preventScroll: true });
  if (quiet !== true) refresh();
}
const head = (h, extra = '') => `<div class="p-head"><h2>${h}</h2>${extra}<button class="icon-btn" type="button" data-close aria-label="Sluiten">${icon('x')}</button></div>`;

function openNew() {
  showPanel(head('Nieuwe klant') + `
  <form class="p-body" id="new-form">
    <div class="card"><div class="fields">
      <label class="f full">Naam van de zaak<input type="text" name="business" autocomplete="off"></label>
      <label class="f">Contactpersoon<input type="text" name="name" required autocomplete="off"></label>
      <label class="f">Telefoon<input type="tel" name="phone" autocomplete="off"></label>
      <label class="f full">E-mail<input type="email" name="email" autocomplete="off"></label>
      <label class="f full">Hoe kwam die binnen?<select name="source"><option value="manueel">Zelf toegevoegd</option><option value="outreach">Outreach</option><option value="doorverwezen">Doorverwezen</option></select></label>
    </div></div>
    <button class="btn btn-blue" type="submit" style="justify-self:start">Klant aanmaken</button>
  </form>`, 'nieuw');
  const form = $('#new-form');
  setTimeout(() => form.business.focus(), 300);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form); btn.disabled = true;
    const d = Object.fromEntries(new FormData(form));
    if (!d.name) d.name = d.business;
    try {
      const [c] = await q(sb.from('clients').insert({ ...d, email: d.email?.toLowerCase() || null }).select());
      await q(sb.from('activity').insert({ client_id: c.id, kind: 'status', text: 'Klant aangemaakt' }));
      $('#panel').dataset.key = '';
      history.replaceState(null, '', '#klanten/' + c.id);
      openClient(c.id);
    } catch { btn.disabled = false; }
  };
}

async function openClient(id) {
  const [c] = await q(sb.from('clients').select('*').eq('id', id));
  if (!c) return toast('Klant niet gevonden');
  const [payments, act, bookings, quest] = await Promise.all([
    q(sb.from('payments').select('*').eq('client_id', id)).then((ps) => ps.sort((a, b) => payOrder(a) - payOrder(b) || a.created_at.localeCompare(b.created_at))),
    q(sb.from('activity').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(40)),
    q(sb.from('bookings').select('*').eq('client_id', id).order('start_time', { ascending: false })),
    q(sb.from('questionnaires').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1)),
  ]);
  const field = (k, label, type = 'text', cls = '') => `<label class="f ${cls}">${label}<input type="${type}" data-k="${k}" value="${esc(c[k] ?? '')}"></label>`;
  const sel = (k, label, opts, cls = '') => `<label class="f ${cls}">${label}<select data-k="${k}">${opts.map(([val, l]) => `<option value="${val}" ${String(c[k] ?? '') === val ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const link = (u) => u ? `<a href="${esc(/^https?:/.test(u) ? u : 'https://' + u)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">${icon('ext')}${esc(u.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '';
  const care = CARE[c.care_plan];
  const paid = payments.filter((x) => x.paid_at).reduce((s, x) => s + Number(x.amount), 0);
  const total = payments.reduce((s, x) => s + Number(x.amount), 0);
  const stopped = c.stage === 'verloren';

  showPanel(head(title(c), '<span class="saved" id="saved" role="status">Bewaard</span>') + `
  <div class="p-body">
    <section class="card">
      <h2>${LONG[c.stage]}${stopped ? '' : `<small>${STAGE_I[c.stage] + 1} van 7</small>`}</h2>
      ${track(c.stage, true)}
      <div class="track-labels" role="group" aria-label="Fase">${STAGES.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${c.stage === k}">${l}</button>`).join('')}</div>
      <div class="fields" style="margin-top:16px">
        ${field('next_step', 'Volgende stap', 'text', 'full')}
        ${field('next_date', 'Wanneer', 'date')}
        ${field('deadline', 'Deadline', 'date')}
      </div>
    </section>

    <section class="card"><h2>Contact</h2><div class="fields">
      ${field('business', 'Zaak')}${field('name', 'Contactpersoon')}
      ${field('email', 'E-mail', 'email')}${field('phone', 'Telefoon', 'tel')}
      ${field('city', 'Stad')}${field('sector', 'Sector')}
    </div></section>

    <section class="card"><h2>Sites</h2><div class="fields">
      ${field('website', 'Huidige site', 'url', 'full')}
      ${field('preview_url', 'Bijna klare versie', 'url', 'full')}
      ${field('site_url', 'Live site', 'url', 'full')}
    </div>${[c.website, c.preview_url, c.site_url].some(Boolean) ? `<div class="minutes" style="margin-top:12px">${link(c.preview_url)}${link(c.site_url)}${link(c.website)}</div>` : ''}</section>

    <section class="card"><h2>Pakket en betalingen${total ? `<small class="num">${eur(paid)} van ${eur(total)}</small>` : ''}</h2>
      <div class="fields">
        ${sel('package', 'Pakket', [['', 'Nog niet gekozen'], ...Object.entries(PACKAGES)])}
        ${field('price', 'Prijs in euro', 'number')}
        ${field('addons', 'Extra’s', 'text', 'full')}
      </div>
      <div style="margin-top:12px">${payments.length ? payments.map((x) => `
        <div class="pay${x.paid_at ? ' paid' : ''}"><input type="checkbox" data-pay="${x.id}" ${x.paid_at ? 'checked' : ''} aria-label="${esc(x.label)} betaald">
          <span class="lbl">${esc(x.label)}${x.paid_at ? ` <span class="date">· ${fmtDate(x.paid_at)}</span>` : ''}</span>
          <span class="amt">${eur(x.amount)}</span>
          <button class="btn btn-text btn-sm" type="button" data-delpay="${x.id}" aria-label="Schijf verwijderen">${icon('x')}</button></div>`).join('')
        : c.price ? `<button class="btn btn-ghost btn-sm" type="button" id="mk-pay">Schijven 30/40/30 aanmaken</button>` : '<p class="empty">Vul een prijs in om de schijven aan te maken.</p>'}
      </div>
    </section>

    <section class="card"><h2>Beheer</h2><div class="fields">
      ${sel('care_plan', 'Plan', Object.entries(CARE).map(([k, x]) => [k, x.price ? `${x.label}: ${eur(x.price)} per maand, ${x.minutes} min` : 'Geen beheer']), 'full')}
      ${c.care_plan !== 'geen' ? `${field('care_since', 'Sinds', 'date')}${field('care_last_report', 'Laatste maandrapport', 'date')}` : ''}
    </div>${c.care_plan !== 'geen' ? `
      <div style="margin-top:16px"><div class="date">Deze maand: <b class="num ${c.care_minutes_used > care.minutes ? 'late' : ''}">${c.care_minutes_used} van ${care.minutes} min</b></div>
      <div class="meter${c.care_minutes_used > care.minutes ? ' over' : ''}"><i style="transform:scaleX(${Math.min(1, c.care_minutes_used / care.minutes)})"></i></div>
      <div class="minutes"><button class="btn btn-ghost btn-sm" type="button" data-min="15">+15 min</button><button class="btn btn-ghost btn-sm" type="button" data-min="30">+30 min</button><button class="btn btn-text btn-sm" type="button" data-min="reset">Nieuwe maand</button></div></div>` : ''}
    </section>

    ${quest.length ? `<section class="card"><h2>Vragenlijst<small>${fmtDate(quest[0].created_at)}</small></h2><dl class="qa">${Object.entries(quest[0].answers || {}).filter(([k, x]) => x && !/^(Naam|email|Zaak|Huidige website)$/.test(k)).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${esc(Array.isArray(x) ? x.join(', ') : x)}</dd>`).join('')}</dl></section>` : ''}
    ${bookings.length ? `<section class="card"><h2>Gesprekken</h2><div class="rows">${bookings.map((b) => `<div class="r static"><div class="t">${fmtDT(b.start_time)}</div>${b.status === 'geannuleerd' ? '<span class="tag red">Geannuleerd</span>' : ''}</div>`).join('')}</div></section>` : ''}

    <section class="card"><h2>Notities</h2>
      <form class="note-form" id="note-form"><input type="text" id="note" placeholder="Wat gebeurde er?" aria-label="Notitie"><button class="btn btn-blue btn-sm" type="submit">Bewaar</button></form>
      <div class="log">${act.map((a) => `<div><time>${fmtShort(a.created_at)}</time><span>${esc(a.text)}</span></div>`).join('') || '<p class="empty">Nog niets.</p>'}</div>
    </section>

    <div class="minutes">
      ${stopped ? '' : '<button class="btn btn-text btn-sm" type="button" data-s="verloren">Niet doorgegaan</button>'}
      <button class="btn btn-danger btn-sm" type="button" id="del-client">Klant verwijderen</button>
    </div>
  </div>`, 'c:' + id);

  const p = $('#panel');
  const flash = () => { const s = $('#saved'); s.classList.add('show'); clearTimeout(flash.t); flash.t = setTimeout(() => s.classList.remove('show'), 1200); };
  const save = async (patch, log) => {
    await q(sb.from('clients').update(patch).eq('id', id));
    Object.assign(c, patch);
    if (log) await q(sb.from('activity').insert({ client_id: id, kind: 'status', text: log }));
    flash();
  };
  $$('[data-k]', p).forEach((inp) => {
    inp.onchange = async () => {
      const k = inp.dataset.k;
      let val = inp.value.trim() === '' ? null : inp.value.trim();
      if (k === 'price' && val !== null) val = Number(val);
      await save({ [k]: val }, k === 'care_plan' ? 'Beheer: ' + CARE[val || 'geen'].label : null);
      if (['care_plan', 'price', 'business', 'name', 'website', 'preview_url', 'site_url'].includes(k)) openClient(id);
    };
  });
  // Fase: de werflijn schuift meteen op, de database volgt.
  $$('[data-s]', p).forEach((b) => (b.onclick = async () => {
    const s = b.dataset.s;
    if (s === c.stage) return;
    const i = STAGE_I[s] ?? -1;
    $$('.track.big i', p).forEach((seg, j) => seg.classList.toggle('on', j <= i));
    $$('.track-labels [data-s]', p).forEach((x) => x.setAttribute('aria-pressed', x.dataset.s === s));
    const patch = { stage: s, progress: STAGES[i]?.[2] ?? c.progress };
    if (s === 'online' && c.next_step === 'Gratis gesprek') Object.assign(patch, { next_step: null, next_date: null });
    await save(patch, 'Fase: ' + LONG[s]);
    openClient(id);
  }));
  const mk = $('#mk-pay');
  if (mk) mk.onclick = async () => {
    mk.disabled = true;
    const pr = Number(c.price), a = Math.round(pr * 0.3), b = Math.round(pr * 0.4);
    await q(sb.from('payments').insert([
      { client_id: id, label: 'Voorschot 30%', amount: a },
      { client_id: id, label: 'Na akkoord 40%', amount: b },
      { client_id: id, label: 'Oplevering 30%', amount: pr - a - b },
    ]));
    openClient(id);
  };
  $$('[data-pay]', p).forEach((cb) => (cb.onchange = async () => {
    cb.closest('.pay').classList.toggle('paid', cb.checked);
    const paidAt = cb.checked ? new Date().toISOString().slice(0, 10) : null;
    try {
      await q(sb.from('payments').update({ paid_at: paidAt }).eq('id', cb.dataset.pay));
      const x = payments.find((y) => y.id === cb.dataset.pay);
      if (paidAt) await q(sb.from('activity').insert({ client_id: id, kind: 'betaling', text: `${x.label} ontvangen (${eur(x.amount)})` }));
      openClient(id);
    } catch { cb.checked = !cb.checked; cb.closest('.pay').classList.toggle('paid', cb.checked); }
  }));
  $$('[data-delpay]', p).forEach((b) => (b.onclick = async () => {
    if (!confirm('Deze schijf verwijderen?')) return;
    await q(sb.from('payments').delete().eq('id', b.dataset.delpay));
    openClient(id);
  }));
  $$('[data-min]', p).forEach((b) => (b.onclick = async () => {
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
  const v = $('#view'), done = loading(v);
  const clients = await q(sb.from('clients').select('*').neq('care_plan', 'geen').order('business'));
  done();
  const mrr = clients.reduce((s, c) => s + CARE[c.care_plan].price, 0);
  v.innerHTML = header('Beheer', clients.length ? `${clients.length} ${clients.length === 1 ? 'klant' : 'klanten'} · ${eur(mrr * 12)} per jaar` : '') + `
  <section class="card">${clients.length ? `<table><thead><tr><th>Klant</th><th>Plan</th><th class="num">Minuten</th><th class="hide-sm">Maandrapport</th><th class="num">Per maand</th></tr></thead><tbody>
  ${clients.map((c) => {
    const care = CARE[c.care_plan], over = c.care_minutes_used > care.minutes;
    const reportLate = !c.care_last_report || new Date(c.care_last_report) < new Date(Date.now() - 35 * 864e5);
    return `<tr class="click" data-open="${c.id}" tabindex="0"><td><b>${title(c)}</b></td>
    <td>${care.label}</td>
    <td class="num ${over ? 'late' : ''}">${c.care_minutes_used} / ${care.minutes}</td>
    <td class="hide-sm date ${reportLate ? 'late' : ''}">${c.care_last_report ? fmtDate(c.care_last_report) : 'Nog geen'}</td>
    <td class="num">${eur(care.price)}</td></tr>`;
  }).join('')}</tbody><tfoot><tr><td colspan="4" class="hide-sm">Totaal</td><td class="num">${eur(mrr)}</td></tr></tfoot></table>`
    : '<p class="empty">Nog geen beheerklanten. Kies een plan in de fiche van een klant.</p>'}</section>`;
  bindRows(v);
}

/* ---------------- Site ---------------- */
let range = 30;
async function site() {
  const v = $('#view'), done = loading(v);
  const ev = await q(sb.from('site_events').select('*').gte('created_at', daysAgo(range)).order('created_at').limit(20000));
  done();
  const views = ev.filter((e) => e.type === 'view'), clicks = ev.filter((e) => e.type === 'click');
  const visitors = new Set(views.map((e) => e.sid)).size;
  const days = [...Array(range)].map((_, i) => new Date(Date.now() - (range - 1 - i) * 864e5).toISOString().slice(0, 10));
  const per = Object.fromEntries(days.map((d) => [d, { v: new Set(), c: 0 }]));
  views.forEach((e) => per[e.created_at.slice(0, 10)]?.v.add(e.sid));
  clicks.forEach((e) => { const d = per[e.created_at.slice(0, 10)]; if (d) d.c++; });
  const count = (arr, key, fallback) => Object.entries(arr.reduce((m, e) => { const k = e[key] || fallback; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const top = (rows) => { const max = rows[0]?.[1] || 1; return rows.length ? `<div class="toplist">${rows.map(([k, n]) => `<div><i style="transform:scaleX(${n / max})"></i><span>${esc(k)}</span><b>${n}</b></div>`).join('')}</div>` : '<p class="empty">Nog geen bezoek.</p>'; };

  const W = 720, H = 200, bw = W / range, max = Math.max(1, ...days.map((d) => per[d].v.size));
  const bars = days.map((d, i) => {
    const h = (per[d].v.size / max) * (H - 28), hc = Math.min(h, (per[d].c / max) * (H - 28));
    return `<rect x="${i * bw + 1.5}" y="${H - 20 - h}" width="${bw - 3}" height="${h}" rx="2"><title>${fmtDate(d)}: ${per[d].v.size} bezoekers, ${per[d].c} klikken</title></rect>
      ${hc ? `<rect class="cta" x="${i * bw + 1.5}" y="${H - 20 - hc}" width="${bw - 3}" height="${hc}" rx="2"/>` : ''}
      ${i % Math.ceil(range / 6) === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${fmtDate(d)}</text>` : ''}`;
  }).join('');
  const stat = (val, label) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;

  v.innerHTML = header('Site', 'Bezoek op dobbo.be, zonder cookies',
    `<div class="seg" role="group" aria-label="Periode">${[7, 30, 90].map((n) => `<button type="button" data-range="${n}" aria-pressed="${range === n}">${n} dagen</button>`).join('')}</div>`) + `
  <div class="card stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${stat(visitors, 'Bezoekers')}${stat(views.length, 'Paginaweergaven')}${stat(clicks.length, 'Klikken op boeken of mail')}${stat((visitors ? Math.round((clicks.length / visitors) * 100) : 0) + '%', 'Klikt door')}
  </div>
  <section class="card" style="margin-bottom:16px"><h2>Per dag</h2><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Bezoekers per dag">${bars}</svg>
    <div class="legend"><span><i style="background:var(--blue)"></i>Bezoekers</span><span><i style="background:var(--red)"></i>Klikken</span></div></section>
  <div class="site-grid">
    <section class="card"><h2>Pagina's</h2>${top(count(views, 'path', '/'))}</section>
    <section class="card"><h2>Komt van</h2>${top(count(views, 'ref', 'Rechtstreeks'))}</section>
    <section class="card"><h2>Waarop geklikt</h2>${top(count(clicks, 'label', 'Onbekend'))}</section>
    <section class="card"><h2>Toestel</h2>${top(count(views, 'device', 'Onbekend'))}</section>
  </div>`;
  $$('[data-range]', v).forEach((b) => (b.onclick = () => { range = Number(b.dataset.range); site(); }));
}

boot();
