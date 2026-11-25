# Yerel bağımlılıklar

Oyun açılırken dış sunucudan betik veya yazı tipi istemez. Dosyalar değiştirilmeden, kendi lisanslarıyla dağıtılır; HTTP ve `file://` kullanımında aynı varlıklar yüklenir.

| Dosya | Sürüm ve kaynak | Lisans |
| --- | --- | --- |
| `vendor/rough-4.6.6.js` | [Rough.js 4.6.6 UMD paketi](https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js) (kibrit'teki kopya) | MIT, `vendor/rough-LICENSE` |
| `fonts/Mynerve-Regular.ttf` | [google/fonts `ofl/mynerve`](https://github.com/google/fonts/tree/main/ofl/mynerve) (Carolina Short), 20 Ekim 2026; değiştirilmemiş kaynak | SIL OFL 1.1, `fonts/Mynerve-OFL.txt` |
| `fonts/Mynerve-Regular-tr.ttf` | Yukarıdakinden `scripts/font-tr.py` ile türetildi: yalnız küçük "ş" glifi (kaynakta büyük S biçiminde) s + çengel bileşik glifiyle değiştirildi | SIL OFL 1.1 (değiştirilmiş sürüm; Mynerve için ayrılmış font adı yok) |

Labirent bütün yazılarını (marj, komutlar, giriş/çıkış etiketleri) Mynerve ile yazar ve sayfaya yalnız `-tr` dosyası yüklenir. Türkçe karakterler (Ç, Ğ, İ, Ö, Ş, Ü, ı) fontta vardır; kaynak dosyadaki küçük ş büyük harf gibi göründüğü için düzeltilmiş kopya kullanılır.
Font yükseltilirse kaynak dosya değiştirilir, `python3 scripts/font-tr.py` yeniden çalıştırılır (ş glifi yeni sürümde düzelmişse bu adım ve `-tr` dosyası kalkar), ardından `./surum.sh`.
`kit/lif.png` (siyah sayfa dokusu) bu depoda `scripts/doku.mjs` ile üretilir; dış kaynak değildir.
