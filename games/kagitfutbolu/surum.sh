#!/bin/sh
# index.html'deki yerel dosyaların ?v=... damgasını dosya içeriklerinden günceller.
# Neden: Cloudflare ve tarayıcılar .js/.css dosyalarını saatlerce önbellekte tutuyor; damga değişince adres de
# değişir ve yeni sürüm hemen gelir. (git commit öncesi otomatik çalışır: .git/hooks/pre-commit)
cd "$(dirname "$0")" || exit 1
V=$(find . -type f \( -name '*.js' -o -name '*.css' -o -name '*.png' \) \
      -not -path './node_modules/*' -not -path './test-results/*' -not -path './playwright-report/*' -not -path './test/*' -not -path './.claude/*' -not -path './.git/*' | LC_ALL=C sort | xargs cat | shasum | cut -c1-8)
sed -E "s/\?v=[0-9a-f]{8}/?v=$V/g" index.html > index.html.tmp && mv index.html.tmp index.html
echo "surum damgasi: $V"
