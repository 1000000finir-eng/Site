"""Ручні доповнення до автоматично побудованих описів (варіанти, які трапляються на реальних сторінках)."""

def find(node, cls):
    if (node.get('cls') or '') == cls: return node
    for k in node.get('kids', []):
        r = find(k, cls)
        if r: return r
    return None

def apply(specs, E, BODY, INSERTS):
    by = {s['name']: s for s in specs}
    # cf / tg: необов’язковий вступний абзац у заголовку блоку
    if 'cf' in by:
        h = find(by['cf']['root'], 'cf-block__heading')
        if h and not any(k.get('opt') == 'lead' for k in h['kids']): h['kids'].append(E('p', 'cf-block__lead', md='lead', opt='lead'))
        by['cf']['labels']['lead'] = 'Вступ під заголовком'
    if 'tg' in by:
        h = find(by['tg']['root'], 'tg-block__heading')
        if h and not any(k.get('opt') == 'intro' for k in h['kids']): h['kids'].append(E('p', 'tg-block__intro', md='intro', opt='intro'))
        by['tg']['labels']['intro'] = 'Вступ під заголовком'
    if 'tg' in by:
        card = find(by['tg']['root'], 'tg-card')
        if card:
            card['kids'] = [k for k in card['kids'] if not (k.get('md') == 'text')] + [BODY('text', '')]
        by['tg']['labels']['text'] = 'Текст картки'
    # xp: основний текст — довільна кількість абзаців; вставки під ним
    if 'xp_block' in by:
        b = find(by['xp_block']['root'], 'xp-block__body')
        if b: b['kids'] = [BODY('body', ''), INSERTS]
        by['xp_block']['labels']['body'] = 'Текст під фото (абзаци)'
    return specs
