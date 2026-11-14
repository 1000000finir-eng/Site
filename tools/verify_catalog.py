#!/usr/bin/env python3
"""Перевірка каталогу на сторінці-прикладах: HTML → дані → HTML має збігатися з оригіналом."""
import json, re, subprocess, sys, difflib
from bs4 import BeautifulSoup
sys.path.insert(0, 'tools')
from dsl_match import CATALOG, match_one
html = open('/home/claude/site/pryklady-blokiv/index.html', encoding='utf-8', errors='replace').read()
s = BeautifulSoup(html, 'lxml')
b0 = s.select_one('.ec-booking-card button')
ctx = {'cta': {'action': 'price' if 'openPricePopup' in (b0.get('onclick') or '') else 'booking', 'attrs': s.select_one('.ec-booking-card').has_attr('data-product')}, 'idx': 0}
cases, expected = [], []
SAMPLES = {}
report = []
for spec in [x for x in CATALOG if x.get('group') != 'insert']:
    root = spec['root']; cls = root.get('cls', '')
    m = re.fullmatch(r'\{(\w+)\}', cls)
    firsts = [o[0] for o in spec['selects'][m.group(1)]] if m else [cls]
    found = 0
    for c in firsts:
        sel = root['tag'] + '.' + '.'.join(c.split())
        for el in s.select(sel):
            if el.find_parent(class_='ec-animate') and 'ec-animate' not in (el.get('class') or []) and root['tag'] != 'section': pass
            sc = {}
            if match_one(root, el, sc, spec, ctx):
                cases.append({'name': spec['name'], 'data': sc}); expected.append(str(el)); found += 1
                SAMPLES.setdefault(spec['name'], sc)
    report.append((spec['name'], found))
json.dump({'cases': cases, 'page': {'cta': ctx['cta'], 'booking': {'product': ''}}}, open('/tmp/cases.json', 'w'), ensure_ascii=False)
out = subprocess.run(['node', 'tools/render_cases.mjs', '/tmp/cases.json'], capture_output=True, text=True)
if out.returncode: print(out.stderr[:800]); sys.exit(1)
rendered = json.loads(out.stdout)
def norm(h):
    h = re.sub(r'\saria-hidden="true"', '', h); h = re.sub(r'<!--.*?-->', '', h, flags=re.S); h = re.sub(r'<(/?)b>', r'<\1strong>', h)
    return re.sub(r'\s+', ' ', BeautifulSoup(h, 'lxml').body.prettify()).split('> <')
bad = 0
for c, exp, got in zip(cases, expected, rendered):
    d = [l for l in difflib.unified_diff(norm(exp), norm(got), lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]
    if d: bad += 1; print('✗', c['name'], d[:3])
json.dump(SAMPLES, open('tools/catalog_samples.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('приклади:', ', '.join(f'{n}:{k}' for n, k in report))
print(f'перевірено {len(cases)} блоків з бібліотеки, розбіжностей: {bad}')
