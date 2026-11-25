# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) | MIT, `vendor/rough-LICENSE` |
| `fonts/CourierPrime-Regular.ttf`, `fonts/CourierPrime-Bold.ttf` | [google/fonts `ofl/courierprime`](https://github.com/google/fonts/tree/main/ofl/courierprime) (Alan Dague-Greene, The Courier Prime Project Authors) | SIL OFL 1.1, `fonts/CourierPrime-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | [Google Fonts Patrick Hand v25](https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf) | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Bütün oyun metni Courier Prime ile daktiloyla basılır (`kit/daktilo.css`); Patrick Hand yalnız kit'in `kagit.css`'indeki varsayılan
tanım içindir. Courier Prime'da Türkçe harflerin hepsi var (ç ğ ı İ ö ş ü, Ç Ğ Ö Ş Ü ve â î û; cmap tablosundan doğrulandı,
20 Ekim 2026); `←` yok, bu yüzden geri bağlantı daktilonun `‹` işaretiyle yazılır.
Font sürümü yükseltilirse dosya adı ve `kit/daktilo.css` adresleri birlikte güncellenmelidir; ardından `./surum.sh` çalıştırılır.

Veri kaynakları (kelime listeleri, Faz 2) ve lisansları README'nin "Veri kaynakları ve lisanslar" bölümündedir.
