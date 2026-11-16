// Dobbo-bezoeksteller: geen cookies, geen persoonsgegevens. Een willekeurige sessie-id leeft alleen in sessionStorage.
(function () {
  var API = 'https://ytlytwepgtbqdqdspxla.supabase.co/rest/v1/site_events';
  var KEY = 'sb_publishable_cC0zm4jeVJAP8N9TH_BoCA_obiyCRCq';
  if (API.indexOf('PROJECT') > -1 || navigator.doNotTrack === '1' || (function () { try { return localStorage.getItem('dobbo_notrack'); } catch (e) { return null; } })() || /localhost|127\.0\.0\.1/.test(location.hostname)) return;
  var sid;
  try { sid = sessionStorage.getItem('dobbo_sid') || Math.random().toString(36).slice(2, 12); sessionStorage.setItem('dobbo_sid', sid); } catch (e) { sid = 'x'; }
  var device = matchMedia('(max-width: 760px)').matches ? 'gsm' : matchMedia('(max-width: 1100px)').matches ? 'tablet' : 'computer';
  var ref = '';
  try { var r = document.referrer && new URL(document.referrer).hostname; if (r && r !== location.hostname) ref = r.replace(/^www\./, ''); } catch (e) {}
  function send(type, label) {
    var body = JSON.stringify({ sid: sid, type: type, path: location.pathname.slice(0, 190), ref: ref, label: (label || '').slice(0, 190), device: device, lang: document.documentElement.lang || '' });
    fetch(API, { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: body }).catch(function () {});
  }
  send('view');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="boek"], a[href^="mailto:"], a[href^="tel:"], [data-track]');
    if (a) send('click', a.getAttribute('data-track') || (a.textContent || '').trim().replace(/\s+/g, ' ') || a.getAttribute('href'));
  }, true);
})();
