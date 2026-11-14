# Сайт на Eleventy + Sveltia CMS

> **Конструктор сайту** (локальний редактор на Tauri 2 + Svelte 5) лежить у папці `constructor/` — див. `constructor/README.md`.

## Перевірити локально (без заливки на GitHub)
1. `npm ci`
2. `npm start` → сайт на http://localhost:8080/
3. Відкрий http://localhost:8080/admin/ у Chrome або Edge → **Work with Local Repository** → вибери цю папку.
4. «Головна сторінка» і «Сторінки продуктів»: справа — попередній перегляд у стилі сайту. Збереження пише у `src/_data/home.json` та `src/_content/pages/*.json`.

Після змін у шаблонах блоків (`src/_includes/product/*`, `tools/catalog.py`) перезапусти `npm start`.

## Залити в репозиторій (один раз)
1. У репозиторії видали старі файли з кореня (папку `.git` не чіпай).
2. Розпакуй архів у корінь репозиторію.
3. Картинки: у присланому архіві `assets/images`, `assets/gallery`, `assets/clients` були порожні — скопіюй свої справжні папки `assets/*` у `src/assets/`.
4. У `src/admin/config.yml` заміни `OWNER/REPO` на `логін/назва-репозиторію`.
5. GitHub → Settings → Pages → Source: **GitHub Actions**.
6. `git add . && git commit -m "CMS" && git push`.

## Вхід в адмінку (репозиторій у власниці сайту)
1. Репозиторій — **публічний** (на безкоштовному GitHub Pages з приватного репозиторію не працює). Settings → Collaborators → додати розробника з правом Write.
2. Settings → Pages → Source: **GitHub Actions**. Домен: у старому репозиторії спершу прибрати Custom domain, у новому вказати `i-s-business-consulting.pp.ua` (файл `CNAME` вже в проєкті).
3. Токен: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:
   Name «CMS сайту», Expiration 1 рік, Repository access → *Only select repositories* → цей репозиторій, Permissions → Repository permissions → **Contents: Read and write**. Токен показується один раз — зберегти в менеджері паролів.
4. Відкрити `https://i-s-business-consulting.pp.ua/admin/` → **Sign in with token** → вставити токен. Збереження в CMS = коміт, сайт оновиться за ~1–2 хв.
   Якщо Sveltia не прийме fine-grained токен — створити classic токен з правом `repo`.

## Як це влаштовано
- `src/_data/home.json` — розділи і картки головної
- `src/_content/pages/*.json` — сторінки продуктів (список блоків)
- `src/_content/bottoms/*.html` — нижня частина сторінок (модалки, форма заявки, `PAGE_PRODUCT`, футер): дослівно як в оригіналі, в CMS не редагується
- `src/css/*.css` — стилі сторінок (у кожної сторінки свій); `blocks.css` = бібліотека прикладів, для нових сторінок
- `tools/catalog.py` + `tools/catalog_auto.json` — **каталог блоків і вставок**: з нього генеруються HTML сайту, форма CMS і зіставлення зі старими сторінками. `catalog_auto.json` побудований автоматично з `pryklady-blokiv` (`python3 tools/infer_catalog.py`); ручні описи — у `catalog.py`.
  Після змін у каталозі: `./tools/build_catalog.sh`
- `tools/catalog_patch.py` — ручні доповнення до автоописів (варіанти з реальних сторінок); `tools/why.py <сторінка>` — чому блок не розпізнався
- `src/css/library.css` — **генерується** при збірці з `blocks.css`: стилі блоків і вставок бібліотеки для сторінок із власним CSS (вставки підсилені, щоб їх не перебивали стилі блоку)
- `DROPPED_STYLES.txt` — інлайн-відступи, прибрані при переведенні сторінок на стандартні блоки
- `tools/verify_catalog.py` — перевіряє, що блоки каталогу точно відтворюють приклади з `pryklady-blokiv`
- `src/css/new-pages.css` — стилі нових сторінок (бібліотека прикладів + структурні блоки); `src/_includes/product/bottom-form.tpl` — низ нової сторінки (форма заявки, дані продукту беруться з полів сторінки)
- `tools/extract_page.py`, `tools/compare.py` — перенос старої сторінки в JSON та порівняння з оригіналом
- Скрипти бекенду (`script-safe.js`, `booking/`) копіюються без змін
