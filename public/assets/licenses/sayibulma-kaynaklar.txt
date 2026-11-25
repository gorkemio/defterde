# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/Kalam-Regular.ttf` | [google/fonts `ofl/kalam`](https://github.com/google/fonts/tree/main/ofl/kalam) (latin + latin-ext) | SIL OFL 1.1, `fonts/Kalam-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Bu oyun Kalam ile yazar (kırmızı-mavi kalem malzemesi); Patrick Hand kit'in `kagit.css`'indeki varsayılan tanım içindir.
Türkçe karakterleri içeren tam fontlar kullanılır. Font sürümü yükseltilirse dosya adı ve `kit/kirmizimavi.css` / `kit/kagit.css`
adresleri birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.
