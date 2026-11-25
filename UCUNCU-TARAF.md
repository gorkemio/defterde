# Üçüncü taraf bileşenler ve lisans istisnaları

Defterde'nin kaynak kodu, oyun kodu, özgün çizimleri ve kâğıt dokusu (`kit/gren.png`) [MIT lisansı](LICENSE) ile paylaşılır. Aşağıdaki bileşenler **MIT kapsamında değildir**; depoda ve sitede kendi lisanslarıyla, lisans metinleri yanlarında olacak şekilde dağıtılır. Bu bileşenleri kullanırken kendi lisanslarına uyman gerekir.

Her oyunun ayrıntılı künyesi `games/<oyun>/assets/DEPENDENCIES.md` dosyasındadır. Aynı künyeler sitede [defterde.com/kaynaklar](https://defterde.com/kaynaklar/) sayfasından ve `/assets/licenses/` altından yayımlanır.

## İçerik ve veri

| Bileşen                                                                                                                                     | Nerede                                                                                   | Lisans               | Not                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tangram bulmaca verisi: PECES (Innocent De Marchi) şekillerinden uyarlanan 100 bulmaca ve dönüştürme araçları                               | `games/tangram/puzzles/`, `games/tangram/tools/content/`, `games/tangram/test/fixtures/` | **GPL-2.0-or-later** | 20 şekil özgündür. Kaynak paketi: `public/assets/licenses/tangram-content-source.zip`. Köken: [`games/tangram/docs/CONTENT-SOURCES.md`](games/tangram/docs/CONTENT-SOURCES.md). Lisans metni: `games/tangram/assets/licenses/peces-GPL-2.0.txt`. |
| Kelime sıklığı sıraları: Hermit Dave, [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2018 Türkçe)            | `games/adamasmaca/data/`, `games/besharf/data/`                                          | **CC BY-SA 4.0**     | Yalnız sıra numaraları türetilmiştir. Türetilmiş veri aynı lisansla paylaşılır; atıflar veri dosyalarının başlığındadır.                                                                                                                         |
| Sözlük tanımları: TDK Güncel Türkçe Sözlük, 12. baskı ([ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) üzerinden) | `games/adamasmaca/data/sozluk.js`, `games/besharf/data/anlamlar.js`                      | **TDK'ya aittir**    | Aracı deponun kodu MIT'dir, sözlük içeriği değildir. Bu tanımlar MIT lisansıyla yeniden lisanslanmaz; oyunlarda kelime ipucu olarak kullanılır.                                                                                                  |
| Alkış sesi: "Slow starting applause", PDSounds.org 331                                                                                      | `games/kagitfutbolu/assets/gol.mp3`                                                      | Kamu malı            | 8–12. saniyeler kesilip yumuşatılmıştır. [Özgün kayıt](https://commons.wikimedia.org/wiki/File:Slow_starting_applause.ogg).                                                                                                                      |

## Yazı tipleri (SIL Open Font License 1.1)

Her font dosyasının yanında OFL metni bulunur.

| Yazı tipi                                                                           | Kullanıldığı yer                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| Patrick Hand (Patrick Wagesreiter)                                                  | Platform ve oyunların çoğu                       |
| Kalam (Indian Type Foundry)                                                         | Dokuz Taş, Mangala, Kare Karalamaca ve diğerleri |
| Marck Script                                                                        | 5'li XOX, Domino, Mangala                        |
| Caveat Brush                                                                        | Kağıt Rallisi                                    |
| Courier Prime                                                                       | Beş Harf                                         |
| PT Serif, Archivo Narrow                                                            | Kibrit Bulmacası                                 |
| Architects Daughter                                                                 | Kare Karalamaca                                  |
| Mynerve (Türkçe karakterler eklenmiş değiştirilmiş kopya: `Mynerve-Regular-tr.ttf`) | Labirent                                         |

Amiral Battı, Kağıt Futbolu ve Kağıt Hangar el yazısı fontunu Google Fonts'tan yükler.

## Kütüphaneler (MIT)

| Kütüphane                                                             | Nerede                                                                             |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Rough.js](https://github.com/rough-stuff/rough) 4.6.6 (Preet Shihn)  | Oyunların `assets/vendor/` klasörleri; platform çizimleri build sırasında üretilir |
| [polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 | `games/tangram/assets/vendor/`                                                     |
| [lz-string](https://github.com/pieroxy/lz-string) 1.5.0               | Kağıt Hangar, jsDelivr üzerinden                                                   |

npm bağımlılıklarının lisansları `package-lock.json` içinde listelenir ve `node_modules` altındaki paketlerle gelir.
