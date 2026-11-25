# Yerel varlıklar ve kaynakları

Oyun çalışma sırasında internetten dosya istemez. Aşağıdaki dağıtımlar depoda tutulur; güncellemede lisans ve SHA-256 birlikte yenilenmelidir.

| Dosya | Kaynak / sürüm | Lisans |
|---|---|---|
| `vendor/polygon-clipping-0.15.7.js` | [polygon-clipping 0.15.7](https://www.npmjs.com/package/polygon-clipping/v/0.15.7), npm paketinin `dist/polygon-clipping.umd.min.js` dosyası | MIT; `vendor/polygon-clipping-LICENSE.md` |
| `vendor/rough-4.6.6.js` | Mevcut Defterde Dokuz Taş kit'indeki Rough.js 4.6.6; [proje](https://github.com/rough-stuff/rough) | MIT; `vendor/rough-LICENSE` |
| `fonts/Kalam-Regular.ttf` | Mevcut Defterde Dokuz Taş kit'i; [Google Fonts Kalam](https://github.com/google/fonts/tree/main/ofl/kalam) | SIL OFL; `fonts/Kalam-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | Mevcut Defterde Dokuz Taş kit'i; kit CSS'inin yerel font referansı | SIL OFL; `fonts/PatrickHand-OFL.txt` |

Etkin arayüz fontu Türkçe karakterleri destekleyen yerel Patrick Hand'dir; Defterde platform kopyasıyla aynı dosya kullanılır. Kalam önceki görsel çalışmanın yerel varlığı olarak korunur.

Güncel yüzey ortak kit'in kareleri ve grenini kullanır.

`kit/kagit.css`, `kit/kalem.js`, `kit/gren.png` ve `kit/ses.js`, aynı proje ailesinin `../defterde/games/dokuztas/kit/` kopyasından alınmıştır. Kit'in kaynaklarında ayrıca bir açık kaynak lisans bildirimi bulunmadığından bu dosyalar üçüncü taraflara açık lisanslıymış gibi sunulmaz. `ses.js` kaynak olarak korunur; etkin `sound.js` kısa ve düşük seviyeli kâğıt sesini yerel Web Audio ile üretir. Gren resmi mevcut kit varlığıdır; bu çalışma sırasında üretilmiş görsel değildir.

## Bulmaca verisi

100 hazır yerleşim, Innocent De Marchi'nin [Peces 5.2](https://sourceforge.net/projects/pecesjocdetangr/) projesindeki klasik yedi parçalı şekillerden uyarlanmıştır. Bu verinin lisansı GPL-2.0-or-later'dır; tam lisans `licenses/peces-GPL-2.0.txt` içinde, özgün veri `../tools/content/source/peces-t7.fig` içinde tutulur. Her uyarlamada kaynak etiket ve satır numarası vardır. Kalan 20 yerleşim bu proje için özgün hazırlanmıştır. Ayrıntılı kapsam, SHA-256 ve yeniden üretim bilgisi [CONTENT-SOURCES.md](../docs/CONTENT-SOURCES.md) içinde.

## SHA-256

```text
7f8619e84a86ce8dd400c9b50430e9c8cf8f26027b19eeb479f109f5c1a9d688  assets/vendor/polygon-clipping-0.15.7.js
6853af8619532f3939b156cd16824d2e14f31e71d3df306ad5558eeafacab194  assets/vendor/rough-4.6.6.js
57cecb63d4608019371954274ae1d8c397764debd5b19d4a33c1efa4dc923c0b  assets/fonts/Kalam-Regular.ttf
8a384204c8ab3e9ed82954d46d8110a66fb5d7acf8f6b64c6f3980c1d0c01993  assets/fonts/PatrickHand-v25.ttf
454bfa9e1918b3d24f8d86651333f73f17a2e6b1d11e51e0e618bb7e1a3d5bf5  kit/gren.png
```
