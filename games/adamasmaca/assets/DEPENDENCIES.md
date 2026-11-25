# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Bu dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Patrick Hand lisansı [google/fonts kaynağından](https://github.com/google/fonts/blob/main/ofl/patrickhand/OFL.txt) alınmıştır. Türkçe karakterleri içeren tam font kullanılır. Font sürümü yükseltilirse dosya adı ve `kit/kagit.css` adresi birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.
