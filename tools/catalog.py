#!/usr/bin/env python3
"""Каталог блоків: єдине джерело правди. Генерує catalog.json (для сайту, прев'ю та зіставлення)."""
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def E(tag, cls=None, *kids, **kw):
    d = {'tag': tag}
    if cls is not None: d['cls'] = cls
    if kids: d['kids'] = list(kids)
    d.update(kw)
    return d

KICK = E('p', 'ec-kicker', text='kicker', opt='kicker')
TITLE = E('h2', None, md='title')
HEAD_BLOCK = E('div', 'ec-section-heading', KICK, TITLE)
def HEAD(prefix): return E('div', f'{prefix}__heading', KICK, TITLE)
def BODY(name='body', ulcls=''): return {'body': name, 'ulcls': ulcls}
def CTA_INLINE(): return E('div', 'ec-inline-cta', {'cta': 'cta_text'}, opt='cta_text')
INSERTS = {'inserts': 'inserts'}
def LI(field='_'): return E('li', None, md=field)

SPECS = []
def add(name, label, root, group='page', selects=None, labels=None, hint=None):
    SPECS.append({'name': name, 'label': label, 'group': group, 'root': root, 'selects': selects or {}, 'labels': labels or {}, 'hint': hint or ''})

# ---------- Блоки зі сторінок продуктів ----------
add('text', 'Текст (з рамкою)', E('section', 'ec-detail ec-animate',
    E('div', '{variant}', HEAD_BLOCK, BODY('body', 'ec-check-list'), INSERTS, {'body': 'body_more', 'ulcls': 'ec-check-list', 'opt': 'body_more'}, CTA_INLINE())),
    selects={'variant': [['ec-detail__single', 'Звичайний'], ['ec-detail__single diagnostic-not-for', 'Виділений («кому не підійде»)']]},
    labels={'body': 'Текст', 'body_more': 'Продовження тексту (після вставок)', 'variant': 'Вигляд', 'cta_text': 'Текст кнопки (залиште порожнім, якщо кнопка не потрібна)'},
    hint='Абзаци та списки з галочками. Виділяйте слова жирним кнопкою B.')
add('text_photo', 'Текст + фото експерта', E('section', 'ec-detail ec-animate',
    E('div', 'ec-detail__expertise',
      E('div', 'ec-detail__single', HEAD_BLOCK, BODY('body', 'ec-check-list'), INSERTS),
      E('div', 'ec-detail__photo', E('img', None, af={'src': 'photo', 'alt': 'photo_alt'}, void=True)))),
    labels={'body': 'Текст', 'photo': 'Фото', 'photo_alt': 'Підпис до фото (для Google)'})
add('checklist', 'Список з галочками', E('section', 'ec-wide ec-animate',
    E('div', 'ec-wide__box', KICK, TITLE,
      E('p', 'ec-section-intro', md='intro', opt='intro'),
      E('ul', '{list_style}', E('li', None, md='_', each='items')),
      E('p', '{closing_style}', md='closing', opt='closing'),
      INSERTS,
      CTA_INLINE())),
    selects={'list_style': [['ec-check-list ec-wide-list', 'Галочки'], ['ec-check-list ec-wide-list ec-check-list--ticks', 'Галочки (великі)'], ['ec-check-list ec-wide-list diagnostic-question-list', 'Питання']],
             'closing_style': [['info-note', 'Примітка'], ['ec-result-closing', 'Підсумок'], ['_plain', 'Звичайний абзац']]},
    labels={'items': 'Пункти списку', 'intro': 'Вступ над списком', 'closing': 'Текст під списком', 'list_style': 'Вигляд списку', 'closing_style': 'Вигляд тексту під списком', 'cta_text': 'Текст кнопки (порожньо — без кнопки)'})
add('cards', 'Картки з заголовками', E('section', 'ec-wide ec-animate',
    E('div', 'ec-wide__box', KICK, TITLE,
      E('p', 'ec-section-intro', md='intro', opt='intro'),
      E('div', '{grid}', E('article', None, E('h3', None, md='title'), BODY('body', 'ec-check-list'), INSERTS, {'body': 'body_more', 'ulcls': 'ec-check-list', 'opt': 'body_more'}, each='cards')),
      E('p', '{note_style}', md='note', opt='note'),
      INSERTS,
      CTA_INLINE())),
    selects={'grid': [['diagnostic-card-grid', 'Картки (великі)'], ['diagnostic-method-grid', 'Картки (методи)'], ['info-question-grid', 'Картки-питання'], ['diagnostic-card-grid vc-implement-grid', 'Картки (впровадження)']],
             'note_style': [['info-note', 'Примітка'], ['ec-coffee-note', 'Примітка (кава)']]},
    labels={'cards': 'Картки', 'body_more': 'Продовження тексту картки (після вставки)', 'cta_text': 'Текст кнопки (порожньо — без кнопки)', 'intro': 'Вступ над картками', 'note': 'Примітка під картками', 'grid': 'Вигляд сітки', 'note_style': 'Вигляд примітки', 'body': 'Текст картки'})
add('steps', 'Кроки (1, 2, 3…)', E('section', 'ec-process ec-animate',
    HEAD_BLOCK,
    E('p', 'ec-section-intro', md='intro', opt='intro'),
    E('div', 'ec-coffee-note', md='note_before', opt='note_before'),
    E('div', 'ec-steps', E('article', 'ec-step', E('div', 'ec-step__num', index='1'), E('h3', None, md='title'), E('p', None, md='text'), each='steps')),
    E('div', 'ec-coffee-note', md='note_after', opt='note_after')),
    labels={'steps': 'Кроки', 'intro': 'Вступ', 'note_before': 'Примітка перед кроками', 'note_after': 'Примітка після кроків'})
add('numbered', 'Нумерований перелік', E('section', 'ec-how ec-animate',
    HEAD_BLOCK,
    E('p', 'ec-section-intro', md='intro', opt='intro'),
    E('p', 'ec-section-intro', md='intro2', opt='intro2'),
    E('div', 'ec-how__grid', E('div', None, E('span', None, index='1'), E('p', None, md='_'), each='items')),
    E('div', 'ec-coffee-note', md='note', opt='note'),
    INSERTS,
    CTA_INLINE()),
    labels={'items': 'Пункти', 'intro': 'Вступ', 'intro2': 'Другий абзац вступу', 'note': 'Примітка', 'cta_text': 'Текст кнопки (порожньо — без кнопки)'})

add('result', 'Результат (список + цифри)', E('section', 'ec-result ec-animate',
    E('div', 'ec-result__grid',
      E('div', 'ec-result__content', KICK, TITLE,
        E('p', None, md='intro', opt='intro'),
        E('div', 'ec-result-list', E('div', None, E('h3', None, md='title'), E('p', None, md='text'), each='items'))),
      E('div', 'ec-result__quote', E('div', None, E('span', None, text='value'), E('strong', None, md='label'), each='stats')),
      E('p', 'ec-result-note', md='note', opt='note'))),
    labels={'items': 'Результати', 'stats': 'Цифри справа', 'value': 'Цифра / значок', 'label': 'Підпис', 'intro': 'Вступ над списком', 'note': 'Текст під блоком'})
add('result_notes', 'Результат (було / стало + примітки)', E('section', 'ec-result ec-animate',
    E('div', 'ec-result__grid',
      E('div', 'ec-result__content', KICK, TITLE,
        E('div', 'ec-result__main',
          E('div', 'ec-result-list', E('div', None, E('h3', None, md='title'), E('p', None, md='text'), each='items')),
          E('div', 'ec-result__quote', E('div', None, E('span', None, text='value'), E('strong', None, md='label'), each='stats'))),
        E('div', 'ec-result-notes', E('p', 'ec-coffee-note', md='_', each='notes'))))),
    labels={'items': 'Пункти (було / стало)', 'stats': 'Виділена зміна справа', 'value': 'Цифра / напис', 'label': 'Підпис',
            'notes': 'Примітки під блоком'})
add('benefits', 'Переваги (номер + заголовок + текст)', E('section', 'ec-how ec-animate',
    HEAD_BLOCK,
    E('div', 'ec-how__grid vc-benefits', E('div', None, E('span', None, index='1'), E('h3', None, md='title'), E('p', None, md='text'), each='items'))),
    labels={'items': 'Переваги', 'title': 'Заголовок пункту', 'text': 'Текст пункту'})

add('st', 'Етапи проєкту (кроки з результатом)', E('section', 'st-block ec-animate',
    HEAD('st-block'),
    {'flow': 'flow', 'opt': 'flow'},
    E('div', 'st-block__intro',
      E('h3', 'st-block__intro-title', md='intro_title', tail='intro_tag', opt='intro_title'),
      E('p', None, md='intro_text', opt='intro_text'), opt=['intro_title', 'intro_text']),
    E('div', 'st-steps', E('article', 'st-step',
        E('div', 'st-step__head', E('span', 'st-step__num', index='1', start='steps_start', sattr={'aria-hidden': 'true'}), E('h3', None, md='title')),
        E('div', 'st-step__body', BODY('text', 'st-step__list'), INSERTS, E('p', 'st-step__result', lead='Результат', md='result', opt='result')),
        each='steps')),
    INSERTS,
    E('div', 'st-block__cta', {'cta': 'cta_text'}, opt='cta_text')),
    group='example',
    labels={'flow': 'Схема етапів зверху (кожен пункт — один етап; необов’язково)', 'intro_title': 'Вступний етап — заголовок', 'intro_tag': 'Позначка в заголовку (напр. «(безкоштовно)»)',
            'intro_text': 'Вступний етап — текст', 'steps': 'Етапи', 'steps_start': 'Номер першого кроку (якщо є вступний етап)', 'text': 'Опис етапу (абзаци та список)', 'result': 'Результат етапу', 'cta_text': 'Текст кнопки (порожньо — без кнопки)'})

add('stages', 'Етапи зі вступом і списком', E('section', 'ec-process ec-animate',
    HEAD_BLOCK,
    E('div', 'ec-coffee-note', md='note_before', opt='note_before'),
    E('div', 'iso-stages', E('article', 'iso-stage',
        E('div', 'iso-stage__head', E('span', 'iso-stage__num', index='1', sattr={'aria-hidden': 'true'}), E('h3', None, md='title')),
        E('div', 'iso-stage__body', E('p', 'iso-stage__lead', md='lead', opt='lead'), BODY('text', 'ec-check-list'), INSERTS, E('p', 'iso-stage__result', lead='Результат', md='result', opt='result')),
        each='stages')),
    E('div', 'ec-coffee-note', md='note_after', opt='note_after')),
    labels={'stages': 'Етапи', 'lead': 'Головна фраза етапу', 'text': 'Опис етапу (абзаци та список)', 'result': 'Результат етапу',
            'note_before': 'Примітка перед етапами', 'note_after': 'Примітка після етапів'})

# ---------- Блоки з бібліотеки прикладів (pryklady-blokiv) ----------
add('hl', 'Акцентна смуга', E('div', 'hl-block ec-animate', E('p', 'hl-block__text', md='text')), group='example', labels={'text': 'Текст'}, hint='Одне речення. Виділіть головне слово жирним.')
add('cf', 'Порівняння 2 колонок', E('section', 'cf-block ec-animate', HEAD('cf-block'),
    E('div', 'cf-block__grid',
      E('div', 'cf-block__col', E('h3', None, text='col1_title'), E('ul', 'cf-block__list', E('li', None, md='_', each='col1_items'))),
      E('div', 'cf-block__col cf-block__col--accent', E('h3', None, text='col2_title'), E('ul', 'cf-block__list', E('li', None, md='_', each='col2_items'))))),
    group='example', labels={'col1_title': 'Ліва колонка — заголовок', 'col1_items': 'Ліва колонка — пункти', 'col2_title': 'Права колонка (виділена) — заголовок', 'col2_items': 'Права колонка — пункти'})
add('tg', 'Три картки з міткою', E('section', 'tg-block ec-animate', HEAD('tg-block'),
    E('div', 'tg-block__grid', E('article', 'tg-card', E('span', 'tg-card__label', text='label'), E('h3', None, md='title'), E('p', None, md='text'), each='cards'))),
    group='example', labels={'cards': 'Картки', 'label': 'Мітка (напр. «Минуле»)'})
add('nr', 'Нумеровані результати', E('section', 'nr-block ec-animate', HEAD('nr-block'),
    E('div', 'nr-list', E('article', 'nr-item', E('div', 'nr-item__num', index='1'), E('div', 'nr-item__body', E('h3', None, md='title'), E('p', None, md='text')), each='items'))),
    group='example', labels={'items': 'Пункти'})
add('ic', 'Картки з номерами 01, 02…', E('section', 'ic-block ec-animate', HEAD('ic-block'),
    E('div', 'ic-grid', E('article', 'ic-card', E('div', 'ic-card__mark', index='pad2'), E('h3', None, md='title'), E('p', None, md='text'), each='cards'))),
    group='example', labels={'cards': 'Картки'})
add('stat', 'Цифри в рядок', E('section', 'stat-wrap ec-animate',
    E('div', 'stat-row', E('div', 'stat-item', E('div', 'stat-item__value', text='value'), E('div', 'stat-item__label', text='label'), each='items'))),
    group='example', labels={'items': 'Цифри', 'value': 'Цифра (напр. 20+)', 'label': 'Підпис'})
add('qz', 'Цитата', E('div', 'qz-block ec-animate', E('div', 'qz-block__inner', E('p', 'qz-block__quote', md='quote'), E('p', 'qz-block__author', text='author', opt='author'))),
    group='example', labels={'quote': 'Цитата', 'author': 'Підпис (необов’язково)'})
add('ct', 'Вузький заклик з кнопкою', E('div', 'ct-strip ec-animate', E('p', None, md='text'), {'cta': 'cta_text'}), group='example', labels={'text': 'Текст', 'cta_text': 'Текст кнопки'})
add('bn', 'Бордова смуга з кнопкою', E('div', 'bn-strip ec-animate', E('div', 'bn-strip__inner', E('div', 'bn-strip__text', E('h2', None, text='title'), E('p', None, md='text')), {'btn': 'cta_text'})),
    group='example', labels={'title': 'Заголовок', 'text': 'Текст', 'cta_text': 'Текст кнопки'})
add('pain', 'Болі власника (список)', E('section', 'pain-block ec-animate', HEAD('pain-block'),
    E('div', 'pain-list', E('div', 'pain-item', md='_', each='items'))),
    group='example', labels={'items': 'Ситуації'}, hint='Початок речення виділіть жирним — так і задумано.')
add('who', 'Для кого (ролі)', E('section', 'who-grid ec-animate', HEAD('who-grid'),
    E('div', 'who-grid__list', E('article', 'who-card', E('span', 'who-card__role', text='role'), E('h3', None, md='title'), E('p', None, md='text'), each='cards'))),
    group='example', labels={'cards': 'Картки', 'role': 'Роль (напр. «Власник»)'})
add('outcome', 'Що отримаєте (картки)', E('section', 'outcome-grid ec-animate', HEAD('outcome-grid'),
    E('div', 'outcome-grid__list', E('article', 'outcome-card', E('h3', None, md='title'), E('p', None, md='text'), each='cards'))),
    group='example', labels={'cards': 'Картки'})
add('tx', 'Вільний текст (без рамки)', E('section', '{variant}', KICK, TITLE, BODY('body', ''), INSERTS),
    selects={'variant': [['tx-block ec-animate', 'Звичайний'], ['tx-block tx-block--narrow ec-animate', 'Вужчий'], ['tx-block tx-block--center ec-animate', 'По центру'], ['tx-block tx-block--rule ec-animate', 'З лінією зверху']]},
    group='example', labels={'body': 'Текст', 'variant': 'Вигляд'})
add('service_links', 'Посилання на суміжні послуги', E('section', 'service-links ec-animate',
    HEAD('service-links'),
    E('div', 'service-links__grid', E('a', 'service-link',
        E('h3', None, md='title'),
        E('p', None, md='text'),
        af={'href': 'url'}, each='links'))),
    group='example',
    labels={'links': 'Посилання на послуги', 'url': 'Адреса сторінки (напр. /upravlinskiy-oblik/)', 'title': 'Заголовок', 'text': 'Короткий опис'},
    hint='Перелінковка на суміжні сторінки послуг.')
add('cmp_wrap', 'Порівняльна таблиця', E('section', 'cmp-wrap ec-animate',
    HEAD('cmp-wrap'),
    {'table': 'table', 'wrap': 'cmp-table-wrap', 'tcls': 'cmp-table'}),
    group='example',
    labels={'head': 'Заголовки стовпців', 'rows': 'Рядки таблиці'},
    hint='Перший стовпець — назви рядків, далі — значення для порівняння.')
add('progress_wrap', 'Шкали прогресу', E('section', 'progress-wrap ec-animate',
    E('div', 'progress-list',
      E('div', 'progress-item',
        E('label', None, md='label', tail='value'),
        E('div', 'progress-bar', E('span', None, style='width:{pct}%')),
        each='items'))),
    group='example',
    labels={'items': 'Показники', 'label': 'Назва показника', 'value': 'Значення словами (напр. «високий»)', 'pct': 'Заповнення шкали, % (0–100)'})

add('vz_block', 'Важливо / кому не підійде', E('section', 'vz-block ec-animate',
    E('div', 'vz-block__box', E('div', 'vz-block__heading', KICK, TITLE), BODY('text', ''), INSERTS)),
    group='example',
    labels={'text': 'Текст блоку', 'kicker': 'Надзаголовок', 'title': 'Заголовок'})

import os
_base = os.path.dirname(os.path.abspath(__file__))
def _load(n):
    p = os.path.join(_base, n)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
_have = {x['name'] for x in SPECS}
for sp in (_load('catalog_auto.json') or []):
    if sp['name'] not in _have: SPECS.append(sp); _have.add(sp['name'])
# вставка «схема кроків» (А → Б → В), що трапляється всередині блоків
SPECS.append({'name': 'flow_track', 'label': 'Схема кроків (А → Б → В)', 'group': 'insert', 'root': {'flow': 'flow'}, 'selects': {},
              'labels': {'flow': 'Кроки схеми (кожен — окремий пункт)'}, 'hint': ''})
SPECS.append({'name': 'table', 'label': 'Таблиця', 'group': 'insert', 'root': {'table': 'table', 'wrap': 'diagnostic-table-wrap', 'tcls': 'diagnostic-table'}, 'selects': {}, 'labels': {}, 'hint': 'Заголовки стовпців, далі рядки: клітинки по порядку стовпців.'})
SPECS.append({'name': 'formula_line', 'label': 'Формула (А → Б → В жирним)', 'group': 'insert', 'root': E('p', 'vc-flow', md='text'), 'selects': {}, 'labels': {'text': 'Формула'}, 'hint': ''})
SPECS.append({'name': 'note_para', 'label': 'Примітка-абзац (під таблицею)', 'group': 'insert', 'root': E('p', 'diagnostic-note', md='text'), 'selects': {}, 'labels': {'text': 'Текст'}, 'hint': ''})
SPECS.append({'name': 'result_line', 'label': 'Рядок «Результат: …»', 'group': 'insert', 'root': E('p', 'st-step__result', lead='Результат', md='text'), 'selects': {}, 'labels': {'text': 'Результат'}, 'hint': ''})
SPECS.append({'name': 'contrast_pair', 'label': 'Пара «було → стало»', 'group': 'insert',
              'root': E('div', 'contrast-pair',
                        E('span', 'contrast-pair__was', md='was'),
                        E('span', 'contrast-pair__arrow', static='→'),
                        E('span', 'contrast-pair__now', md='now')),
              'selects': {}, 'labels': {'was': 'Було (напр. «більше продавати»)', 'now': 'Стало (напр. «бачити, де реально заробляєте»)'}, 'hint': ''})
SPECS.append({'name': 'result_pill', 'label': 'Капсула з результатом', 'group': 'insert',
              'root': E('p', 'result-pill', E('strong', None, static='Результат'), E('span', None, md='text')),
              'selects': {}, 'labels': {'text': 'Що отримає власник'}, 'hint': ''})
SPECS.append({'name': 'question_line', 'label': 'Рядок-питання', 'group': 'insert',
              'root': E('div', 'question-line', md='text'),
              'selects': {}, 'labels': {'text': 'Питання власника'}, 'hint': ''})
SPECS.append({'name': 'scope_tags', 'label': 'Мітки обсягу робіт', 'group': 'insert',
              'root': E('div', 'scope-tags', E('span', 'scope-tag', md='_', each='items')),
              'selects': {}, 'labels': {'items': 'Мітки (напр. «для власника», «для фіндира»)'}, 'hint': ''})
SPECS.append({'name': 'decision_line', 'label': 'Рядок-рішення', 'group': 'insert',
              'root': E('div', 'decision-line', E('b', None, static='Рішення:'), E('span', None, md='text')),
              'selects': {}, 'labels': {'text': 'Управлінське рішення'}, 'hint': ''})
SPECS.append({'name': 'formula_row', 'label': 'Формула зі стрілками', 'group': 'insert',
              'root': E('div', 'formula-row', E('span', None, md='_', each='items', sepCls='formula-row__sep', sep='→')),
              'selects': {}, 'labels': {'items': 'Ланки формули (кожна — окремий пункт)'}, 'hint': ''})
SPECS.append({'name': 'owner_quote', 'label': 'Цитата власника', 'group': 'insert',
              'root': E('div', 'owner-quote', md='text'),
              'selects': {}, 'labels': {'text': 'Думка власника'}, 'hint': ''})
SPECS.append({'name': 'next_step', 'label': 'Наступний крок', 'group': 'insert',
              'root': E('div', 'next-step', E('strong', None, static='Наступний крок'), E('span', None, md='text')),
              'selects': {}, 'labels': {'text': 'Що робимо далі'}, 'hint': ''})
SPECS.append({'name': 'promise_line', 'label': 'Рядок-обіцянка', 'group': 'insert',
              'root': E('p', 'promise-line', md='text'),
              'selects': {}, 'labels': {'text': 'М’яке зобов’язання формату'}, 'hint': ''})
SPECS.append({'name': 'cn_note', 'label': 'Примітка під секцією (по центру)', 'group': 'insert',
              'root': E('p', 'cn-note', md='text'),
              'selects': {}, 'labels': {'text': 'Текст примітки'}, 'hint': ''})
import catalog_patch
catalog_patch.apply(SPECS, E, BODY, INSERTS)
_samples = _load('catalog_samples.json') or {}
for sp in SPECS:
    r = sp['root']
    if sp['group'] != 'insert' and r.get('tag') in ('section', 'div') and 'oaf' not in r:
        r['oaf'] = {'id': 'anchor'}
        sp['labels'].setdefault('anchor', 'Якір (id для посилання на цей блок, напр. process; необов’язково)')
for sp in SPECS:
    if sp['name'] in _samples and not sp.get('sample'): sp['sample'] = _samples[sp['name']]

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'src/_includes/product/catalog.json'
    json.dump(SPECS, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('catalog:', len(SPECS), 'блоків ->', out)
