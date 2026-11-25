#!/bin/sh
# index.html'deki yerel dosyaların ?v=... damgasını dosya içeriklerinden günceller.
# Neden: tarayıcılar ve CDN'ler .js/.css dosyalarını saatlerce önbellekte tutar; damga değişince adres de
# değişir ve yeni sürüm hemen gelir. (git commit öncesi otomatik çalışır: .git/hooks/pre-commit)
cd "$(dirname "$0")" || exit 1
DOSYALAR=""
for f in config.js game.js ai.js draw.js ses.js layout.js keypad.js akis.js main.js style.css gren.png assets/varliklar.js assets/vendor/rough-4.6.6.js assets/fonts/PatrickHand-Regular.ttf; do
  [ -f "$f" ] && DOSYALAR="$DOSYALAR $f"
done
V=$(cat $DOSYALAR | shasum | cut -c1-8)
sed -E "s/\?v=[0-9a-f]{8}/?v=$V/g" index.html > index.html.tmp && mv index.html.tmp index.html
echo "surum damgasi: $V"
