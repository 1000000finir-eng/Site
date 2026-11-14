import re
from bs4 import NavigableString, Tag

def esc_md(t):
    return re.sub(r'([\\*_`\[\]<>~])', r'\\\1', t)

def inline(node):
    out = ''
    for ch in node.children:
        if isinstance(ch, NavigableString):
            if type(ch).__name__ == 'Comment': continue
            out += esc_md(re.sub(r'\s+', ' ', str(ch)))
        elif ch.name in ('b', 'strong'):
            out += '**' + inline(ch).strip() + '**' if inline(ch).strip() else ''
        elif ch.name in ('i', 'em'):
            out += '*' + inline(ch).strip() + '*'
        elif ch.name == 'br':
            out += '<br>' if all(isinstance(x, NavigableString) and not x.strip() for x in ch.next_siblings) else '  \n'
        else:
            out += str(ch)  # <a>, <span> … лишаємо як є
    return re.sub(r'[ ]*(  \n)[ ]*', r'\1', out).strip()

def only_inline(node):
    return all(isinstance(c, NavigableString) or c.name in ('b', 'strong', 'i', 'em', 'br', 'a', 'span') for c in node.children)

def cls(el):
    return ' '.join(el.get('class') or [])

def cta_info(card):
    b = card.find('button')
    return {'text': b.get_text(' ', strip=True), 'action': 'price' if 'openPricePopup' in (b.get('onclick') or '') else 'booking',
            'attrs': card.has_attr('data-product'), **({'card_style': card['style']} if card.get('style') else {}), 'light': 'ec-main-btn--light' in (b.get('class') or [])}

def is_cta(el):
    return el.name == 'div' and 'ec-booking-card' in (el.get('class') or [])

