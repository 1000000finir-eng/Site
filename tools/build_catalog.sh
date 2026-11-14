#!/bin/sh
# Повна перебудова каталогу блоків і форми CMS (запускати з кореня проєкту)
set -e
python3 tools/catalog.py                # каталог із ручних описів + tools/catalog_auto.json
python3 tools/verify_catalog.py         # перевірка на прикладах + записує приклади значень
python3 tools/catalog.py                # ще раз: підтягнути приклади значень
python3 tools/gen_config.py             # форма CMS
