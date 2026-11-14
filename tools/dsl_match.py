"""Зіставлення HTML-секції з описом блоку з каталогу: HTML → дані блоку (зворотна операція до рендера)."""
import re, json, copy
from bs4 import NavigableString
from htmlutil import inline, only_inline, cls as cls_of, is_cta

LAST_FAIL = [None]
def fail(el, why):
    LAST_FAIL[0] = (el.name + ('.' + cls_of(el) if cls_of(el) else ''), why)
    return False

CATALOG = json.load(open(__file__.rsplit('/', 1)[0] + '/../src/_includes/product/catalog.json', encoding='utf-8'))

def kids_of(el): return el.find_all(recursive=False)

def has_stray_text(el):
    return any(isinstance(c, NavigableString) and c.strip() and type(c).__name__ != 'Comment' for c in el.children)

def body_item(el, n):
    if el.get('style'): return False
    if el.name == 'p': return cls_of(el) == '' and only_inline(el)
    if el.name == 'ul':
        return cls_of(el) == (n.get('ulcls') or '') and all(li.name == 'li' and only_inline(li) and not li.attrs for li in kids_of(el))
    return False

def body_md(els):
    parts = []
    for el in els:
        if el.name == 'p': parts.append(inline(el))
        else: parts.append('\n'.join('- ' + inline(li) for li in kids_of(el)))
    return '\n\n'.join(parts)

def match_children(nodes, kids, sc, spec, ctx):
    i = 0
    for n in nodes:
        if 'body' in n:
            j = i
            while j < len(kids) and body_item(kids[j], n): j += 1
            if j == i:
                if n.get('opt'): continue
                return False
            sc[n['body']] = body_md(kids[i:j]); i = j; continue
        if n.get('inserts'):
            items = []
            while i < len(kids):
                hit = None
                for sp in [x for x in CATALOG if x.get('group') == 'insert']:
                    isc = {}
                    if match_one(sp['root'], kids[i], isc, sp, ctx): hit = {'type': sp['name'], **isc}; break
                if not hit: break
                items.append(hit); i += 1
            if items: sc[n['inserts']] = items
            continue
        if n.get('each'):
            items = []
            while i < len(kids):
                isc = {}; ctx['idx'] = len(items)
                if not match_one(n, kids[i], isc, spec, ctx): break
                items.append(isc['_'] if list(isc) == ['_'] else isc); i += 1
            if not items: return False
            sc[n['each']] = items; continue
        if n.get('opt'):
            tmp = {}
            if i < len(kids) and match_one(n, kids[i], tmp, spec, ctx): sc.update(tmp); i += 1
            continue
        if i >= len(kids) or not match_one(n, kids[i], sc, spec, ctx): return False
        i += 1
    return i == len(kids)

def match_one(n, el, sc, spec, ctx):
    page_cta = ctx['cta']
    if 'cta' in n:
        if not is_cta(el) or el.attrs.get('class') is None: return False
        if any(not (k == 'class' or k.startswith('data-') or (k == 'style' and ctx.get('ignore_style'))) for k in el.attrs): return False
        if el.get('style') and ctx.get('ignore_style'): ctx.setdefault('_dropped', []).append(('cta', el['style']))
        b = el.find('button')
        if not b or len(kids_of(el)) != 1 or has_stray_text(el): return False
        act = 'price' if 'openPricePopup' in (b.get('onclick') or '') else 'booking'
        if act != page_cta['action'] or el.has_attr('data-product') != page_cta['attrs']: return False
        if ('ec-main-btn--light' in (b.get('class') or [])) != bool(n.get('light')): return False
        sc[n['cta']] = b.get_text(' ', strip=True); return True
    if 'btn' in n:
        if el.name != 'button' or cls_of(el) != 'ec-main-btn': return False
        act = 'price' if 'openPricePopup' in (el.get('onclick') or '') else 'booking'
        if act != page_cta['action']: return False
        sc[n['btn']] = el.get_text(' ', strip=True); return True
    if 'table' in n:
        if el.name != 'div' or cls_of(el) != n['wrap'] or el.attrs.keys() - {'class'}: return fail(el, 'таблиця')
        tb = kids_of(el)
        if len(tb) != 1 or tb[0].name != 'table' or cls_of(tb[0]) != n['tcls'] or tb[0].attrs.keys() - {'class'}: return fail(el, 'таблиця')
        parts = kids_of(tb[0])
        if [x.name for x in parts] != ['thead', 'tbody'] or any(x.attrs for x in parts): return fail(el, 'таблиця: thead/tbody')
        hr = kids_of(parts[0])
        if len(hr) != 1 or hr[0].name != 'tr' or hr[0].attrs: return fail(el, 'таблиця: шапка')
        head = []
        for c in kids_of(hr[0]):
            if c.name != 'th' or c.attrs or (kids_of(c) and not only_inline(c)): return fail(el, 'таблиця: th')
            head.append(inline(c))
        rows = []
        for r in kids_of(parts[1]):
            if r.name != 'tr' or r.attrs: return fail(el, 'таблиця: tr')
            cells = []
            for c in kids_of(r):
                if c.name != 'td' or c.attrs or (kids_of(c) and not only_inline(c)): return fail(el, 'таблиця: td')
                cells.append(inline(c))
            rows.append({'cells': cells})
        if not head or not rows: return False
        sc['head'] = head; sc['rows'] = rows; return True
    if 'flow' in n:
        if el.name != 'div' or cls_of(el) != 'fl-block' or (el.attrs.keys() - {'class'} - ({'style'} if ctx.get('ignore_style') else set())): return fail(el, 'схема етапів')
        if el.get('style') and ctx.get('ignore_style'): ctx.setdefault('_dropped', []).append(('div.fl-block', el['style']))
        tr = kids_of(el)
        if len(tr) != 1 or tr[0].name != 'div' or cls_of(tr[0]) != 'fl-block__track': return False
        sp = kids_of(tr[0]); nodes = []; seps = set()
        for i2, x in enumerate(sp):
            want_c = 'fl-block__node' if i2 % 2 == 0 else 'fl-block__sep'
            if x.name != 'span' or cls_of(x) != want_c or kids_of(x) or x.attrs.keys() - {'class'}: return fail(el, 'схема: елемент')
            if i2 % 2 == 0: nodes.append(x.get_text(strip=True))
            else: seps.add(x.get_text(strip=True))
        if not nodes or len(sp) % 2 == 0 or len(seps) > 1: return fail(el, 'схема: розділювачі')
        sc[n['flow']] = nodes
        if seps and list(seps)[0] != '→': sc[n['flow'] + '_sep'] = list(seps)[0]
        return True
    if el.name != n.get('tag'): return fail(el, f"очікувався <{n.get('tag')}>")
    want = n.get('cls') or ''
    got = cls_of(el)
    m = re.fullmatch(r'\{(\w+)\}', want)
    if m:
        opts = [o[0] for o in spec['selects'][m.group(1)]]
        if got == '' and '_plain' in opts: got = '_plain'
        if got not in opts: return fail(el, f'клас «{got}» не з варіантів {opts}')
        sc[m.group(1)] = got
    elif got != want: return fail(el, f'клас «{got}» ≠ «{want}»')
    allowed = {'class'} | set((n.get('af') or {}).keys()) | set((n.get('oaf') or {}).keys()) | set((n.get('sattr') or {}).keys()) | set(n.get('ign') or []) | ({'style'} if ctx.get('ignore_style') else set())
    if set(el.attrs) - allowed: return fail(el, f'зайві атрибути {sorted(set(el.attrs) - allowed)}')
    for a, f in (n.get('oaf') or {}).items():
        if el.get(a): sc[f] = el[a]
    for a, v in (n.get('sattr') or {}).items():
        if el.get(a) not in (None, v): return fail(el, f'атрибут {a}')
    if el.get('style') and ctx.get('ignore_style'): ctx.setdefault('_dropped', []).append((el.name + ('.' + cls_of(el).split()[0] if cls_of(el) else ''), el['style']))
    for a, f in (n.get('af') or {}).items(): sc[f] = el.get(a, '')
    if n.get('void'): return not kids_of(el)
    if 'md' in n:
        if n.get('lead') or n.get('tail'):
            el = copy.copy(el); ks = kids_of(el)
            if n.get('lead'):
                if not ks or ks[0].name != 'span' or ks[0].get_text(strip=True) != n['lead'] or ks[0].attrs: return False
                ks[0].extract(); ks = kids_of(el)
            if n.get('tail') and ks and ks[-1].name == 'span' and not ks[-1].attrs and not any(isinstance(x, NavigableString) and x.strip() for x in ks[-1].next_siblings):
                sc[n['tail']] = ks[-1].get_text(strip=True); ks[-1].extract()
        if kids_of(el) and not only_inline(el): return fail(el, 'складний вміст замість тексту')
        sc[n['md']] = inline(el); return bool(sc[n['md']]) or fail(el, 'порожній текст')
    if 'text' in n:
        if kids_of(el): return False
        sc[n['text']] = re.sub(r'\s+', ' ', el.get_text()).strip(); return bool(sc[n['text']])
    if 'index' in n:
        want_t = str(ctx['idx'] + 1).zfill(2 if n['index'] == 'pad2' else 1)
        return not kids_of(el) and el.get_text(strip=True) == want_t
    if 'kids' in n:
        if has_stray_text(el): return fail(el, 'текст між елементами')
        ok = match_children(n['kids'], kids_of(el), sc, spec, ctx)
        if not ok and LAST_FAIL[0] is None: fail(el, 'діти не збіглися з описом')
        return ok
    if n.get('static'): return not kids_of(el) and not el.get_text(strip=True)
    return fail(el, 'невідомий вузол')

def match_block(sec, ctx):
    """Повертає {'type': name, ...дані} або None."""
    for spec in CATALOG:
        if spec.get('group') == 'insert': continue
        sc = {}; ctx['_dropped'] = []; LAST_FAIL[0] = None
        try:
            if match_one(spec['root'], sec, sc, spec, ctx):
                ctx.setdefault('dropped', []).extend((spec['name'],) + d for d in ctx['_dropped'])
                return {'type': spec['name'], **sc}
        except Exception:
            continue
    return None
