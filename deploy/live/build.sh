#!/usr/bin/env bash
# Сборка «как на carvic.ru» (публичная витрина): site/ + .htaccess + api/notfound.php,
# без README и юр. черновиков (в витрине их маршруты закрыты). → dist/carvic-live.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/dist"; BUILD="$OUT/carvic-live"
mkdir -p "$OUT"
if [ -d "$BUILD" ]; then find "$BUILD" -mindepth 1 -delete; else mkdir -p "$BUILD"; fi
mkdir -p "$BUILD/site"
cp -R "$ROOT/site/." "$BUILD/site/"
find "$BUILD/site" -name 'README.md' -delete
if [ -d "$BUILD/site/legal" ]; then find "$BUILD/site/legal" -mindepth 1 -delete; rmdir "$BUILD/site/legal"; fi
cp "$ROOT/deploy/live/.htaccess" "$BUILD/site/.htaccess"
mkdir -p "$BUILD/site/api"; cp "$ROOT/deploy/live/api/notfound.php" "$BUILD/site/api/"
cp "$ROOT/deploy/live/ИЗМЕНЕНИЯ.txt" "$BUILD/" 2>/dev/null || true
python3 - "$BUILD" <<'PY'
import hashlib, json, os, sys
root = sys.argv[1] + '/site'; sums = {}
for d, _, fs in os.walk(root):
    for f in sorted(fs):
        p = os.path.join(d, f); sums[os.path.relpath(p, root)] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
json.dump(dict(sorted(sums.items())), open(sys.argv[1] + '/SHA256SUMS.json', 'w'), ensure_ascii=False, indent=2)
PY
( cd "$BUILD" && rm -f "$OUT/carvic-live.zip" && zip -qr -X "$OUT/carvic-live.zip" . )
echo "Готово: $OUT/carvic-live.zip"
