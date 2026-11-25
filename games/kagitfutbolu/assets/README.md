# Elle çizilmiş görseller (isteğe bağlı)

Buraya kendi çizimlerini koyabilirsin. Hepsi **PNG, şeffaf arka plan**. Dosyayı koyduktan sonra adını
`varliklar.js` içindeki listeye ekle (tarayıcı `file://` ile açıldığında klasör listelenemediği için).
Listedeki bir dosya yoksa oyun o parça için kendi çizdiği SVG'ye döner.

| Dosya | Ne |
|---|---|
| `top.png` | Futbol topu (kare). |
| `kaleci-normal.png`, `kaleci-uzgun.png`, `kaleci-sevincli.png` | Kalelerdeki dekoratif kaleci. |
| `kaptan-normal.png`, `-dusunuyor.png`, `-sirit.png`, `-somurt.png` | Sağ alttaki rakip kaptan (eller belde, düşünüyor, seviniyor, elleri başında). `kaptan-normal.png` yoksa hiçbiri kullanılmaz. |
| `sus-kupa.png`, `sus-bayrak.png`, `sus-top.png` | Köşe karalamaları (kupa, köşe bayrağı, top). |

Resimler kendi kutusuna sığacak şekilde ölçeklenir.

## Gerçek ses kayıtları (isteğe bağlı)

Oyunun sesleri tarayıcıda sentezlenir. Daha gerçekçi bir ses istersen kaydı bu klasöre koy ve adını `varliklar.js` içindeki
`sesDosyalari` listesine yaz. Dosya adı sesin adıdır: `gol.mp3` (gol anında tribün), `sikisma.mp3`, `kazan.mp3`, `kaybet.mp3`.
mp3, ogg ya da wav olabilir; 2–4 saniye yeterli. Kayıt açılamazsa oyun sentezlenmiş sese döner. Sessiz düğmesi kayıtları da susturur.
Kullanma hakkın olan (ör. CC0 lisanslı) kayıtları kullan.

## Kaynaklar ve lisanslar

- `vendor/rough-4.6.6.js` — Rough.js 4.6.6'nın klasik tarayıcı paketi (`roughjs@4.6.6/bundled/rough.js`),
  değişiklik yapılmadan yerel sunulur. Kaynak: https://www.npmjs.com/package/roughjs/v/4.6.6 ve
  https://github.com/rough-stuff/rough. MIT lisansının tam metni `vendor/rough-LICENSE.txt` dosyasındadır.
  Sürüm dosya adına sabitlenmiştir; yükseltirken lisansı ve çevrimdışı tarayıcı testini de kontrol edin.

- `gol.mp3` — "Slow starting applause" kaydının 8,0–12,0 sn arası (kalabalığın birden yükselen alkışı). Kayıt: Stephan,
  Düsseldorf, Ren kıyısı, 26 Temmuz 2007 (PDSounds.org 331). Kaynak:
  https://commons.wikimedia.org/wiki/File:Slow_starting_applause.ogg — Lisans: kamu malı (yazar tüm haklarından vazgeçmiş;
  atıf gerekmez, nezaketen yazılır). Değişiklikler: 4 sn'ye kısaltıldı, giriş/çıkışta ses yumuşatıldı, düzeyi 5,9 dB
  düşürüldü (kullanıcı isteğiyle kısıldı), MP3'e çevrildi. Önceki deneme (Work With Sounds / Torsten Nilsson, CC BY 4.0) kaldırıldı.
