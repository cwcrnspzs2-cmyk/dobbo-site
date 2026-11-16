import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, OWNER_EMAIL } from './config.js?v=7';

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
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

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

/* ---------------- Login en rollen ---------------- */
const DOBBO_SITE = '00000000-0000-4000-8000-00000000d0b0';
let ROLE = 'owner';      // 'owner' = Alec, 'client' = klant
let ME = null;           // client_users-rij van een klant
const OWNER_ROUTES = [['overzicht', 'Overzicht', 'home'], ['klanten', 'Klanten', 'users'], ['beheer', 'Beheer', 'shield'], ['site', 'Statistieken', 'chart']];
const CLIENT_ROUTES = [['bezoekers', 'Bezoekers', 'chart'], ['project', 'Mijn site', 'home'], ['rapporten', 'Rapporten', 'doc']];

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const { data: { session } } = await sb.auth.getSession();
  if (session) return start(session);
  showLogin();
  sb.auth.onAuthStateChange((_e, s) => { if (s && $('#app').classList.contains('hidden') && !start.busy) start(s); });
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
        const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        sent = true;
        code.classList.remove('hidden');
        code.focus();
        btn.textContent = 'Inloggen';
        msg.textContent = 'Check je mail. Vul de code in, of klik op de link.';
      } else {
        const { data, error } = await sb.auth.verifyOtp({ email: email.value.trim(), token: code.value.trim(), type: 'email' });
        if (error) throw error;
        start(data.session);
      }
    } catch (err) {
      msg.className = 'msg err';
      msg.textContent = /rate|limit/i.test(err.message) ? 'Even wachten, er zijn net te veel mails verstuurd.' : err.message;
    } finally { btn.disabled = false; }
  };
}

/** Scherm voor wie ingelogd is maar (nog) geen toegang heeft. */
function gate(html) {
  $('#app').classList.add('hidden');
  const l = $('#login');
  l.classList.remove('hidden');
  $('.login-card', l).innerHTML = `<img src="icons/icon-192.png" alt="">${html}<p class="msg"><button class="btn btn-text btn-sm" type="button" id="gate-out" style="padding-left:0">Uitloggen</button></p>`;
  $('#gate-out').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

async function start(session) {
  start.busy = true;
  const email = session.user.email.toLowerCase();
  ROLE = email === OWNER_EMAIL ? 'owner' : 'client';
  if (ROLE === 'owner') { try { localStorage.setItem('dobbo_notrack', '1'); } catch (e) {} } // eigen bezoek niet meetellen
  if (ROLE === 'client') {
    const { data } = await sb.from('client_users').select('*').eq('user_id', session.user.id).maybeSingle();
    ME = data;
    if (!ME) return requestForm(session);
    if (ME.status === 'aanvraag') return gate(`<h1>Aanvraag ontvangen</h1><p>We koppelen je account aan je site. Je krijgt een mail zodra je erin kan. Meestal binnen één werkdag.</p>`);
    if (ME.status === 'geweigerd' || !ME.client_id) return gate(`<h1>Geen toegang</h1><p>Dit account is niet gekoppeld aan een Dobbo-site. Denk je dat dit fout is? Mail <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a>.</p>`);
  }
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent = email;
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  const routes = ROLE === 'owner' ? OWNER_ROUTES : CLIENT_ROUTES;
  const links = routes.map(([id, label, ic]) => `<a href="#${id}" data-r="${id}">${icon(ic)}<span>${label}</span></a>`).join('');
  $('#nav').innerHTML = links;
  $('#tabbar').innerHTML = links;
  $('#tabbar').style.gridTemplateColumns = `repeat(${routes.length},1fr)`;
  $('.brand b').textContent = ROLE === 'owner' ? 'Dobbo HQ' : 'Dobbo';
  document.title = ROLE === 'owner' ? 'Dobbo HQ' : 'Dobbo';
  window.addEventListener('hashchange', route);
  $('#scrim').onclick = () => closePanel();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  route();
}

function requestForm(session) {
  gate(`<h1>Toegang aanvragen</h1><p>Met dit dashboard volg je het bezoek op je site, je project, je betalingen en onze rapporten. Vertel ons wie je bent, dan koppelen we je account.</p>
  <form id="req-form" style="display:grid;gap:12px;margin-top:24px">
    <label class="f">Je naam<input type="text" name="name" required autocomplete="name"></label>
    <label class="f">Naam van je zaak<input type="text" name="business" required autocomplete="organization"></label>
    <label class="f">Je website<input type="text" name="website" placeholder="jouwzaak.be" autocomplete="url"></label>
    <label class="f">Nog iets kwijt? (optioneel)<textarea name="message" rows="3"></textarea></label>
    <button class="btn btn-blue" type="submit">Vraag toegang aan</button>
    <p class="msg" id="req-msg" role="status"></p>
  </form>`);
  const f = $('#req-form');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', f); btn.disabled = true;
    const d = Object.fromEntries(new FormData(f));
    const { error } = await sb.from('client_users').insert({ user_id: session.user.id, email: session.user.email, ...d });
    if (error) { $('#req-msg').className = 'msg err'; $('#req-msg').textContent = 'Versturen lukte niet. Probeer opnieuw of mail ' + OWNER_EMAIL + '.'; btn.disabled = false; return; }
    start.busy = false; start(session);
  };
}

let current = '';
const OWNER_VIEWS = () => ({ overzicht, klanten, beheer, site });
const CLIENT_VIEWS = () => ({ bezoekers: () => clientBezoekers(ME.client_id), project: () => clientProject(ME.client_id), rapporten: () => clientRapporten(ME.client_id) });
function route() {
  const parts = (location.hash.slice(1) || (ROLE === 'owner' ? 'overzicht' : 'bezoekers')).split('/');
  const [r, id] = parts;
  delete $('#view').dataset.ready;
  // Alec bekijkt het dashboard van een klant: #als/<klant-id>/<tab>
  if (ROLE === 'owner' && r === 'als') {
    $$('[data-r]').forEach((a) => (a.dataset.r === 'klanten' ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    closePanel(true); current = 'als';
    const tab = parts[2] || 'bezoekers';
    return ({ bezoekers: clientBezoekers, project: clientProject, rapporten: clientRapporten }[tab] || clientBezoekers)(id, true).catch(() => {});
  }
  $$('[data-r]').forEach((a) => (a.dataset.r === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const views = ROLE === 'owner' ? OWNER_VIEWS() : CLIENT_VIEWS();
  const view = views[r] || Object.values(views)[0];
  if (r !== current || !id) { current = r; view().catch(() => {}); }
  if (ROLE === 'owner' && r === 'klanten' && id) id === 'nieuw' ? openNew() : openClient(id);
  else closePanel(true);
}
const refresh = () => { delete $('#view').dataset.ready; return ((ROLE === 'owner' ? OWNER_VIEWS() : CLIENT_VIEWS())[current] || (() => Promise.resolve()))().catch(() => {}); };

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
  const [clients, payments, act, events, bookings, requests] = await Promise.all([
    q(sb.from('clients').select('*')),
    q(sb.from('payments').select('amount,paid_at')),
    q(sb.from('activity').select('*, clients(name,business)').order('created_at', { ascending: false }).limit(10)),
    q(sb.from('site_events').select('type,sid').eq('site_id', DOBBO_SITE).gte('created_at', daysAgo(7))),
    q(sb.from('bookings').select('*').eq('status', 'gepland').gte('start_time', new Date().toISOString()).order('start_time').limit(5)),
    q(sb.from('client_users').select('*').eq('status', 'aanvraag').order('created_at')),
  ]);
  done();
  const open = payments.filter((p) => !p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
  const mrr = clients.filter((c) => c.stage !== 'verloren').reduce((s, c) => s + CARE[c.care_plan].price, 0);
  const visitors = new Set(events.filter((e) => e.type === 'view').map((e) => e.sid)).size;
  const todo = clients
    .filter((c) => c.next_step && c.stage !== 'verloren')
    .sort((a, b) => (a.next_date || '9999') < (b.next_date || '9999') ? -1 : 1);

  const stat = (val, label) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;
  const clientOpts = clients.filter((c) => c.stage !== 'verloren').sort((a, b) => (a.business || a.name).localeCompare(b.business || b.name));
  const reqCard = requests.length ? `<section class="card requests" style="margin-bottom:16px"><h2>Toegangsaanvragen<small>${requests.length}</small></h2>
    ${requests.map((r) => {
      const guess = clients.find((c) => c.email && c.email.toLowerCase() === (r.email || '').toLowerCase()) || clients.find((c) => r.business && (c.business || '').toLowerCase() === r.business.toLowerCase());
      return `<div class="req" data-req="${r.user_id}">
        <div><div class="t">${esc(r.business || r.email)}</div><div class="s">${esc(r.name || '')} · ${esc(r.email)}${r.website ? ' · ' + esc(r.website) : ''}</div>${r.message ? `<p class="s" style="white-space:normal;margin-top:4px">“${esc(r.message)}”</p>` : ''}</div>
        <div class="req-actions"><select aria-label="Koppel aan klant"><option value="nieuw">Nieuwe klant aanmaken</option>${clientOpts.map((c) => `<option value="${c.id}" ${guess && guess.id === c.id ? 'selected' : ''}>${title(c)}</option>`).join('')}</select>
        <button class="btn btn-blue btn-sm" type="button" data-grant>Geef toegang</button><button class="btn btn-text btn-sm" type="button" data-deny>Weiger</button></div></div>`;
    }).join('')}</section>` : '';
  v.innerHTML = header('Overzicht', new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' }), newBtn) + reqCard + `
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
  $$('[data-req]', v).forEach((row) => {
    const r = requests.find((x) => x.user_id === row.dataset.req);
    $('[data-grant]', row).onclick = async (e) => {
      e.target.disabled = true;
      let cid = $('select', row).value;
      if (cid === 'nieuw') {
        const [c] = await q(sb.from('clients').insert({ name: r.name || r.business || r.email, business: r.business, email: r.email?.toLowerCase(), website: r.website, source: 'aanvraag' }).select());
        cid = c.id;
      }
      await q(sb.from('client_users').update({ status: 'actief', client_id: cid }).eq('user_id', r.user_id));
      await q(sb.from('activity').insert({ client_id: cid, kind: 'status', text: 'Toegang tot dashboard gegeven aan ' + r.email }));
      toast('Toegang gegeven. Laat ' + (r.name || r.email) + ' weten dat het dashboard klaarstaat.');
      overzicht();
    };
    $('[data-deny]', row).onclick = async () => {
      if (!confirm('Aanvraag van ' + r.email + ' weigeren?')) return;
      await q(sb.from('client_users').update({ status: 'geweigerd' }).eq('user_id', r.user_id));
      overzicht();
    };
  });
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
  const [payments, act, bookings, quest, sites, users, reps] = await Promise.all([
    q(sb.from('payments').select('*').eq('client_id', id)).then((ps) => ps.sort((a, b) => payOrder(a) - payOrder(b) || a.created_at.localeCompare(b.created_at))),
    q(sb.from('activity').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(40)),
    q(sb.from('bookings').select('*').eq('client_id', id).order('start_time', { ascending: false })),
    q(sb.from('questionnaires').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(1)),
    q(sb.from('sites').select('*').eq('client_id', id).order('created_at')),
    q(sb.from('client_users').select('*').eq('client_id', id)),
    q(sb.from('reports').select('*').eq('client_id', id).order('created_at', { ascending: false })),
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

    <section class="card"><h2>Dashboard van de klant<a class="btn btn-ghost btn-sm" href="#als/${id}/bezoekers">${icon('eye')}Bekijk als klant</a></h2>
      <div class="sub-h">Accounts</div>
      ${users.length ? users.map((u) => `<div class="pay" style="grid-template-columns:1fr auto auto"><span class="lbl">${esc(u.email)}</span><span class="tag ${u.status === 'actief' ? 'green' : u.status === 'geweigerd' ? 'red' : ''}">${u.status === 'actief' ? 'Actief' : u.status === 'geweigerd' ? 'Geweigerd' : 'Aanvraag'}</span>
        <button class="btn btn-text btn-sm" type="button" data-revoke="${u.user_id}">${u.status === 'actief' ? 'Toegang intrekken' : 'Activeer'}</button></div>`).join('')
        : '<p class="empty">Nog geen account. De klant installeert de app via dobbo.be/software en vraagt daar toegang aan. Die aanvraag verschijnt op je overzicht.</p>'}
      <div class="sub-h" style="margin-top:16px">Gemeten sites</div>
      ${sites.map((x) => `<div class="site-row"><div class="pay" style="grid-template-columns:1fr auto"><span class="lbl">${esc(x.domain)}</span><button class="btn btn-text btn-sm" type="button" data-delsite="${x.id}" aria-label="Site verwijderen">${icon('x')}</button></div>
        <div class="snippet"><code>&lt;script src="https://dobbo.be/t.js" data-site="${x.id}" defer&gt;&lt;/script&gt;</code><button class="btn btn-ghost btn-sm" type="button" data-copy='<script src="https://dobbo.be/t.js" data-site="${x.id}" defer></script>'>${icon('copy')}Kopieer</button></div></div>`).join('')}
      <form class="note-form" id="site-form" style="margin:12px 0 0"><input type="text" name="domain" placeholder="domein.be" value="${sites.length ? '' : esc((c.site_url || c.website || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''))}" aria-label="Domein"><button class="btn btn-ghost btn-sm" type="submit">Site toevoegen</button></form>
      <p class="date" style="margin-top:8px">Plak het script net voor &lt;/body&gt; op elke pagina van de klantensite.</p>
    </section>

    <section class="card"><h2>Rapporten voor de klant</h2>
      <form id="rep-form" style="display:grid;gap:12px">
        <div class="fields"><label class="f">Titel<input type="text" name="title" required placeholder="Rapport november"></label><label class="f">Periode<input type="text" name="period" placeholder="November 2026"></label></div>
        <label class="f">Tekst<textarea name="body" rows="5" required placeholder="Wat we deden, wat de cijfers zeggen, wat we voorstellen."></textarea></label>
        <button class="btn btn-blue btn-sm" type="submit" style="justify-self:start">Publiceer voor de klant</button>
      </form>
      ${reps.length ? `<div class="rows" style="margin-top:12px">${reps.map((r) => `<div class="r static"><div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.period || fmtDate(r.created_at))}</div></div><button class="btn btn-text btn-sm" type="button" data-delrep="${r.id}">Verwijder</button></div>`).join('')}</div>` : ''}
    </section>

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
  $$('[data-copy]', p).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Script gekopieerd'); } catch { toast('Kopiëren lukte niet, selecteer de code'); } }));
  $('#site-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = e.target.domain.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!d) return;
    await q(sb.from('sites').insert({ client_id: id, domain: d }));
    openClient(id);
  };
  $$('[data-delsite]', p).forEach((b) => (b.onclick = async () => {
    if (!confirm('Deze site en al haar bezoekdata verwijderen?')) return;
    await q(sb.from('sites').delete().eq('id', b.dataset.delsite));
    openClient(id);
  }));
  $$('[data-revoke]', p).forEach((b) => (b.onclick = async () => {
    const u = users.find((x) => x.user_id === b.dataset.revoke), on = u.status !== 'actief';
    if (!on && !confirm('Toegang van ' + u.email + ' intrekken?')) return;
    await q(sb.from('client_users').update({ status: on ? 'actief' : 'geweigerd', client_id: id }).eq('user_id', u.user_id));
    openClient(id);
  }));
  $('#rep-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    await q(sb.from('reports').insert({ client_id: id, ...d }));
    if (c.care_plan !== 'geen') await save({ care_last_report: new Date().toISOString().slice(0, 10) });
    await q(sb.from('activity').insert({ client_id: id, kind: 'rapport', text: 'Rapport gepubliceerd: ' + d.title }));
    toast('Rapport staat in het dashboard van de klant');
    openClient(id);
  };
  $$('[data-delrep]', p).forEach((b) => (b.onclick = async () => {
    if (!confirm('Dit rapport verwijderen? De klant ziet het dan niet meer.')) return;
    await q(sb.from('reports').delete().eq('id', b.dataset.delrep));
    openClient(id);
  }));
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

/* ---------------- Statistieken (gedeeld: dobbo.be en klantensites) ---------------- */
let range = 30;
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
function delta(cur, prev) {
  const d = pct(cur, prev);
  if (d === null) return cur ? '<span class="delta">nieuw t.o.v. vorige periode</span>' : '<span class="delta">&nbsp;</span>';
  return `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${d}% t.o.v. vorige ${range} dagen</span>`;
}
const toplist = (rows, emptyText = 'Nog geen gegevens.') => {
  const max = rows[0]?.[1] || 1;
  return rows.length ? `<div class="toplist">${rows.map(([k, n]) => `<div><i style="transform:scaleX(${n / max})"></i><span>${esc(k)}</span><b>${n}</b></div>`).join('')}</div>` : `<p class="empty">${emptyText}</p>`;
};

async function analytics(v, siteId, { title: h, sub: p, before = '', empty = '' }) {
  const done = loading(v);
  const st = await q(sb.rpc('site_stats', { p_site: siteId, p_days: range }));
  done();
  const W = 720, H = 200, n = st.daily.length, bw = W / Math.max(1, n), max = Math.max(1, ...st.daily.map((d) => d.v));
  const bars = st.daily.map((d, i) => {
    const h = (d.v / max) * (H - 28), ha = Math.min(h, (d.a / max) * (H - 28));
    return `<g><rect x="${i * bw + 1.5}" y="${H - 20 - h}" width="${Math.max(1, bw - 3)}" height="${h}" rx="2"/>${ha ? `<rect class="cta" x="${i * bw + 1.5}" y="${H - 20 - ha}" width="${Math.max(1, bw - 3)}" height="${ha}" rx="2"/>` : ''}<title>${fmtDate(d.d)}: ${d.v} bezoekers, ${d.a} acties</title></g>
      ${i % Math.ceil(n / 6) === 0 ? `<text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${fmtDate(d.d)}</text>` : ''}`;
  }).join('');
  const conv = st.visitors ? Math.round((st.funnel[2] / st.visitors) * 100) : 0;
  const f0 = st.funnel[0] || 0;
  const step = (label, val, i) => `<div class="fstep"><div class="fbar"><i style="transform:scaleY(${f0 ? val / f0 : 0})"></i></div><b class="num">${val}</b><span>${label}</span>${i ? `<small>${f0 ? Math.round((val / f0) * 100) : 0}%</small>` : '<small>&nbsp;</small>'}</div>`;
  const stat = (val, label, d) => `<div class="stat"><b>${val}</b><span>${label}</span>${d}</div>`;

  v.innerHTML = before + header(h, p, `<div class="top-actions">
      <span class="live${st.live ? ' on' : ''}"><i></i>${st.live} ${st.live === 1 ? 'bezoeker' : 'bezoekers'} nu</span>
      <div class="seg" role="group" aria-label="Periode">${[7, 30, 90].map((x) => `<button type="button" data-range="${x}" aria-pressed="${range === x}">${x} d</button>`).join('')}</div></div>`) + `
  <div class="card stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${stat(st.visitors, 'Bezoekers', delta(st.visitors, st.prev_visitors))}
    ${stat(st.views, 'Paginaweergaven', delta(st.views, st.prev_views))}
    ${stat(st.actions, 'Contactacties', delta(st.actions, st.prev_actions))}
    ${stat(conv + '%', 'Bezoekers die contact opnemen', '<span class="delta">&nbsp;</span>')}
  </div>
  ${!st.visitors && !st.prev_visitors && empty ? empty : ''}
  <div class="overview">
    <section class="card"><h2>Per dag<small><span class="key blue"></span>Bezoekers <span class="key red"></span>Contactacties</small></h2>
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Bezoekers per dag">${bars}</svg></section>
    <section class="card"><h2>Van bezoek tot contact</h2>
      <div class="funnel">${step('Bezoekt de site', st.funnel[0], 0)}${step('Bekijkt 2+ pagina’s', st.funnel[1], 1)}${step('Neemt contact op', st.funnel[2], 2)}</div></section>
  </div>
  <div class="site-grid" style="margin-top:16px">
    <section class="card"><h2>Pagina’s</h2>${toplist(st.pages)}</section>
    <section class="card"><h2>Waar ze vandaan komen</h2>${toplist(st.sources)}</section>
    <section class="card"><h2>Contactacties</h2>${toplist(st.actions_top, 'Nog niemand gebeld, gemaild of geboekt via de site.')}</section>
    <section class="card"><h2>Toestel</h2>${toplist(st.devices)}</section>
  </div>`;
  $$('[data-range]', v).forEach((b) => (b.onclick = () => { range = Number(b.dataset.range); refreshAnalytics(); }));
}
let refreshAnalytics = () => {};

async function site() {
  refreshAnalytics = site;
  await analytics($('#view'), DOBBO_SITE, { title: 'Statistieken', sub: 'dobbo.be, zonder cookies' });
}

/* ---------------- Klantweergave (klant zelf, of Alec via "Bekijk als klant") ---------------- */
function previewBar(cid, c, tab) {
  return `<div class="preview-bar"><span>${icon('eye')}Je bekijkt het dashboard van <b>${title(c)}</b></span>
    <div class="seg">${[['bezoekers', 'Bezoekers'], ['project', 'Mijn site'], ['rapporten', 'Rapporten']].map(([k, l]) => `<a href="#als/${cid}/${k}" aria-pressed="${tab === k}">${l}</a>`).join('')}</div>
    <a class="btn btn-ghost btn-sm" href="#klanten/${cid}">Terug naar fiche</a></div>`;
}
const STAGE_TEXT = {
  lead: 'We plannen een eerste gesprek.',
  gesprek: 'We bespreken binnenkort wat je site moet doen.',
  voorschot: 'We starten zodra het voorschot binnen is.',
  info: 'We verzamelen je teksten, foto’s en gegevens.',
  versie: 'Je bijna klare versie staat klaar om te bekijken.',
  afwerken: 'We werken je site af met jouw feedback.',
  online: 'Je site staat online.',
  verloren: 'Dit project loopt niet meer.',
};

async function clientBezoekers(cid, preview = false) {
  const v = $('#view');
  refreshAnalytics = () => clientBezoekers(cid, preview);
  const [[c], sites] = await Promise.all([q(sb.from('clients').select('*').eq('id', cid)), q(sb.from('sites').select('*').eq('client_id', cid).order('created_at'))]);
  if (!c) return (v.innerHTML = '<p class="empty">Niet gevonden.</p>');
  const before = preview ? previewBar(cid, c, 'bezoekers') : '';
  if (!sites.length) {
    v.innerHTML = before + header('Bezoekers', title(c)) + `<section class="card"><p class="empty">${preview ? 'Nog geen site gekoppeld. Voeg er een toe in de fiche van deze klant.' : 'We meten het bezoek zodra je site online staat. Je ziet het hier dan vanzelf verschijnen.'}</p></section>`;
    return;
  }
  const site = sites.find((s) => s.id === clientBezoekers.site) || sites[0];
  const pick = sites.length > 1 ? `<div class="seg" style="margin-bottom:16px">${sites.map((s) => `<button type="button" data-site="${s.id}" aria-pressed="${s.id === site.id}">${esc(s.domain)}</button>`).join('')}</div>` : '';
  await analytics(v, site.id, { title: 'Bezoekers', sub: esc(site.domain), before: before + pick,
    empty: `<section class="card" style="margin-bottom:16px"><p class="empty">Nog geen bezoek gemeten op ${esc(site.domain)}. ${preview ? 'Staat het meetscript al op de site? Je vindt het in de fiche.' : 'Dat kan even duren na de lancering.'}</p></section>` });
  $$('[data-site]', v).forEach((b) => (b.onclick = () => { clientBezoekers.site = b.dataset.site; clientBezoekers(cid, preview); }));
}

async function clientProject(cid, preview = false) {
  const v = $('#view'), done = loading(v);
  const [[c], payments] = await Promise.all([q(sb.from('clients').select('*').eq('id', cid)), q(sb.from('payments').select('*').eq('client_id', cid))]);
  done();
  if (!c) return (v.innerHTML = '<p class="empty">Niet gevonden.</p>');
  payments.sort((a, b) => payOrder(a) - payOrder(b) || a.created_at.localeCompare(b.created_at));
  const paid = payments.filter((x) => x.paid_at).reduce((s, x) => s + Number(x.amount), 0), total = payments.reduce((s, x) => s + Number(x.amount), 0);
  const care = CARE[c.care_plan];
  const link = (u, l) => u ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${esc(/^https?:/.test(u) ? u : 'https://' + u)}">${icon('ext')}${l}</a>` : '';
  v.innerHTML = (preview ? previewBar(cid, c, 'project') : '') + header('Mijn site', title(c)) + `
  <div class="overview">
    <div class="stack">
      <section class="card"><h2>${LONG[c.stage]}${c.stage === 'verloren' ? '' : `<small>stap ${STAGE_I[c.stage] + 1} van 7</small>`}</h2>
        ${track(c.stage, true)}
        <div class="track-labels">${STAGES.map(([k, l]) => `<span class="${k === c.stage ? 'cur' : ''}">${l}</span>`).join('')}</div>
        <p style="margin-top:16px">${STAGE_TEXT[c.stage]}</p>
        ${c.preview_url || c.site_url ? `<div class="minutes" style="margin-top:16px">${link(c.preview_url, 'Bekijk je bijna klare versie')}${link(c.site_url, 'Naar je site')}</div>` : ''}
      </section>
      <section class="card"><h2>Betalingen${total ? `<small class="num">${eur(paid)} van ${eur(total)} betaald</small>` : ''}</h2>
        ${payments.length ? payments.map((x) => `<div class="pay${x.paid_at ? ' paid' : ''}" style="grid-template-columns:1fr auto auto"><span class="lbl">${esc(x.label)}</span><span class="tag ${x.paid_at ? 'green' : ''}">${x.paid_at ? 'Betaald ' + fmtDate(x.paid_at) : 'Open'}</span><span class="amt">${eur(x.amount)}</span></div>`).join('') : '<p class="empty">Nog geen betalingen.</p>'}
      </section>
    </div>
    <section class="card"><h2>Abonnement</h2>
      ${c.care_plan === 'geen' ? `<p class="empty">Je hebt geen beheerabonnement. Met een abonnement houden wij je site veilig, up-to-date en vindbaar, en krijg je elke maand een rapport. Vraag ernaar via <a href="mailto:${OWNER_EMAIL}">${OWNER_EMAIL}</a>.</p>` : `
        <div class="stat"><b>${care.label}</b><span>${eur(care.price)} per maand${c.care_since ? ` · sinds ${fmtDate(c.care_since)}` : ''}</span></div>
        <div style="margin-top:20px"><div class="date">Werktijd deze maand: <b class="num">${c.care_minutes_used} van ${care.minutes} min</b></div>
        <div class="meter${c.care_minutes_used > care.minutes ? ' over' : ''}"><i style="transform:scaleX(${Math.min(1, c.care_minutes_used / care.minutes)})"></i></div></div>
        <p class="date">Laatste maandrapport: ${c.care_last_report ? fmtDate(c.care_last_report) : 'komt eraan'}</p>`}
    </section>
  </div>`;
}

async function clientRapporten(cid, preview = false) {
  const v = $('#view'), done = loading(v);
  const [[c], reps] = await Promise.all([q(sb.from('clients').select('*').eq('id', cid)), q(sb.from('reports').select('*').eq('client_id', cid).order('created_at', { ascending: false }))]);
  done();
  if (!c) return (v.innerHTML = '<p class="empty">Niet gevonden.</p>');
  v.innerHTML = (preview ? previewBar(cid, c, 'rapporten') : '') + header('Rapporten', title(c)) + (reps.length ? `<div class="stack">${reps.map((r) => `
    <article class="card report"><h2>${esc(r.title)}<small>${esc(r.period || fmtDate(r.created_at))}</small></h2><div class="report-body">${esc(r.body)}</div></article>`).join('')}</div>`
    : `<section class="card"><p class="empty">Hier verschijnen onze rapporten over je site: wat we deden, wat de cijfers zeggen en wat we voorstellen.</p></section>`);
}

boot();
