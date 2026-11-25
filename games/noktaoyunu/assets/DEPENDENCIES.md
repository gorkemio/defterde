# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Bu dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir. Hepsi `dokuztas/assets`'ten kopyadır.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/Kalam-Regular.ttf` | [google/fonts ofl/kalam](https://github.com/google/fonts/tree/main/ofl/kalam) (Kalam 2.001) | SIL OFL 1.1, `fonts/Kalam-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Kalam Türkçe karakterleri (ğ ş ı İ ç ö ü) içerir; oyunun bütün yazısı Kalam'dır (kurşun kalem notları ve kuru boya harfleri).
Patrick Hand `kit/kagit.css`'te tanımlı olduğu için durur (WebKit `file://` altında tanımlı dosyayı yoklar); bu oyun kullanmaz.
