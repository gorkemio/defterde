# Elle çizilmiş görseller (isteğe bağlı)

Buraya kendi çizimlerini koyabilirsin. Hepsi **PNG, şeffaf arka plan**. Dosyayı koyduktan sonra adını
`varliklar.js` içindeki listeye ekle (tarayıcı `file://` ile açıldığında klasör listelenemediği için).
Listedeki bir dosya yoksa oyun o parça için kendi çizdiği SVG'ye döner.

| Dosya | Ne | Oran |
|---|---|---|
| `gemi-1.png` … `gemi-4.png` | Yatay duran gemi, burun **sağda**. Yüz resmin içinde olmalı. | genişlik : yükseklik = uzunluk : 1 (ör. `gemi-3.png` 3:1) |
| `gemi-N-saskin.png` | Vurulunca gemi (şaşkın yüz). Yoksa normal resim kalır. | aynı |
| `gemi-N-batik.png` | Batınca gemi (spiral gözler). Yoksa normal resim kalır. | aynı |
| `isabet.png`, `isabet-kirmizi.png` | Benim / rakibin isabet işareti (X, patlama). Kırmızı yoksa `isabet.png`. | kare |
| `iska.png`, `iska-kirmizi.png` | Iska işareti. | kare |
| `batik-dalga.png` | Batan geminin altına konan dalga. | geminin boyu : ~0.45 |

Resimler hücreye sığacak şekilde (1 hücre = kare) ölçeklenir; dikey gemiler oyun tarafından döndürülür.
