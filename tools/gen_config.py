#!/usr/bin/env python3
"""Генерує форму CMS (список блоків) з каталогу. Запуск: python3 tools/gen_config.py"""
import json, yaml, copy, re

CAT = json.load(open('src/_includes/product/catalog.json', encoding='utf-8'))
cfg_path = 'src/admin/config.yml'
cfg = yaml.safe_load(open(cfg_path, encoding='utf-8'))

LABELS = {'kicker': 'Надзаголовок (малий напис над заголовком)', 'title': 'Заголовок', 'text': 'Текст', 'body': 'Текст', 'intro': 'Вступ',
          'items': 'Пункти', 'cards': 'Картки', 'cta_text': 'Текст кнопки', 'note': 'Примітка', 'label': 'Підпис', 'value': 'Значення'}
MD = {'buttons': ['bold', 'italic'], 'modes': ['rich_text'], 'editor_components': []}
MD_BODY = {'buttons': ['bold', 'italic', 'bulleted-list'], 'modes': ['rich_text'], 'editor_components': []}

def label(spec, name):
    if name == '_': return 'Текст'
    if name in spec['labels']: return spec['labels'][name]
    if name in LABELS: return LABELS[name]
    m = re.fullmatch(r'([a-z_]+?)(\d+)', name)
    if m and m.group(1) in LABELS: return f'{LABELS[m.group(1)]} {m.group(2)}'
    return 'Текст (' + name.replace('_', ' ') + ')'


def walk(n, spec, out, seen):
    """Збирає поля вузла (у порядку появи)."""
    if n.get('inserts'):
        add(out, seen, {'label': 'Вставки (додаткові елементи в цьому блоці)', 'name': n['inserts'], 'widget': 'list', 'required': False, 'label_singular': 'вставку',
                        'add_to': 'bottom', 'hint': 'Чіпи, примітки, списки з іконками, цифри, ціна… — додавайте скільки потрібно.', 'types': INSERT_TYPES})
        return
    if 'body' in n: add(out, seen, {'label': label(spec, n['body']), 'name': n['body'], 'widget': 'markdown', 'hint': 'Жирний — кнопка B. Список — кнопка зі списком.', **MD_BODY}); return
    if 'cta' in n or 'btn' in n:
        f = n.get('cta') or n.get('btn'); add(out, seen, {'label': label(spec, f), 'name': f, 'widget': 'string', 'required': False}); return
    if n.get('table'):
        add(out, seen, {'label': 'Заголовки стовпців', 'name': 'head', 'widget': 'list', 'field': {'label': 'Стовпець', 'name': 'item', 'widget': 'string'}})
        add(out, seen, {'label': 'Рядки таблиці', 'name': 'rows', 'widget': 'list', 'summary': '{{fields.cells}}', 'fields': [{'label': 'Клітинки рядка (по порядку стовпців)', 'name': 'cells', 'widget': 'list', 'field': {'label': 'Клітинка', 'name': 'item', 'widget': 'string'}}]}); return
    if n.get('flow'):
        add(out, seen, {'label': label(spec, n['flow']), 'name': n['flow'], 'widget': 'list', 'required': False, 'field': {'label': 'Етап', 'name': 'item', 'widget': 'string'}})
        add(out, seen, {'label': 'Знак між пунктами схеми (за замовчуванням →)', 'name': n['flow'] + '_sep', 'widget': 'string', 'required': False, 'default': '→'}); return
    if n.get('each'):
        sub, sseen = [], set(); walk_children(n, spec, sub, sseen)
        if [f['name'] for f in sub] == ['_']:
            f = sub[0]; add(out, seen, {'label': label(spec, n['each']), 'name': n['each'], 'widget': 'list', 'field': {**{k: v for k, v in f.items() if k != 'name'}, 'name': 'item', 'label': 'Пункт'}})
        else:
            add(out, seen, {'label': label(spec, n['each']), 'name': n['each'], 'widget': 'list', 'fields': sub, 'summary': '{{fields.%s}}' % next((f['name'] for f in sub if f['widget'] in ('string', 'markdown')), 'title')})
        return
    walk_children(n, spec, out, seen)

def walk_children(n, spec, out, seen):
    m = re.fullmatch(r'\{(\w+)\}', n.get('cls') or '')
    if m and m.group(1) in spec['selects']:
        var = m.group(1); opts = spec['selects'][var]
        add(out, seen, {'label': spec['labels'].get(var, 'Вигляд'), 'name': var, 'widget': 'select', 'default': opts[0][0], 'options': [{'label': ('Варіант ' + l.lstrip('-') if l.startswith('-') else l), 'value': v} for v, l in opts]})
    for fkey, w in (('md', 'md'), ('text', 'string')):
        if fkey in n:
            name = n[fkey]; opt = n.get('opt') == name
            if w == 'md' and name in ('title',): f = {'widget': 'string', 'hint': 'Для переносу рядка напишіть <br>'}
            elif w == 'md': f = {'widget': 'markdown', **MD}
            else: f = {'widget': 'string'}
            add(out, seen, {'label': label(spec, name), 'name': name, **f, **({'required': False} if (opt or name not in ('title',)) else {})})
    for a, f in (n.get('oaf') or {}).items():
        add(out, seen, {'label': label(spec, f), 'name': f, 'widget': 'string', 'required': False})
    if n.get('start'):
        add(out, seen, {'label': label(spec, n['start']), 'name': n['start'], 'widget': 'string', 'required': False})
    if n.get('tail'):
        add(out, seen, {'label': label(spec, n['tail']), 'name': n['tail'], 'widget': 'string', 'required': False})
    for a, f in (n.get('af') or {}).items():
        add(out, seen, {'label': label(spec, f), 'name': f, 'widget': 'image' if a == 'src' else 'string', 'required': a != 'src' and False})
    for k in n.get('kids', []): walk(k, spec, out, seen)

def add(out, seen, f):
    if f['name'] in seen: return
    seen.add(f['name']); out.append(f)

def first_field(spec, fields):
    for f in fields:
        if f['widget'] in ('string', 'markdown') and f['name'] not in ('kicker',): return f['name']
    return fields[0]['name'] if fields else 'title'

def with_defaults(fields, sample):
    for f in fields:
        if f['name'] not in (sample or {}): continue
        v = sample[f['name']]
        if f['widget'] == 'list' and 'types' in f: continue
        if f['widget'] == 'select': continue
        f['default'] = v
        if f['widget'] == 'list' and 'fields' in f and isinstance(v, list) and v and isinstance(v[0], dict):
            for sub in f['fields']:
                pass
    return fields

def type_for(spec):
    fields, seen = [], set()
    walk(spec['root'], spec, fields, seen)
    with_defaults(fields, spec.get('sample'))
    t = {'label': spec['label'], 'name': spec['name'], 'widget': 'object', 'summary': '{{fields.%s}}' % first_field(spec, fields), 'fields': fields}
    if spec['hint']: t['hint'] = spec['hint']
    return t

INSERT_TYPES = [type_for(x) for x in CAT if x['group'] == 'insert']
for _t in INSERT_TYPES: _t['label'] = '＋ ' + _t['label']
pg = next(c for c in cfg['collections'] if c['name'] == 'pages')
blocks = next(f for f in pg['fields'] if f['name'] == 'blocks')
old = {t['name']: t for t in blocks['types']}

hidden = lambda n: {'name': n, 'widget': 'hidden', 'required': False}
intro = {'label': 'Вступ (фото + текст + кнопка)', 'name': 'intro', 'widget': 'object', 'summary': '{{fields.title}}', 'fields': [
    {'label': 'Картинка', 'name': 'image', 'widget': 'image'}, {'label': 'Підпис до картинки (для Google)', 'name': 'image_alt', 'widget': 'string', 'required': False},
    {'label': 'Надзаголовок', 'name': 'kicker', 'widget': 'string', 'required': False}, {'label': 'Заголовок', 'name': 'title', 'widget': 'string', 'hint': 'Для переносу рядка напишіть <br>'},
    {'label': 'Текст', 'name': 'body', 'widget': 'markdown', 'required': False, **MD_BODY},
    {'label': 'Дані під текстом (формат, тривалість…)', 'name': 'meta', 'widget': 'list', 'required': False, 'fields': [{'label': 'Назва', 'name': 'label', 'widget': 'string'}, {'label': 'Значення', 'name': 'value', 'widget': 'string'}]},
    {'label': 'Текст кнопки', 'name': 'cta_text', 'widget': 'string', 'required': False}, hidden('elements'), hidden('after'), hidden('text'), hidden('cta_action'), hidden('cta_attrs'), hidden('cta_style')]}
faq = {'label': 'Питання і відповіді (FAQ)', 'name': 'faq', 'widget': 'object', 'summary': '{{fields.title}}', 'fields': [
    {'label': 'Надзаголовок', 'name': 'kicker', 'widget': 'string', 'required': False}, {'label': 'Заголовок', 'name': 'title', 'widget': 'string'},
    {'label': 'Питання', 'name': 'items', 'widget': 'list', 'summary': '{{fields.question}}', 'fields': [
        {'label': 'Питання', 'name': 'question', 'widget': 'string'}, {'label': 'Відповідь', 'name': 'answer', 'widget': 'markdown', **MD}]}]}
final = {'label': 'Завершення (заклик + кнопка)', 'name': 'final', 'widget': 'object', 'summary': '{{fields.title}}', 'fields': [
    {'label': 'Заголовок', 'name': 'title', 'widget': 'string', 'hint': 'Для переносу рядка напишіть <br>'},
    {'label': 'Текст', 'name': 'body', 'widget': 'markdown', 'required': False, **MD_BODY},
    {'label': 'Текст кнопки', 'name': 'cta_text', 'widget': 'string', 'required': False}, hidden('elements'), hidden('text'), hidden('cta_action'), hidden('cta_attrs'), hidden('cta_style')]}
special = copy.deepcopy(old['section']); special['label'] = '⚠ Особливий блок (складний — краще не чіпати структуру)'

page_types = [type_for(s) for s in CAT if s['group'] == 'page']
ex_types = [type_for(s) for s in CAT if s['group'] == 'example']
for t in ex_types: t['label'] = '★ ' + t['label']
for t in page_types: t['label'] = '▪ ' + t['label']
raw = {'label': '⚠ Свій HTML (для розробника)', 'name': 'raw', 'widget': 'object', 'fields': [{'label': 'HTML', 'name': 'html', 'widget': 'text'}]}
blocks['types'] = [intro] + ex_types + page_types + [faq, final, special, raw]
blocks['label'] = 'Блоки сторінки (додайте, перетягніть, видаліть)'
blocks['add_to'] = 'bottom'

# режим кнопок (форма заявки / календар) — службове поле: календар поки лише на експрес-консультації
if not any(f['name'] == 'cta' for f in pg['fields']):
    i = next(n for n, f in enumerate(pg['fields']) if f['name'] == 'blocks')
    pg['fields'].insert(i, {'name': 'cta', 'widget': 'hidden', 'required': False})
for f in pg['fields']:
    if f['name'] == 'cta': f.clear(); f.update({'name': 'cta', 'widget': 'hidden', 'required': False})
    if f['name'] == 'css': f['default'] = '/css/new-pages.css'; f['label'] = 'Файл стилів (/css/new-pages.css — для нових сторінок)'
# FAQ-іконку прибрано; старих типів немає
yaml.safe_dump(cfg, open(cfg_path, 'w', encoding='utf-8'), allow_unicode=True, sort_keys=False, width=160, default_flow_style=False)
print('типи блоків у формі:', [t['name'] for t in blocks['types']])
