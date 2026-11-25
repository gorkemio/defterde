# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/Kalam-Regular.ttf` | [google/fonts `ofl/kalam`](https://github.com/google/fonts/tree/main/ofl/kalam) | SIL OFL 1.1, `fonts/Kalam-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |
| `fonts/PTSerif-Regular.ttf`, `fonts/PTSerif-Bold.ttf` | [google/fonts `ofl/ptserif`](https://github.com/google/fonts/tree/main/ofl/ptserif) (`PT_Serif-Web-Regular.ttf`, `PT_Serif-Web-Bold.ttf`, ParaType) | SIL OFL 1.1, `fonts/PTSerif-OFL.txt` |
| `fonts/ArchivoNarrow-wght.ttf` | [google/fonts `ofl/archivonarrow`](https://github.com/google/fonts/tree/main/ofl/archivonarrow) (`ArchivoNarrow[wght].ttf`, değişken ağırlık 400–700) | SIL OFL 1.1, `fonts/ArchivoNarrow-OFL.txt` |

Kibrit kurşun kalem marjında Kalam, gazete kupüründe PT Serif (metin) ve Archivo Narrow (başlık, damga) ile yazar; Patrick Hand
kit'in `kagit.css`'indeki varsayılan tanım içindir. Türkçe karakterler (Ç, Ğ, İ, Ö, Ş, Ü, ı) dört fontta da vardır.
Font sürümü yükseltilirse dosya adı ve `kit/gazete.css` / `kit/kursunkalem.css` / `kit/kagit.css` adresleri birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.
