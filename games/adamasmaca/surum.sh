#!/bin/sh
# index.html'deki yerel dosyaların ?v=... damgasını dosya içeriklerinden günceller.
# Neden: Cloudflare ve tarayıcılar .js/.css dosyalarını saatlerce önbellekte tutuyor; damga değişince adres de
# değişir ve yeni sürüm hemen gelir. (git commit öncesi otomatik çalışır: .git/hooks/pre-commit)
cd "$(dirname "$0")" || exit 1
[ -f index.html ] || exit 0          # index.html henüz yoksa (Faz 3'ten önce) yapacak bir şey yok
V=$(find . -type f \( -name '*.js' -o -name '*.css' -o -name '*.png' \) \
      -not -path './test/*' -not -path './.claude/*' -not -path './.git/*' -not -path './ham/*' \
      -not -path './scripts/*' -not -path './node_modules/*' | LC_ALL=C sort | xargs cat | shasum | cut -c1-8)
sed -E "s/\?v=[0-9a-f]{8}/?v=$V/g" index.html > index.html.tmp && mv index.html.tmp index.html
echo "surum damgasi: $V"
