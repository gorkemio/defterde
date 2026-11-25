# Yerel varlıklar

Çalışma sırasında dış ağ isteği yapılmaz. Kaynak yolları ve kopyalanan her
dosyanın SHA-256 değeri `../docs/kit-sources.json` içinde kayıtlıdır.

- rough.js 4.6.6: `vendor/rough-4.6.6.js`, MIT lisansı `vendor/rough-LICENSE`.
- Patrick Hand: `fonts/PatrickHand-v25.ttf`, lisans `fonts/PatrickHand-OFL.txt`.
- Kalam Regular: `fonts/Kalam-Regular.ttf`, lisans `fonts/Kalam-OFL.txt`.
- Ortak Defterde kit'i ve gren: `../kit/`; mevcut kardeş projeden değişmeden kopyalandı.
- Kâğıt kenarı: `paper-edge.svg`, mevcut Domino uygulamasından kopyalandı.
  CSS'teki data URL aynı SVG içeriğidir; yerel dosya protokolünde maskenin
  ayrıca yüklenmesini gerektirmez.

`kit/kursunkalem.css` kullanılmaz; içerdiği eski ahşap zemin onaylanan Kakuro
tasarımına ait değildir. JavaScript çizim ve ses yardımcıları yereldir.
Bu fazda ses oynatılmaz.
