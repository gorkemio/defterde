# kit/ — defter oyunları için ortak parçalar

Deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel. `amiralbatti`'den çıkarıldı; `sos`'ta karakter,
`dokuztas`'ta malzeme katmanı ve kurşun kalem, `kagitrallisi`'nde keçeli kalem, `sayibulma`'da çizgili sayfa,
kırmızı-mavi kurşun kalem ve kalem rakamları eklendi. Sonraki oyunlara klasörü olduğu gibi kopyala.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun
`assets/vendor/` klasöründe yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kareli kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları, Patrick Hand `@font-face`. |
| `cizgili.css` / `cizgili.js` | Çizgili kağıt (`.sayfa.cizgili`): satır çizgileri, kırmızı marj, solda üç delik, tohumlu yırtık üst kenar (`Kit.cizgili.kur`). |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (kalemle çizilme animasyonu), `metinSvg` (`sinif` seçeneğiyle) / `harfle` (el yazısı), `dugmeCerceve` (kutulu düğme), `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu` (altı çizili sözcük; `tasma`), süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `rakam.js` | `Kit.rakam`: kalemle yazılmış 0–9, `+ - . : ?` ve tik (font değil, darbe listesi). `ciz`, `yaz`, `genislik`; node'da `GLIF` okunur. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. `tukenmez` varsayılandır. |
| `kursunkalem.js` / `.css` | "Kurşun kalem": grafit, az titrek cetvel çizgisi, baskı gradyanı, yer yer çift çizgi, kırmızı kurşun vurgu, Kalam, `silgiIzi`. |
| `kecelikalem.js` / `.css` | "Keçeli kalem": kalın tek geçiş, mürekkep yayılması, beş renk, Caveat Brush başlık, keçeli sesleri. |
| `kirmizimavi.js` / `.css` | "Kırmızı-mavi kurşun kalem": iki uçlu okul kalemi; tek geçiş, opaklık ~.85, baskı gradyanı, yumuşak kenar, kâğıt dişi maskesi (`Kit.kirmizimavi.doku(svg)`), Kalam, iki renkli imleç, mukavva arka kapak, sesler (`rakam`, `cevir`, `yirt`, `tik`). |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yalnız tükenmez oyunlarında). |
| `ses.js` | Web Audio sentezi, sessiz ayarı, `seviye`, `durdur`, `cal(ad, gecikme, arg)`. |

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → `kit/ses.js` → `kit/malzeme.js` → malzeme dosyası → [`kit/cizgili.js`] → [`kit/rakam.js`] → oyunun dosyaları.
CSS: `kit/kagit.css` → [`kit/cizgili.css`] → malzeme CSS'i → oyunun `style.css`'i. `<html data-malzeme="…">` önceden yazılırsa CSS JS'ten önce uygulanır.

```js
Kit.malzeme.sec('kirmizimavi', { cizim: config.cizim, renk: config.renk });   // seçmeyen oyun tükenmezde kalır
Kit.cizgili.kur(sayfaEl, { satir: 36, ust: 86, alt: 32, marjX: 79, tohum: ['sayfa', oyunNo] });
const K = Kit.kalem.kalemYap(svgEl);
const maske = Kit.kirmizimavi.doku(svgEl);                  // kalem katmanına mask="..." olarak verilir
Kit.rakam.yaz(K, katman, '1234', { x: 100, y: 200, boyut: 22, renk: 'mavi', tohum: ['satir', 1] });
Kit.rakam.yaz(K, katman, '+1 -2', { x: 180, y: 200, boyut: 19, renk: 'kirmizi', tohum: ['cevap', 1] });
```

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı titrek çizgiyi üretir.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0, `bitti` anında çözülür. Çağrı başına süre: `{ sureMs: [250, 250] }`.
- **Kağıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde. Kareli: `--sq` bir defter karesi.
  Çizgili: `--satir`, `--satir-ust`, `--satir-alt`, `--marj-x`, `--cizgi`, `--delik-cap`. `--marj` marj çizgisinin **rengidir**.
- **Çizgili sayfanın yırtık kenarı** sayfanın üstüne yapışık ayrı bir şerittir; sayfaya `clip-path`/`filter` verilmez (gölgeyi
  keser, her boyamada yeniden rasterlenir). Yeni sayfada tohumu değiştir, kenar yeniden yırtılır.

## Malzemeler

```js
Kit.malzeme.tanimla(ad, {
  cizim: { roughness, bowing, strokeWidth, fillWeight, sureMs, animasyon },
  renk: { ana, vurgu, kursun, mavi, kirmizi, ... },   // mavi/kirmizi/kursun eski adlar: kit içi çizimler bunları kullanır
  yazi: { aile, ornek },                               // fontBekle/fontGelince varsayılanı
  isle: { secenek(s, anahtar, ek), bitir(g, anahtar, o) } | null,   // kalem izini malzemeye göre işler
  silgiIzi(katman, node, o) | null,
  ses: { ad: sentez(c, hedef, t0, arg) }, sesSeviye, karakter,
});
```

| Malzeme | Çizgi | Yazı | Renk | Ses | Çağrı bayrakları |
|---|---|---|---|---|---|
| `tukenmez` (varsayılan) | rough'un iki geçişi | Patrick Hand | mavi #1f3b9b, kırmızı #c62828, kurşun #555 | kalem, cit, kazan, kaybet | — |
| `kursunkalem` | az titrek, %35 çift geçiş, baskı gradyanı | Kalam | grafit #4a4a4a, kırmızı kurşun #b4382e | tas, kayma, grafit (kısık) | `{ baski: false }` |
| `kecelikalem` | kalın tek geçiş, yayılma (+1.6 birim, %12 opak) | Patrick Hand; başlık Caveat Brush | siyah, mavi, kırmızı, yeşil, turuncu, kurşun, çim | keceli, nokta, burusma, bayrak | `{ yayilma: false }` |
| `kirmizimavi` | tek geçiş, 2.4 birim, opaklık .79–.91 + baskı gradyanı, yumuşak kenar (+1.4, %9), kâğıt dişi maskesi | Kalam | mavi #2b4a9f, kırmızı #c0392b, kurşun #8a8783 | rakam, cevir, yirt, tik (kısık) | `{ baski: false }`, `{ yumusak: false }` |

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf, rakam rough.js ile çizilir.
Yalnız basılı şeyler (kareler, satırlar, marj, delikler, gren, cilt gölgesi) ve kâğıdın üstünde duran nesneler CSS/SVG dolgudur.
Mürekkep rengi anlam taşır: tükenmezde mavi = ben, kırmızı = rakip; kırmızı-mavi kalemde mavi uç = tahmin, kırmızı uç = cevap
ve işaret; kurşun kalem grisi notlar, taslaklar, otomatik işaretler ve süslerdir.

## Geriye uyumluluk

Yeni dosyalar yalnız `html[data-malzeme="…"]` ya da `.sayfa.cizgili` altında eşleşir; `kalem.js`'teki `sinif` eki ve
`dugmeAltiVurgu`'daki `:not(.yayilma)` seçicisi eski çağrıların davranışını değiştirmez. `malzeme.js` yüklenip hiçbir malzeme
seçilmediğinde `sos` ekran görüntüleri eski kitle bayt bayt aynıdır (dokuztas, 19 Ekim 2026).
