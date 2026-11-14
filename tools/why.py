#!/usr/bin/env python3
"""Для кожного «особливого» блоку показує, на чому зіставлення з каталогом зупинилось."""
import sys, json, glob, re
sys.path.insert(0, 'tools')
from bs4 import BeautifulSoup
import dsl_match as M
import extract_page as X
root = '/home/claude/site'
for slug in sys.argv[1:]:
    html = open(f'{root}/{slug}/index.html', encoding='utf-8', errors='replace').read()
    s = BeautifulSoup(html, 'lxml'); hero = s.find('section', id='hero')
    b0 = s.select_one('.ec-booking-card button'); d = s.select_one('.ec-booking-card')
    ctx = {'cta': {'action': 'price' if 'openPricePopup' in (b0.get('onclick') or '') else 'booking', 'attrs': d.has_attr('data-product')}, 'idx': 0, 'ignore_style': True}
    for x in [y for y in hero.find_next_siblings() if y.name == 'section']:
        if M.match_block(x, ctx): continue
        first = (x.get('class') or [''])[0]
        # лучший кандидат: спек с тем же корневым классом
        cands = [sp for sp in M.CATALOG if sp.get('group') != 'insert' and first and first in (sp['root'].get('cls') or '') ]
        why = []
        for sp in cands or M.CATALOG[:0]:
            M.LAST_FAIL[0] = None; sc = {}
            try: M.match_one(sp['root'], x, sc, sp, dict(ctx))
            except Exception as e: M.LAST_FAIL[0] = ('?', f'помилка {e}')
            why.append(f"{sp['name']}: {M.LAST_FAIL[0]}")
        print(f"[{slug[:16]}] {' '.join((x.get('class') or [])[:2])} #{x.get('id') or ''} → {why[:2] or 'немає схожого опису'}")
