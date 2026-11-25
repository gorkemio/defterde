# İçerik kaynakları ve uyarlama

20 Ekim 2026 teslimi **20 özgün yerleşim + 100 Peces uyarlaması = 120 hazır bulmaca** içerir. Her kayıt gerçek yedi parçanın çözüm pozlarını taşır. Hiçbir siluet mockup piksellerinden veya bağımsız bir hayvan SVG'sinden çıkarılmadı.

## Özgün yerleşimler

İlk 20 kaydın kaynak verisi `tools/content/originals.json` içindedir. Her kayıt `source.kind: original` ve tasarım notu taşır. Önceki fazlarda üretilen bu kayıtların geometri doğrulaması bütün katalogla birlikte yeniden çalıştırılır.

## Peces 5.2

- Üretici: **Innocent De Marchi**.
- Proje: [Peces / Tangram game](https://sourceforge.net/projects/pecesjocdetangr/).
- Sürüm: 5.2; [Debian kaynak arşivi](https://deb.debian.org/debian/pool/main/g/glpeces/glpeces_5.2.orig.tar.gz).
- Klasik yedi parça verisi: arşivde `glpeces-5.2/fig/t7.fig`.
- Lisans: **GNU General Public License, version 2 or later**. Arşivin COPYING dosyası değiştirilmeden [peces-GPL-2.0.txt](../assets/licenses/peces-GPL-2.0.txt) olarak saklanır.
- Özgün veri: [peces-t7.fig](../tools/content/source/peces-t7.fig). Tam dosya geliştirici kaynağıdır; oyun bu dosyayı yüklemez.
- Seçim ve uyarlama kaydı: [curation.json](../tools/content/curation.json). Her seçimin özgün etiketi, kaynak satırı, Türkçe adı, kategorisi, uyarlama notu ve gerçek çözüm koordinatları vardır.

Peces'ten türeyen yerleşimler, seçilmiş çözüm verileri ve `test/fixtures/touching-silhouettes.json` veri örneği aynı GPL-2.0-or-later kaynak bildirimiyle korunur. Üretilen kategori dosyalarının başında lisans bağlantısı; her uyarlanmış kaydın `source` alanında üretici, lisans ve kaynak bulunur. Bu bildirim Kalam/OFL, Rough.js/MIT, polygon-clipping/MIT veya mevcut Defterde kit'inin lisansını değiştirmez.

## Seçme ve dönüştürme

Önceden adlandırılmış kaynak konular arasından, dış silueti ve standart yedi parçaya uygunluğu incelenerek seçim yapıldı. Bir nesne kategorisindeki boşluğu doldurmak için rastgele birleşim oluşturulup sonradan adlandırılmadı.

`tools/content/import-peces.cjs`, kaynak parça türlerini sabit Tangram parça türlerine dönüştürür. Kaynağın 45° dışında kalan dönüşleri otomatik kabul edilmez. Ölçek yalnız dosyanın ortak koordinat biriminden kanonik birime geçiş içindir; oyundaki parçalarda ölçek alanı yoktur.

Kaynak ondalıkları nedeniyle birbirine çok yakın kalan köşe/kenarlar doğrusal temas kısıtlarıyla kesinleştirildi. İçe aktarmada yakın temas eşiği 0,06 mantıksal birim; izin verilen en büyük merkez düzeltmesi 0,12 birimdir. Bu eşikler **oyun tamamlanma toleransı değildir**. Sonuç ancak mevcut sıkı geometri testlerinden geçerse kabul edilir; temas düzeltmesi ölçek veya açı değiştirmez.

Yunus (`Delfi.001`) için kaynakta izin verilmeyen kuyruk açısı vardı. Ayrı, açıkça kaydedilmiş uyarlamada orta üçgen kuyruğu izinli 0° yönünde gövde köşesine bağlandı; kalan parçalar standart tutuldu. Bu işlem otomatik tolerans genişletmesi değildir. Seçilen diğer dönüşler ve uyarlamalar `curation.json` içinde kayıtlıdır.

`tools/content/build-catalog.cjs`, 20 özgün ve 100 seçilmiş kaydı birleştirir, bütün katalogda geometri/kopya denetimi yapar ve on kategori betiğini üretir. Oyunu çalıştırmak bu araca bağlı değildir.

```sh
npm run catalog:build
npm run catalog:check
npm run catalog:previews
```

## Bütünlük

| Dosya | SHA-256 |
|---|---|
| `glpeces_5.2.orig.tar.gz` | `5a36e343eee30437f4b99533a22a2d29a99b995c8952ec4fc0da8d36e4515ebe` |
| `tools/content/source/peces-t7.fig` | `62eeb408079df47a7e8523f617d66067406ff24b81d50c6de857888260b76ee7` |
| `assets/licenses/peces-GPL-2.0.txt` | `e6ded242602d40aa7c20e09721994d55fea76953ce774045bf3b16fd6bf56b05` |

## Kabul sınırı

120 kayıt geometri açısından geçerli ve dönme/aynalanma altında benzersizdir. Tanınabilirlik otomatik geometriden çıkarılmaz. Bütün kayıtlar `reviewStatus: pending` durumundadır; kullanıcı adına kabul verilmedi. `review.html` isimsiz inceleme ve karar raporunu hazırlar. Zorluklar da başlangıç tahminidir; gerçek oyun ve içerik incelemesine göre gözden geçirilmelidir.
