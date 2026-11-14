#!/usr/bin/env python3
"""Будує описи блоків і вставок автоматично з сторінки-прикладів (pryklady-blokiv).
Кожен опис перевіряється: HTML → дані → HTML має збігатися з прикладом. Непройдені відкидаються.
Результат: tools/catalog_auto.json (потім: python3 tools/catalog.py && python3 tools/gen_config.py)"""
import json, re, subprocess, sys, difflib, copy
from bs4 import BeautifulSoup, NavigableString
sys.path.insert(0, 'tools')
from htmlutil import only_inline, cls as cls_of, is_cta
from dsl_match import match_one, kids_of, has_stray_text

DEMO = '/home/claude/site/pryklady-blokiv/index.html'
VOID = {'img', 'br', 'hr', 'input'}
SKIP_BLOCK_CLASSES = {'hl-block', 'cf-block', 'tg-block', 'nr-block', 'ic-block', 'stat-wrap', 'qz-block', 'ct-strip', 'bn-strip', 'pain-block',
                      'who-grid', 'outcome-grid', 'tx-block', 'ec-intro', 'ec-detail', 'ec-wide', 'ec-process', 'ec-how', 'ec-result', 'ec-final', 'faq', 'ec-faq'}
SKIP_INSERT = {'accent-word', 'tag-pair', 'num-inline', 'time-stamp'}   # змішаний текст із span — не вставки-структури

class Fail(Exception): pass

class Namer:
    def __init__(s): s.used = set()
    def get(s, base):
        n, i = base, 2
        while n in s.used: n = f'{base}{i}'; i += 1
        s.used.add(n); return n

def sig(el): return el.name + '.' + (cls_of(el).split() or [''])[0]

def leaf_name(el, namer):
    c = cls_of(el).split()
    if any(t.endswith('kicker') for t in c): return namer.get('kicker')
    if el.name in ('h1', 'h2', 'h3', 'h4'): return namer.get('title')
    if el.name == 'p' and not c: return namer.get('text')
    base = ''
    for tok in reversed(c):
        suf = tok.split('__')[-1] if '__' in tok else tok
        base = re.sub(r'[^a-z0-9]+', '_', suf.lower()).strip('_')
        if base: break
    base = {'q': 'quote', 'type': 'kind', 'p': 'text', 'div': 'text', 'span': 'text', 'ul': 'items', 'each': 'item', 'body': 'content', 'inserts': 'extra', 'cta': 'button', 'btn': 'button'}.get(base or el.name, base or el.name)
    return namer.get(base)

def build(el, namer, ctx):
    node = {'tag': el.name}
    c = cls_of(el)
    if c: node['cls'] = c
    if is_cta(el):
        b = el.find('button')
        return {'cta': namer.get('cta_text')}
    if el.name == 'button' and 'ec-main-btn' in (el.get('class') or []):
        return {'btn': namer.get('cta_text')}
    extra = set(el.attrs) - {'class'}
    af = {}
    if el.name == 'img':
        for a in ('src', 'alt'):
            if el.has_attr(a): af[a] = namer.get('photo' if a == 'src' else 'photo_alt'); extra.discard(a)
    if el.name == 'a' and el.has_attr('href'): af['href'] = namer.get('link'); extra.discard('href')
    if ctx.get('ignore_style'): extra.discard('style')
    if extra: raise Fail(f'атрибути {sorted(extra)} на <{el.name}>')
    if af: node['af'] = af
    if el.name in VOID:
        node['void'] = True; return node
    kids = kids_of(el)
    if not kids or only_inline(el):
        text = el.get_text()
        if not text.strip(): node['static'] = True; return node
        if ctx.get('in_each') and re.fullmatch(r'\d+', text.strip()) and text.strip() in (str(ctx['idx'] + 1), str(ctx['idx'] + 1).zfill(2)):
            node['index'] = 'pad2' if text.strip().startswith('0') else '1'; return node
        f = leaf_name(el, namer); node['md'] = f
        if f == 'kicker': node['opt'] = 'kicker'
        return node
    if has_stray_text(el): raise Fail('текст між елементами')
    node['kids'] = group_children(kids, namer, ctx, el)
    return node

def group_children(kids, namer, ctx, parent):
    out, i = [], 0
    while i < len(kids):
        j = i
        while j < len(kids) and sig(kids[j]) == sig(kids[i]): j += 1
        group = kids[i:j]
        if len(group) >= 2 or parent.name in ('ul', 'ol'):
            inamer = Namer()
            node = build(group[0], inamer, {**ctx, 'in_each': True, 'idx': 0})
            classes = sorted({cls_of(g) for g in group}, key=lambda x: [cls_of(g) for g in group].index(x))
            if len(classes) > 1:
                var = inamer.get('variant'); node['cls'] = '{' + var + '}'
                node['_options'] = [[cl, ('Звичайний' if cl == classes[0] else cl.replace(classes[0], '').strip() or cl)] for cl in classes]
            if 'md' in node and 'kids' not in node and set(inamer.used) - {node['md']} <= {x for x in inamer.used if x.startswith('variant')}:
                node['md'] = '_'
            base = {'li': 'items', 'article': 'cards'}.get(group[0].name, 'items')
            node['each'] = namer.get(base)
            out.append(node)
        else:
            out.append(build(group[0], namer, ctx))
        i = j
    return out

def lift_options(node, selects):
    """Піднімає _options у selects спеки."""
    if '_options' in node:
        selects[node['cls'][1:-1]] = node.pop('_options')
    for k in node.get('kids', []): lift_options(k, selects)

LABELS = {'title': 'Заголовок', 'text': 'Текст', 'kicker': 'Надзаголовок', 'items': 'Елементи', 'cards': 'Картки', 'label': 'Підпис', 'value': 'Значення',
          'num': 'Номер', 'quote': 'Цитата', 'author': 'Автор', 'role': 'Роль', 'note': 'Примітка', 'photo': 'Фото', 'photo_alt': 'Підпис до фото (для Google)',
          'name': 'Назва', 'desc': 'Опис', 'sub': 'Підзаголовок', 'tag': 'Мітка', 'link': 'Посилання', 'cta_text': 'Текст кнопки', 'mark': 'Значок',
          'variant': 'Вигляд', 'key': 'Назва', 'val': 'Значення', 'n': 'Номер', 'l': 'Підпис', 'sep': 'Роздільник', 'step': 'Крок', 'time': 'Час'}
def collect_fields(node, out):
    for k in ('md', 'text', 'cta', 'btn', 'each', 'inserts'):
        if k in node: out.add(node[k])
    for v in (node.get('af') or {}).values(): out.add(v)
    for kid in node.get('kids', []): collect_fields(kid, out)
def make_labels(root):
    names = set(); collect_fields(root, names)
    lab = {}
    for n in names:
        m = re.fullmatch(r'([a-z_]+?)(\d+)', n)
        base, num = (m.group(1), m.group(2)) if m else (n, '')
        if base in LABELS: lab[n] = LABELS[base] + (f' {num}' if num else '')
    return lab

def examples():
    s = BeautifulSoup(open(DEMO, encoding='utf-8', errors='replace').read(), 'lxml')
    kids = s.body.find_all(recursive=False)
    blocks, inserts = [], []
    for i, c in enumerate(kids):
        cl = cls_of(c)
        if i <= 6 or c.name not in ('section', 'div') or 'demo-section-gap' in cl: continue
        first = (cl.split() or [''])[0]
        if not first or first in SKIP_BLOCK_CLASSES: continue
        title = ''
        if i > 0 and 'demo-section-gap' in cls_of(kids[i - 1]):
            tx = re.sub(r'\s+', ' ', kids[i - 1].get_text(' ', strip=True))
            m = re.search(r"[А-ЯІЇЄҐа-яіїєґ][А-ЯІЇЄҐа-яіїєґ'’ ()/,\-]*$", tx); title = m.group(0).strip() if m else ''
        blocks.append((first, title, c))
    box = kids[5].find('div', class_='vz-block__box')
    for d in box.find_all(recursive=False):
        lab = d.find('span', class_='demo-label'); code = lab.get_text(strip=True) if lab else ''
        if lab: lab.extract()
        els = [x for x in d.find_all(recursive=False)]
        if not els: continue
        el = els[0]
        first = (cls_of(el).split() or [''])[0]
        if not first or first in SKIP_INSERT: continue
        inserts.append((first, code, el))
    return blocks, inserts

def norm(h):
    h = re.sub(r'\saria-hidden="true"', '', h); h = re.sub(r'<!--.*?-->', '', h, flags=re.S); h = re.sub(r'<(/?)b>', r'<\1strong>', h)
    h = re.sub(r'\sstyle="[^"]*"', '', h)
    h = re.sub(r'<(br|hr|img)([^>]*?)\s*/>', r'<\1\2>', h)
    return re.sub(r'\s+', ' ', BeautifulSoup(h, 'lxml').body.prettify()).split('> <')

def nice(name): return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

def infer_group(items, group):
    """items: [(first_class, title, el)] → список спек (однакові first_class зливаються у варіанти)."""
    by = {}
    for first, title, el in items: by.setdefault(first, []).append((title, el))
    specs = []
    for first, lst in by.items():
        title, el0 = lst[0]
        ctx = {'ignore_style': group == 'insert', 'idx': 0}
        try: root = build(el0, Namer(), ctx)
        except Fail as e: specs.append(('✗', first, str(e), None)); continue
        selects = {}
        if len(lst) > 1:
            cls_list = []
            for _, e2 in lst:
                if cls_of(e2) not in cls_list: cls_list.append(cls_of(e2))
            if len(cls_list) > 1:
                root['cls'] = '{variant}'; selects['variant'] = [[cl, 'Звичайний' if cl == cls_list[0] else (cl.replace(cls_list[0], '').strip() or cl)] for cl in cls_list]
        lift_options(root, selects)
        name = nice(first)
        label = title or (' '.join(first.replace('-', ' ').replace('_', ' ').split()).capitalize())
        spec = {'name': name, 'label': label, 'group': group, 'root': root, 'selects': selects, 'labels': make_labels(root), 'hint': ''}
        specs.append(('?', first, '', (spec, [e for _, e in lst])))
    return specs

def verify(cands, group):
    ctx0 = {'cta': {'action': 'price', 'attrs': False}, 'idx': 0, 'ignore_style': group == 'insert'}
    s0 = BeautifulSoup(open(DEMO, encoding='utf-8', errors='replace').read(), 'lxml')
    b0 = s0.select_one('.ec-booking-card button'); card = s0.select_one('.ec-booking-card')
    ctx0['cta'] = {'action': 'price' if 'openPricePopup' in (b0.get('onclick') or '') else 'booking', 'attrs': card.has_attr('data-product')}
    good, rep = [], []
    for st, first, why, payload in cands:
        if payload is None: rep.append(f'✗ {first}: {why}'); continue
        spec, els = payload
        cases, exp = [], []
        for el in els:
            sc = {}; ctx = dict(ctx0)
            try: ok = match_one(spec['root'], el, sc, spec, ctx)
            except Exception as e: ok = False
            if not ok: continue
            cases.append({'spec': spec, 'data': sc}); exp.append(str(el))
            spec.setdefault('sample', sc)
        if not cases: rep.append(f'✗ {first}: не зіставилось'); continue
        json.dump({'cases': cases, 'page': {'cta': ctx0['cta'], 'booking': {'product': ''}}}, open('/tmp/inf.json', 'w'), ensure_ascii=False)
        r = subprocess.run(['node', 'tools/render_cases.mjs', '/tmp/inf.json'], capture_output=True, text=True)
        if r.returncode: rep.append(f'✗ {first}: рендер {r.stderr[:80]}'); continue
        out = json.loads(r.stdout)
        bad = [1 for e, g in zip(exp, out) if [l for l in difflib.unified_diff(norm(e), norm(g), lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]]
        if bad or len(cases) < len(els): rep.append(f'✗ {first}: розбіжності {len(bad)}, зіставлено {len(cases)}/{len(els)}'); continue
        good.append(spec); rep.append(f'✓ {first} ({len(cases)})')
    return good, rep

if __name__ == '__main__':
    blocks, inserts = examples()
    gb, rb = verify(infer_group(blocks, 'example'), 'example')
    gi, ri = verify(infer_group(inserts, 'insert'), 'insert')
    json.dump(gb + gi, open('tools/catalog_auto.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('БЛОКИ:', len(gb), 'з', len(rb)); print('\n'.join(rb))
    print('\nВСТАВКИ:', len(gi), 'з', len(ri)); print('\n'.join(ri))
