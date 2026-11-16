/* Dobbo-statistieken. Zonder cookies, zonder persoonsgegevens.
   Plaatsen op een site: <script src="https://dobbo.be/t.js" data-site="SITE-ID" defer></script>
   Een willekeurige sessie-id leeft enkel in sessionStorage (verdwijnt bij het sluiten van het tabblad). */
(function () {
  var s = document.currentScript, site = s && s.getAttribute('data-site');
  var API = 'https://ytlytwepgtbqdqdspxla.supabase.co/rest/v1/site_events';
  var KEY = 'sb_publishable_cC0zm4jeVJAP8N9TH_BoCA_obiyCRCq';
  if (!site || navigator.doNotTrack === '1' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  try { if (localStorage.getItem('dobbo_notrack')) return; } catch (e) {}

  var sid;
  try { sid = sessionStorage.getItem('dobbo_sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('dobbo_sid', sid); } } catch (e) { sid = Math.random().toString(36).slice(2, 12); }
  var device = matchMedia('(max-width: 760px)').matches ? 'Gsm' : matchMedia('(max-width: 1100px)').matches ? 'Tablet' : 'Computer';
  var ref = '';
  try {
    var u = new URLSearchParams(location.search).get('utm_source');
    var r = document.referrer && new URL(document.referrer).hostname.replace(/^www\./, '');
    ref = u || (r && r !== location.hostname.replace(/^www\./, '') ? r : '');
  } catch (e) {}

  function send(type, label) {
    var body = JSON.stringify({ site_id: site, sid: sid, type: type, path: location.pathname.slice(0, 190), ref: ref.slice(0, 190), label: (label || '').slice(0, 190), device: device, lang: (document.documentElement.lang || '').slice(0, 10) });
    try { fetch(API, { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: body }).catch(function () {}); } catch (e) {}
  }
  send('view');

  // Klikken die tellen: bellen, mailen, WhatsApp, boeken/afspraak, routebeschrijving, of alles met data-track.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button, [data-track]');
    if (!a) return;
    var href = a.getAttribute('href') || '', label = a.getAttribute('data-track');
    if (!label) {
      if (/^tel:/.test(href)) label = 'Belt';
      else if (/^mailto:/.test(href)) label = 'Mailt';
      else if (/wa\.me|whatsapp/i.test(href)) label = 'WhatsApp';
      else if (/maps\.(google|apple)|goo\.gl\/maps/i.test(href)) label = 'Route';
      else if (/boek|afspraak|reserv|book|cal\.com|calendly/i.test(href + ' ' + a.textContent)) label = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'Boeken';
    }
    if (label) send('click', label);
  }, true);

  // Ingevulde formulieren (zonder inhoud te versturen).
  document.addEventListener('submit', function (e) {
    var f = e.target;
    send('form', f.getAttribute('data-track') || f.getAttribute('aria-label') || f.getAttribute('name') || 'Formulier');
  }, true);
})();
