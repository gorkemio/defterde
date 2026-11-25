# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Bu dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) (sos'tan kopya) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |
| `fonts/Kalam-Regular.ttf` | [google/fonts ofl/kalam](https://github.com/google/fonts/tree/main/ofl/kalam) (Kalam 2.001, Indian Type Foundry), sha256 `57cecb63…dc923c0b` | SIL OFL 1.1, `fonts/Kalam-OFL.txt` |

Kalam latin ve latin-ext alt kümelerini içerir; Türkçe karakterler (ğ ş ı İ ç ö ü) tam fontta vardır.
Font sürümü yükseltilirse dosya adı ve `kit/kursunkalem.css` adresi birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.
`kit/kagit.css` içindeki Patrick Hand `@font-face` tanımı kitte durur (tükenmez malzemesinin fontu). Bu oyunda metin o aileyi kullanmaz; yine de WebKit `file://` altında tanımlı dosyayı yoklayıp bulamayınca konsola hata yazdığı için dosya burada da bulunur.
