#!/usr/bin/env bash
# Сборка архива для хостинга Рег.ру: сайт + .htaccess + обработчики заявок.
# Запуск из корня репозитория:  bash deploy/regru/build.sh  → dist/carvic-regru.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist"
BUILD="$OUT/carvic-regru"

mkdir -p "$OUT"
if [ -d "$BUILD" ]; then find "$BUILD" -mindepth 1 -delete; else mkdir -p "$BUILD"; fi

cp -R "$ROOT/site/." "$BUILD/"
find "$BUILD" -name 'README.md' -delete           # описание прототипа на хостинг не нужно
cp "$ROOT/deploy/regru/.htaccess" "$BUILD/.htaccess"
mkdir -p "$BUILD/api"
cp "$ROOT/deploy/regru/api/"*.php "$BUILD/api/"   # config.php не копируется: его создаёт владелец

# метка боевой сборки: демо-товары и демо-вход «1/1» выключены на любом домене
python3 - "$BUILD/index.html" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
tag = '<meta name="carvic-env" content="production">'
if tag not in s:
    s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  ' + tag, 1)
open(p, 'w', encoding='utf-8').write(s)
PY
grep -q 'carvic-env' "$BUILD/index.html"

( cd "$BUILD" && rm -f "$OUT/carvic-regru.zip" && zip -qr -X "$OUT/carvic-regru.zip" . )
echo "Готово: $OUT/carvic-regru.zip"
