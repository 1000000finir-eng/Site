#!/usr/bin/env python3
"""Витягує сторінку продукту зі старого index.html у JSON для src/_content/pages/.
Все, що не вдалося розкласти на поля, потрапляє в елемент {t:'raw'} — щоб сторінка не змінилась."""
import sys, re, json, os, shutil
from bs4 import BeautifulSoup, NavigableString, Tag

STATS = {'raw': 0, 'elements': 0}
STYLES = {}

from htmlutil import esc_md, inline, only_inline, cls, cta_info, is_cta

def element(ch):
    STATS['elements'] += 1
    c = cls(ch)
    if ch.name == 'p' and only_inline(ch):
        e = {'t': 'p', 'md': inline(ch)}
        if c: e['cls'] = c
        if ch.get('style'): e['style'] = ch['style']
        return e
    if ch.name == 'ul' and all(li.name == 'li' and only_inline(li) for li in ch.find_all(recursive=False)):
        e = {'t': 'ul', 'items': [inline(li) for li in ch.find_all('li', recursive=False)]}
        if c: e['cls'] = c
        if ch.get('style'): e['style'] = ch['style']
        return e
    if is_cta(ch):
        return {'t': 'cta', 'inline': False, **cta_info(ch)}
    if ch.name == 'div' and c == 'ec-inline-cta' and len(ch.find_all(recursive=False)) == 1 and is_cta(ch.find(recursive=False)):
        r = {'t': 'cta', 'inline': True, **cta_info(ch.find(recursive=False))}
        if ch.get('style'): r['style'] = ch['style']
        return r
    if ch.name == 'div' and 'note' in c and only_inline(ch):
        n = {'t': 'note', 'cls': c, 'md': inline(ch)}
        if ch.get('style'): n['style'] = ch['style']
        return n
    kids = ch.find_all(recursive=False)
    if ch.name == 'div' and c == 'ec-steps' and kids and all(k.name == 'article' and cls(k) == 'ec-step' for k in kids):
        items = []
        ok = True
        for k in kids:
            h = k.find('h3'); p = k.find('p'); n = k.find('div', class_='ec-step__num')
            if not (h and p and n) or len(k.find_all(recursive=False)) != 3 or not only_inline(h) or not only_inline(p): ok = False; break
            items.append({'title': inline(h), 'text': inline(p)})
        if ok: return {'t': 'steps', 'items': items}
    if ch.name == 'div' and c == 'ec-how__grid' and kids and all(k.name == 'div' and [x.name for x in k.find_all(recursive=False)] == ['span', 'p'] and only_inline(k.p) for k in kids):
        if [k.span.get_text(strip=True) for k in kids] == [str(i + 1) for i in range(len(kids))]:
            return {'t': 'how', 'items': [inline(k.p) for k in kids]}
    if ch.name == 'div' and kids and all(k.name == 'article' and k.find(recursive=False) is not None and k.find(recursive=False).name == 'h3' and only_inline(k.find(recursive=False)) for k in kids):
        cards = []
        for k in kids:
            h = k.find(recursive=False)
            card = {'title': inline(h), 'elements': [element(x) for x in k.find_all(recursive=False)[1:]]}
            if cls(k): card['cls'] = cls(k)
            cards.append(card)
        r = {'t': 'cards', 'cls': c, 'cards': cards}
        if ch.get('style'): r['style'] = ch['style']
        return r
    STATS['raw'] += 1
    return {'t': 'raw', 'html': str(ch)}

def heading_of(parent):
    """Повертає (heading_mode, kicker, title, решта дітей)."""
    kids = parent.find_all(recursive=False)
    if kids and kids[0].name == 'div' and cls(kids[0]) == 'ec-section-heading':
        h = kids[0]; k = h.find('p', class_='ec-kicker'); t = h.find('h2')
        STYLES['heading_style'] = h.get('style', ''); STYLES['title_style'] = (t.get('style', '') if t else '')
        return 'block', (k.get_text(strip=True) if k else ''), (inline(t) if t else ''), kids[1:]
    if kids and kids[0].name == 'p' and 'ec-kicker' in (kids[0].get('class') or []) and len(kids) > 1 and kids[1].name == 'h2':
        STYLES['title_style'] = kids[1].get('style', '')
        return 'inline', kids[0].get_text(strip=True), inline(kids[1]), kids[2:]
    if kids and kids[0].name == 'h2':
        STYLES['title_style'] = kids[0].get('style', '')
        return 'inline', '', inline(kids[0]), kids[1:]
    return 'none', '', '', kids

CTX = {'cta': {'action': 'price', 'attrs': True}, 'idx': 0, 'ignore_style': os.environ.get('KEEP_STYLE') is None}

def plain_body(els):
    """Якщо всі елементи — прості абзаци, повертає markdown-текст."""
    if els and all(x['t'] == 'p' and not x.get('cls') and not x.get('style') for x in els):
        return '\n\n'.join(x['md'] for x in els)
    return None

def block_of(sec):
    from dsl_match import match_block
    classes = sec.get('class') or []
    full = ' '.join(classes)
    sid = sec.get('id') or ''
    main = [c for c in classes if c != 'ec-animate']
    if sid == 'faq':
        mode, k, t, rest = heading_of(sec)
        lst = rest[0]
        items = []
        for it in lst.select('.faq-item'):
            q = it.select_one('.faq-question'); a = it.select_one('.faq-answer')
            qi = q.find('img'); icon = qi['src'] if qi else ''; qi and qi.extract()
            qt = re.sub(r'\s+', ' ', q.get_text(' ', strip=True)); at = inline(a)
            items.append({'question': qt, 'answer': at})
        return {'type': 'faq', 'kicker': k, 'title': t, 'items': items}
    if sid != 'faq':
        mb = match_block(sec, CTX)
        if mb: STATS['catalog'] = STATS.get('catalog', 0) + 1; return mb
    if 'ec-intro' in main:
        grid = sec.find('div', class_='ec-intro__grid')
        img = grid.select_one('.ec-intro__media img'); cont = grid.select_one('.ec-intro__content')
        kids = cont.find_all(recursive=False)
        kick = kids[0].get_text(strip=True); title = inline(kids[1])
        els, meta, cta_text, cta_extra, after = [], [], '', {}, []
        for ch in kids[2:]:
            if cta_text and not is_cta(ch) and 'ec-product-meta' not in (ch.get('class') or []):
                after.append(element(ch)); continue
            if 'ec-product-meta' in (ch.get('class') or []):
                meta = [{'label': d.span.get_text(strip=True), 'value': d.strong.get_text(strip=True)} for d in ch.find_all('div', recursive=False)]
            elif is_cta(ch):
                ci = cta_info(ch); cta_text = ci['text']; cta_extra = {'cta_action': ci['action'], 'cta_attrs': ci['attrs'], **({'cta_style': ci['card_style']} if ci.get('card_style') else {})}
            else:
                els.append(element(ch))
        r = {'type': 'intro', **cta_extra, 'image': img['src'], 'image_alt': img.get('alt', ''), 'kicker': kick, 'title': title, 'meta': meta, 'cta_text': cta_text}
        if after: r['after'] = after
        pb = plain_body(els)
        if pb is not None: r['body'] = pb
        else: r['elements'] = els
        return r
    if 'ec-final' in main:
        box = sec.find('div', class_='ec-final__box'); kids = box.find_all(recursive=False)
        title = inline(kids[0]); els = []; cta_text = ''; cta_extra = {}
        for ch in kids[1:]:
            if is_cta(ch):
                ci = cta_info(ch); cta_text = ci['text']; cta_extra = {'cta_action': ci['action'], 'cta_attrs': ci['attrs'], **({'cta_style': ci['card_style']} if ci.get('card_style') else {})}
            else: els.append(element(ch))
        r = {'type': 'final', **cta_extra, 'title': title, 'cta_text': cta_text}
        pb = plain_body(els)
        if pb is not None: r['body'] = pb
        else: r['elements'] = els
        return r
    # універсальна секція
    b = {'type': 'section', 'cls': full}
    if sid: b['id'] = sid
    kids = sec.find_all(recursive=False)
    holder = sec
    if len(kids) == 1 and kids[0].name == 'div':
        w = kids[0]; wc = cls(w)
        if wc == 'ec-detail__expertise':
            single = w.find('div', recursive=False); photo = w.select_one('.ec-detail__photo img')
            b['wrap'] = 'expertise'; b['single_cls'] = cls(single); b['photo'] = photo['src']; b['photo_alt'] = photo.get('alt', '')
            holder = single
        elif wc in ('ec-detail__single',) or wc.startswith(('ec-wide__box', 'ec-how__box')) or wc.startswith('ec-detail__single'):
            b['wrap'] = wc; holder = w
    STYLES.clear()
    mode, k, t, rest = heading_of(holder)
    b.update({'heading': mode, 'kicker': k, 'title': t})
    for key in ('heading_style', 'title_style'):
        if STYLES.get(key): b[key] = STYLES[key]
    b['elements'] = [element(x) for x in rest]
    return b

def parse(path):
    html = open(path, encoding='utf-8', errors='replace').read()
    s = BeautifulSoup(html, 'lxml')
    slug = os.path.basename(os.path.dirname(path))
    g = lambda sel, attr='content': (s.select_one(sel) or {}).get(attr, '') if s.select_one(sel) else ''
    css = [l['href'] for l in s.find_all('link', rel='stylesheet') if not l['href'].startswith(('/', 'http'))]
    hero = s.find('section', id='hero')
    h1 = hero.find('h1', class_='hero-line-1').get_text(' ', strip=True)
    l2 = hero.select_one('.hero-line-2'); sub = hero.select_one('.hero-sub')
    page = {
        'slug': slug, 'title': s.title.get_text(strip=True),
        'description': g('meta[name=description]'),
        'og_title': g('meta[property="og:title"]'), 'og_description': g('meta[property="og:description"]'),
        'og_image': g('meta[property="og:image"]').replace('https://i-s-business-consulting.pp.ua', ''),
        'css': '/css/' + css[0].split('/')[-1] if css else '/css/blocks.css',
        'hero': {'image': hero.find('img')['src'], 'alt': hero.find('img').get('alt', ''), 'title': h1,
                 'headline': l2.get_text(' ', strip=True) if l2 else '', 'headline_tag': l2.name if l2 else 'h1',
                 'sub': sub.get_text(' ', strip=True) if sub else ''},
        'breadcrumb': s.select_one('nav.ec-breadcrumb span:last-child').get_text(strip=True),
    }
    cards = s.select('.ec-booking-card')
    d = cards[0]
    page['booking'] = {'product': d.get('data-product', ''), 'price': d.get('data-price', ''), 'pay_link': d.get('data-pay-link', ''),
                       'email_template': d.get('data-email-template', 'free'), 'send_email': d.get('data-send-email', 'true') == 'true',
                       'redirect': d.get('data-redirect', 'false') == 'true'}
    b0 = d.find('button')
    page['cta'] = {'action': 'price' if 'openPricePopup' in (b0.get('onclick') or '') else 'booking', 'attrs': d.has_attr('data-product')}
    CTX['cta'] = page['cta']
    for c in cards:
        if dict(c.attrs) != dict(d.attrs): print('  ! booking-card з іншими data-*:', c.attrs, file=sys.stderr)
    for sc in s.find_all('script', type='application/ld+json'):
        try: j = json.loads(sc.string)
        except Exception: continue
        if j.get('@type') == 'Service':
            sv = {'description': j.get('description', '')}
            if j.get('image'): sv['image'] = j['image'].replace('https://i-s-business-consulting.pp.ua', '')
            if j.get('serviceType'): sv['service_type'] = j['serviceType']
            if j.get('offers'): sv['price_number'] = j['offers'].get('price')
            if j.get('name') != page['booking']['product']: sv['name'] = j.get('name')
            page['service'] = sv
    last = html.rindex('</section>') + len('</section>')
    page['bottom_file'] = slug + '.html'
    page['_bottom'] = html[last:]
    page['booking_css'] = any('booking.css' in l.get('href', '') for l in s.find_all('link', rel='stylesheet'))
    page['hero']['br'] = hero.select_one('.hero-text br') is not None
    head_ld, body_ld = [], []
    for sc in s.find_all('script', type='application/ld+json'):
        try: j = json.loads(sc.string)
        except Exception:
            j = None
            txt = sc.string.rstrip()
            for _ in range(3):  # типова помилка: зайва закриваюча дужка
                txt = txt[:-1].rstrip()
                try: j = json.loads(txt); print('  ✓ JSON-LD виправлено (зайва дужка):', page['slug'], file=sys.stderr); break
                except Exception: continue
            if j is None:
                j = {'raw': sc.string}
                print('  ! JSON-LD з помилкою (збережено дослівно):', page['slug'], file=sys.stderr)
        if sc.find_parent('head'): head_ld.append(j)
    page['jsonld_head'] = head_ld
    blocks = []
    from dsl_match import match_block
    cont = hero.parent
    sibs = [x for x in hero.find_next_siblings() if x.name]
    last_sec = max((i for i, x in enumerate(sibs) if x.name == 'section'), default=-1)
    for i, x in enumerate(sibs[:last_sec + 1]):
        if x.name == 'section': blocks.append(block_of(x)); continue
        if x.name in ('nav', 'script', 'style'): continue
        mb = match_block(x, CTX)
        if mb: blocks.append(mb)
        else:
            STATS['raw'] += 1; blocks.append({'type': 'raw', 'html': str(x)})
    page['blocks'] = blocks
    return page, css

if __name__ == '__main__':
    src_root, out_dir = sys.argv[1], sys.argv[2]
    for slug in sys.argv[3:]:
        STATS.update(raw=0, elements=0)
        path = f'{src_root}/{slug}/index.html'
        page, css = parse(path)
        os.makedirs(f'{out_dir}/../bottoms', exist_ok=True)
        open(f'{out_dir}/../bottoms/{page["bottom_file"]}', 'w', encoding='utf-8').write(page.pop('_bottom'))
        json.dump(page, open(f'{out_dir}/{slug}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        for d in CTX.pop('dropped', []): print(f'  стиль прибрано [{slug}] {d[0]} {d[1]} {d[2]}', file=sys.stderr)
        print(f'{slug}: блоків {len(page["blocks"])}, елементів {STATS["elements"]}, raw {STATS["raw"]}, css {css}')
