#!/usr/bin/env python3
"""Bouwt de Franse (/fr/) en Engelse (/en/) versie van dobbo.be uit de Nederlandse pagina's.

Gebruik (vanuit de map dobbo-site):  python3 tools/build_i18n.py
Draai dit opnieuw na elke wijziging aan index.html of team.html.
Nieuwe of gewijzigde Nederlandse zinnen voeg je toe in tools/i18n/translations.py;
het script meldt welke zinnen nog geen vertaling hebben.

LIVE = False: de vertalingen staan online maar verborgen (noindex, niet gelinkt).
Zet LIVE = True om de taalkiezer te activeren en hreflang toe te voegen.
"""
import os, re, sys

LIVE = False
SITE = 'https://dobbo.be'
PAGES = ['index.html', 'team.html', 'boek.html']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools', 'i18n'))
from translations import ROWS, FRAGMENTS  # noqa: E402

LANGS = {'fr': 1, 'en': 2}


def js_escape(t):
    return re.sub(r"(?<!\\)'", r"\\'", t)


def html_text(t):
    return t.replace("\\'", "'").replace('\\u2019', '’')


def translate(src, lang):
    i = LANGS[lang]
    table = {r[0]: r[i] for r in ROWS}
    if lang == 'fr':  # Franse typografie: vaste smalle spatie voor : ; ? ! en binnen « »
        fix = lambda t: re.sub(r' ([:;?!»])', '\u202f\\1', t.replace('« ', '«\u202f'))
        table = {k: fix(v) for k, v in table.items()}
    missing = set()
    parts = re.split(r'(<script[^>]*>.*?</script>|<style[^>]*>.*?</style>)', src, flags=re.S)
    out = []
    for p in parts:
        if p.startswith('<style'):
            out.append(p)
            continue
        if p.startswith('<script'):
            def lit(m):
                body = m.group(1)
                if body in table:
                    return "'" + js_escape(table[body]) + "'"
                return m.group(0)
            p = re.sub(r"'((?:[^'\\]|\\.)*)'", lit, p)
            for f in FRAGMENTS:
                # stukken met code erin (aanhalingstekens in het origineel) worden letterlijk vervangen
                p = p.replace(f[0], f[i] if "'" in f[0] else js_escape(f[i]))
            out.append(p)
            continue
        # HTML: tekst tussen tags
        def txt(m):
            raw = m.group(1)
            core = raw.strip()
            if not re.search(r'[A-Za-zÀ-ÿ]{2}', core):
                return m.group(0)
            if core in table:
                lead = raw[:len(raw) - len(raw.lstrip())]
                trail = raw[len(raw.rstrip()):]
                return '>' + lead + html_text(table[core]) + trail + '<'
            missing.add(core)
            return m.group(0)
        p = re.sub(r'>([^<>]+)<', txt, p)
        # HTML: attributen
        def attr(m):
            name, val = m.group(1), m.group(2)
            if val in table:
                return '%s="%s"' % (name, html_text(table[val]).replace('"', '&quot;'))
            if re.search(r'[a-zà-ÿ]{3} [a-zà-ÿ]{2,}', val):
                missing.add(val)
            return m.group(0)
        p = re.sub(r'\b(alt|aria-label|title|placeholder|content)="([^"]*)"', attr, p)
        out.append(p)
    s = ''.join(out)
    # paden: de taalversies staan één map dieper
    s = re.sub(r'(=")(assets|cases)/', r'\1../\2/', s)
    s = re.sub(r"(')(assets|cases)/", r"\1../\2/", s)
    s = s.replace('<html lang="nl">', '<html lang="%s">' % lang)
    return s, missing


def lang_links(page, current):
    slug = '' if page == 'index.html' else page
    hrefs = {'nl': '/' + slug, 'fr': '/fr/' + slug, 'en': '/en/' + slug}
    head = ''.join('<link rel="alternate" hreflang="%s" href="%s%s">\n' % (l, SITE, h) for l, h in hrefs.items())
    head += '<link rel="alternate" hreflang="x-default" href="%s%s">\n' % (SITE, hrefs['nl'])
    nav = ' · '.join('<b aria-current="true">%s</b>' % l.upper() if l == current else
                     '<a href="%s" hreflang="%s" lang="%s">%s</a>' % (h, l, l, l.upper())
                     for l, h in hrefs.items())
    return head, '<span class="lang">%s</span>' % nav


def activate(s, page, lang):
    head, nav = lang_links(page, lang)
    s = s.replace('</title>', '</title>\n' + head, 1)
    s = s.replace('<span class="lang">NL · FR · EN</span>', nav)
    return s


def main():
    total_missing = {}
    for lang in LANGS:
        os.makedirs(os.path.join(ROOT, lang), exist_ok=True)
        for page in PAGES:
            src = open(os.path.join(ROOT, page), encoding='utf-8').read()
            s, missing = translate(src, lang)
            if LIVE:
                s = activate(s, page, lang)
            else:
                s = s.replace('<span class="lang">NL · FR · EN</span>', '')
                if 'name="robots"' not in s:
                    s = s.replace('</title>', '</title>\n<meta name="robots" content="noindex">', 1)
            open(os.path.join(ROOT, lang, page), 'w', encoding='utf-8').write(s)
            for m in missing:
                total_missing.setdefault(m, set()).add('%s/%s' % (lang, page))
    if LIVE:
        for page in PAGES:
            p = os.path.join(ROOT, page)
            s = open(p, encoding='utf-8').read()
            if 'hreflang="fr"' not in s:
                open(p, 'w', encoding='utf-8').write(activate(s, page, 'nl'))
    print('Klaar: fr/ en en/ aangemaakt (LIVE=%s).' % LIVE)
    if total_missing:
        print('\nNog niet vertaald (blijft Nederlands):')
        for m in sorted(total_missing):
            print(' -', m[:110])


if __name__ == '__main__':
    main()
