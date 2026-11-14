#!/usr/bin/env python3
"""Порівнює зібрану сторінку з оригіналом (нормалізовано: пробіли, коментарі, b/strong)."""
import re, sys, difflib
from bs4 import BeautifulSoup
def norm(p):
    t = open(p, encoding='utf-8', errors='replace').read()
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'<(/?)b>', r'<\1strong>', t)
    import os
    if os.environ.get('STRIP_STYLE'): t = re.sub(r'\sstyle="[^"]*"', '', t)
    t = re.sub(r'(href=")(?!/|http|#|mailto|tel)([\w.-]+\.css")', r'\1/css/\2', t)
    s = BeautifulSoup(t, 'lxml')
    for sc in s.find_all('script', type='application/ld+json'):
        import json
        try: sc.string = json.dumps(json.loads(sc.string), sort_keys=True, ensure_ascii=False)
        except Exception: pass
    return re.sub(r'\s+', ' ', s.prettify()).split('> <')
orig, built = sys.argv[1], sys.argv[2]
A, B = norm(orig), norm(built)
d = [l for l in difflib.unified_diff(A, B, lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]
print(f'{orig.split("/")[-2]}: токенів {len(A)} / {len(B)}, відмінностей {len(d)}')
for x in d[:int(sys.argv[3]) if len(sys.argv) > 3 else 8]: print('   ', x[:260])
