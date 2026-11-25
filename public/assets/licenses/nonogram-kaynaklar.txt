# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Bu dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) (noktaoyunu/assets kopyası) | MIT, `vendor/rough-LICENSE` |
| `fonts/ArchitectsDaughter-Regular.ttf` | [google/fonts ofl/architectsdaughter](https://github.com/google/fonts/tree/main/ofl/architectsdaughter) (1.003) | SIL OFL 1.1, `fonts/ArchitectsDaughter-OFL.txt` |
| `fonts/Kalam-Regular.ttf` | google/fonts ofl/kalam (Kalam 2.001) | SIL OFL 1.1, `fonts/Kalam-OFL.txt` |
| `fonts/PatrickHand-v25.ttf` | Google Fonts Patrick Hand v25 | SIL OFL 1.1, `fonts/PatrickHand-OFL.txt` |

Oyunun bütün yazısı Architects Daughter'dır (Türkçe karakterleri içerir; ← → okları yoktur, arayüzde ok kullanılmaz).
Kalam `kit/kursunkalem.css`'te, Patrick Hand `kit/kagit.css`'te tanımlı olduğu için durur (WebKit `file://` altında tanımlı dosyayı yoklar); bu oyun kullanmaz.
İpucu rakamları font değildir: `kit/rakam.js` glifleri rough.js darbeleriyle çizilir.
