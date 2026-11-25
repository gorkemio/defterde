# Elle çizilmiş görseller (isteğe bağlı)

Buraya kendi çizimlerini koyabilirsin. Hepsi **PNG, şeffaf arka plan**. Dosyayı koyduktan sonra adını
`varliklar.js` içindeki listeye ekle (tarayıcı `file://` ile açıldığında klasör listelenemediği için).
Listedeki bir dosya yoksa oyun o parça için kendi çizdiği SVG'ye döner.

| Dosya | Ne | Oran |
|---|---|---|
| `zar-1.png` … `zar-6.png` | Zar yüzleri (pipler resmin içinde). 7–12 yüzleri rakamla çizilir, resim gerekmez. | kare |
| `rakip-normal.png` | Rakip karakter, sakin hali. Diğer haller yoksa bu kalır. | 5 : 7 |
| `rakip-dusunuyor.png`, `rakip-saskin.png`, `rakip-sevincli.png`, `rakip-uzgun.png` | Düşünürken / büyük dikdörtgen görünce / sevinirken / kaybedince. | 5 : 7 |

Resimler kendi kutusuna sığacak şekilde ölçeklenir (zar 2.2 kare, karakter 5×7 kare).


## Yerel başlangıç bağımlılıkları

Oyun harici CDN veya font isteği yapmaz; aşağıdaki dosyalar dağıtımın parçasıdır.

| Dosya | Kaynak | Lisans |
|---|---|---|
| `vendor/rough-4.6.6.js` | [rough.js 4.6.6 klasik tarayıcı paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE.txt` |
| `fonts/PatrickHand-Regular.ttf` | [Google Fonts / Patrick Hand](https://github.com/google/fonts/tree/main/ofl/patrickhand), 18 Ekim 2026 kopyası | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Lisanslar ilgili dosyalarla birlikte dağıtılmalıdır. Güncelleme sonrasında `sh surum.sh`
çalıştırılır. Çalıştırma için npm, derleme, ağ bağlantısı veya web sunucusu gerekmez;
`index.html` doğrudan `file://` ile açılabilir.
