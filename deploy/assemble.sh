#!/usr/bin/env bash
# Builds one checkout of the project into the Hostinger layout:
#   <out>/public_html   shop + admin panel + index.php
#   <out>/veloura       backend code (no .env, storage, tests or dev files)
#
# Usage: deploy/assemble.sh <project dir> <out dir> <hostinger index.php>
set -euo pipefail

src=$(cd "$1" && pwd)
mkdir -p "$2"
out=$(cd "$2" && pwd)
index_php=$(cd "$(dirname "$3")" && pwd)/$(basename "$3")

cd "$src"
npm ci --no-audit --no-fund
npx ng build veloura
npx ng build adminpannel
(cd backend && composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist --no-progress)

rm -rf "$out/public_html" "$out/veloura"
mkdir -p "$out/public_html" "$out/veloura"

cp -r dist/veloura/browser/. "$out/public_html/"
cp -r backend/public/adminpannel "$out/public_html/adminpannel"
cp backend/public/.htaccess backend/public/robots.txt backend/public/favicon.ico "$out/public_html/"
cp "$index_php" "$out/public_html/index.php"

rsync -a backend/ "$out/veloura/" \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'storage/' --exclude 'public/' --exclude 'tests/' \
  --exclude 'node_modules/' --exclude 'bootstrap/cache/*.php' \
  --exclude 'resources/css/' --exclude 'resources/js/' \
  --exclude 'package.json' --exclude 'vite.config.js' --exclude 'phpunit.xml' \
  --exclude '.phpunit.result.cache' --exclude '*.md' \
  --exclude '.editorconfig' --exclude '.gitattributes' --exclude '.npmrc'
