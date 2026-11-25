#!/bin/sh
# index.html'deki yerel dosyaların ?v=... damgasını dosya içeriklerinden günceller.
# Neden: Cloudflare ve tarayıcılar .js/.css dosyalarını saatlerce önbellekte tutuyor; damga değişince adres de
# değişir ve yeni sürüm hemen gelir. (git commit öncesi otomatik çalışır: .git/hooks/pre-commit)
cd "$(dirname "$0")" || exit 1
V=$(cat config.js game.js ai.js draw.js ses.js layout.js viewport.js placement.js main.js style.css gren.png assets/varliklar.js vendor/rough-4.6.6.js | shasum | cut -c1-8)
sed -E "s/\?v=[0-9a-f]{8}/?v=$V/g" index.html > index.html.tmp && mv index.html.tmp index.html
echo "surum damgasi: $V"
