# Türk Daması — Defterde

`index.html` dosyasını tarayıcıda açın. Kurulum, derleme veya internet gerekmez.

**Beş faz tamamlandı.** Bilgisayara karşı kolay, orta veya zor seviyede ya da
aynı cihazda iki kişi oynayın. Taşa, ardından hedefe dokunun. Klavyede oklarla
gezinip Enter/Space ile seçin. Mavi başlar; bilgisayara karşı kırmızıyı seçerseniz
görünüm döner ve bilgisayar açılışı yapar.

- Alma zorunludur; bütün taşlar arasında en çok taş alan tam yollar yasaldır.
  Dama tur sonunda kazanılır. Taş yüzleri, kimlikleri ve taç geri almada korunur.
- **Geri al**, yarım zinciri başlangıcına; iki kişide son tura, bilgisayara karşı
  son insan kararına döndürür. Düşünme ve hareket sırasında da kullanılabilir.
- **İpucu** bir yol gösterir. Yarım zincirde yalnız seçtiğiniz yolun devamını arar.
- **Nasıl oynanır?** kısa kuralları ve dört izlenebilir örneği açılır pencerede
  gösterir. **Kapat** veya Escape pencereyi kapatır. **İzle**, pencereyi kapatıp
  örneği tahtada oynatır; **Oyuna dön** aynı oyunu ve seçimi geri getirir.
- **Ayarlar** mod, renk, zorluk, hamle işaretleri ve hareket tercihini değiştirir;
  kaydetmek yeni oyun başlatır. Beraberlik teklifi de buradadır.
- **Ses** başlangıçta kapalıdır. Açıldığında kısa kalem ve taş sesleri duyulur.
  Yalnız ayarlar saklanır; sayfayı yeniden açmak yeni oyun başlatır.
- Oyun bitince kazanma, yenilme veya beraberlik notu açılır. **Yeniden oyna**
  aynı mod ve tarafla yeni oyun başlatır; **Tahtaya bak** veya Escape sonucu kapatır.

Varsayılan: orta seviye bilgisayar, insan mavi, hamle işaretleri açık, ses kapalı,
hareket cihaz tercihine bağlı. Depolama engellense de oyun çalışır.

## Doğrulama ve geliştirme

69 mantık testi; Chromium/WebKit × file/HTTP; 320, 375, 390, 768 ve geniş masaüstü
kontrolleri geçti. CPU yavaşlatmalı emülasyon fiziksel telefon testi değildir.

Oyun çalıştırmak için Node veya Playwright gerekmez. Geliştirme testleri:

```sh
node --test test/board.test.cjs test/ai.test.cjs test/session.test.cjs test/computer-session.test.cjs test/settings-lessons.test.cjs
node test/faz1.cjs
node test/faz2-browser.cjs
node test/faz3.cjs
node test/final-browser.cjs
node test/result-browser.cjs
node test/alignment-browser.cjs
node test/help-browser.cjs
node test/performance.cjs
node test/calibrate.cjs
```

Mantık testleri Node 18+ kullanır. Tarayıcı testlerinde Playwright gerekir;
`PLAYWRIGHT_PATH`, `CHROMIUM_PATH`, `WEBKIT_PATH` mevcut kurulumları seçer.
Kalibrasyon 48 tam maç oynatır ve diğer testlerden uzun sürer.

## Modüller

`board.js` kurallar ve ilerletilebilir hamle üretimini; `ai.js` bütçeli aramayı;
`session.js` tam tur, ara zincir ve görev iptalini yönetir. `settings.js` yalnız
doğrulanmış tercihleri saklar; `lessons.js`/`tutorial.js` örnekleri aynı oturum
akışıyla oynatır. `ui.js` girişleri, `draw.js` görünümü, `layout.js` ortak
koordinatları, `config.js` renkleri ve arama profillerini tutar.
`result.js` bitiş mesajını ve bir kez gösterilen sonuç notunu yönetir.

- Sözleşme: [docs/kural-motoru.md](docs/kural-motoru.md).
- Yerel kaynak/lisanslar: [assets/DEPENDENCIES.md](assets/DEPENDENCIES.md).

## Taş çizicisi

`Kit.damatasi.kur(svg)` SVG başına bir çizici verir:

- `olustur(id, { takim: 'mavi' | 'kirmizi', dama, ifade })`: aynı kimlik aynı düğümü döndürür.
- `konumla(tas, x, y, olcek)`: gövdeyi yeniden üretmeden taşır.
- `yuz(tas, ifade)`: altı yüz ifadesinden birini uygular.
- `tac(tas, acik)`: gövdeyi değiştirmeden tacı açar/kapatır.

Taş kimlikleri SVG içinde benzersizdir. Çizici DOM/SVG bilir, oyun kuralı bilmez.
Gövde tohumdan üretilir. Tane maskesi SVG başına paylaşılır.

