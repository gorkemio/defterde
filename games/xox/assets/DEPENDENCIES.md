# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |
| `fonts/MarckScript-Regular.ttf` | [google/fonts `ofl/marckscript`](https://github.com/google/fonts/tree/main/ofl/marckscript) (latin + latin-ext + kiril) | SIL OFL 1.1, `fonts/MarckScript-OFL.txt` |

Türkçe karakterleri içeren tam fontlar kullanılır (ğ ş ı İ ç ö ü denetlenir).
Font sürümü yükseltilirse dosya adı ve `kit/kagit.css` / `kit/dolmakalem.css` adresleri birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.
Marck Script'te "→" yok: başlıklarda kullanılmaz.
