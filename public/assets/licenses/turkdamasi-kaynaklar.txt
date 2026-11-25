# Yerel bağımlılıklar ve kaynaklar

Oyun açılırken dış sunucuya istek yapmaz. Kaynak kardeş klasörler değiştirilmedi.

| Varlık | Kaynak | Lisans |
|---|---|---|
| vendor/rough-4.6.6.js | dokuztas/assets/vendor; Rough.js 4.6.6 | MIT; rough-LICENSE |
| fonts/Kalam-Regular.ttf | sayibulma/assets/fonts; Kalam 2.001 | SIL OFL; Kalam-OFL.txt |
| fonts/PatrickHand-v25.ttf | sayibulma/assets/fonts; Patrick Hand v25 | SIL OFL; PatrickHand-OFL.txt |
| ../kit/gren.png | defterde/games/dokuztas/kit/gren.png | Kullanıcının mevcut proje varlığı; pikselleri değiştirilmedi, kaynak bilgisi PNG metadatasına eklendi |

## Kit

`kalem.js`, `malzeme.js`, `kursunkalem.js`, `kursunkalem.css`, `kagit.css`:
güncel `defterde/games/dokuztas/kit` kopyası.
`kuruboya.js`: `noktaoyunu/kit`; paylaşılan tane maskesi kullanılır.
`damatasi.js`: bu projede yazılan yeni bağımsız SVG taş çizicisi.
`ses.js`: güncel `defterde/games/dokuztas/kit/ses.js` birebir kopyası,
kullanıcının mevcut ortak kit kodu. Yalnız `kursunkalem.js` içindeki kayma,
taş teması ve grafit sentezleri kullanılır; melodi çağrılmaz.

Kopyalanan kitaplıklar orijinal biçimleriyle tutulur; oyuna ait CSS yalnız bu projede
uyarlanır. Ses dosyası veya dış ses kaynağı yüklenmez.

## Canlı Defterde ile tasarım uyumu

20 Ekim 2026'da `https://defterde.com/` ve
`/oyunlar/dokuztas/`, `/oyunlar/noktaoyunu/`, `/oyunlar/sayibulma/` tarayıcıda
incelendi. Yerel `defterde/src/styles/global.css` ve ilgili oyunların HTML/CSS
kaynakları yalnız okundu. İçindekiler bağlantısı, grafit komutlar ve satır içi
ayar görünümü bu projede uyarlandı; yeni kitaplık veya font eklenmedi.
Kalam ve Patrick Hand yerel, OFL lisanslarıyla birlikte kalır.
Canlı kaynak ekran görüntüleri `docs/gorseller/canli-*.png` içindedir.

Tahtanın doğal kalem geçişi için canlı
`https://defterde.com/oyunlar/amiralbatti/` ve yerel
`defterde/games/amiralbatti/draw.js` içindeki `elKalemi`/`izgaraCiz` incelendi.
Aynı Rough.js yaklaşımı mevcut Kit.kalem üzerinden, çizgi başına sabit tohum,
değişen pürüz/eğrilik ve aralıklı çift geçişle uyarlandı. Kaynak oyuna yazılmadı.

## Mangala/Tavla yüzü

20 Ekim 2026'da sayfa, kardeş tahta oyunları Mangala ve Tavla'nın yatay
düzenine geçirildi: Kalam başlık, tahtanın tam üstünde kalan taş skoru ve sıra,
iki yanda oyuncu ve aldığı taşlar, altta mod satırı, komutlar ve kalemle çizilmiş
hoparlör. Kâğıt ve alttaki iki yaprak Amiral Battı gibi −0.6° sola yatar; içerik düz
kalır. Taşlar yüzsüz kuru boya; delikler ve yırtık kenar kaldırıldı, `cizgili.js`
artık yüklenmez. Yeni font eklenmedi.
