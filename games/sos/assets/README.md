# Elle çizilmiş görseller (isteğe bağlı)

Buraya kendi çizimlerini koyabilirsin. Hepsi **PNG, şeffaf arka plan**. Dosyayı koyduktan sonra adını
`varliklar.js` içindeki listeye ekle (tarayıcı `file://` ile açıldığında klasör listelenemediği için).
Listedeki bir dosya yoksa oyun o parça için kendi çizdiği SVG'ye döner.

| Dosya | Ne | Oran |
|---|---|---|
| `karakter-normal.png` | Köşedeki rakip karakter, sakin hali. Diğer haller yoksa bu kalır. | kare |
| `karakter-dusunuyor.png` | Rakip düşünürken (baloncuktaki "..." oyun tarafından çizilir). | kare |
| `karakter-sirit.png` | Rakip SOS yapınca. | kare |
| `karakter-somurt.png` | Sen SOS yapınca. | kare |
| `sus-gunes.png`, `sus-bulut.png`, `sus-kalp.png`, `sus-yildiz.png`, `sus-ok.png` | Köşe karalamaları. | kendi kutusuna sığar |

Resimler kendi kutusuna sığacak şekilde ölçeklenir.
