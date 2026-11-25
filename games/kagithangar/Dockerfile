# Kağıt Hangar — statik site, nginx ile. Yalnız sitenin dosyaları kopyalanır (testler, araçlar, .git girmez).
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css app.js rota.js depo.js isimler.js manifest.webmanifest /usr/share/nginx/html/
COPY simge /usr/share/nginx/html/simge
COPY kit /usr/share/nginx/html/kit
COPY engine /usr/share/nginx/html/engine
COPY ui /usr/share/nginx/html/ui
COPY tasarimlar /usr/share/nginx/html/tasarimlar
# Her derlemeye yeni bir sürüm: index.html kod, stil ve varlıkları /v/<sürüm>/ yolundan ister (nginx bu yolu
# kökteki dosyaya çevirir). Böylece yeni yayın tarayıcıya hemen ulaşır, eski önbellek karışmaz.
RUN SURUM=$(date -u +%Y%m%d%H%M%S) \
 && sed -i -E "s#(src|href)=\"(kit/|style\.css|app\.js)#\1=\"/v/$SURUM/\2#g" /usr/share/nginx/html/index.html \
 && grep -q "/v/$SURUM/app.js" /usr/share/nginx/html/index.html
EXPOSE 80
