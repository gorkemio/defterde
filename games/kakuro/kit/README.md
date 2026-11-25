# kit/ — defter oyunları için ortak parçalar

Kareli deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel.
`amiralbatti`'den çıkarıldı; `sos`'ta karakterle, `dokuztas`'ta **malzeme** katmanıyla (kurşun kalem), `kagitrallisi`'nde
keçeli kalemle genişledi; `xox`'ta iki kopya birleştirildi. Sonraki oyunlara klasörü olduğu gibi kopyala.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun
`assets/vendor/` klasöründe yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları, Patrick Hand `@font-face`. |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (kalemle çizilme animasyonu), `metinSvg` (`sinif` ile malzemenin başlık yazısı) / `harfle` (el yazısı), `dugmeCerceve` (kutulu düğme), `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu` (altı çizili sözcük; `tasma` ile uç taşması), süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yalnız tükenmez oyunlarında; isteğe bağlı). |
| `ses.js` | `Kit.ses`: Web Audio sentezi, sessiz ayarı, `seviye(v)`, `durdur()`, `cal(ad, gecikmeMs, arg)`. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. `tukenmez` varsayılandır. |
| `kursunkalem.js` / `.css` | "Kurşun kalem": grafit, az titrek cetvel çizgisi, baskı (opaklık çizgi boyunca değişir), yer yer çift çizgi, kırmızı kurşun vurgu, Kalam, `silgiIzi`, sesler (`tas`, `kayma`, `grafit`). |
| `kecelikalem.js` / `.css` | "Keçeli kalem": kalın tek geçiş, mürekkep yayılması, beş renk, Caveat Brush başlık, keçeli sesleri. |
| `dolmakalem.js` / `.css` | "Dolma kalem": kalın-ince mürekkep şeridi, uçlarda damla, nadir sıçrama, taze mürekkebin kuruması, karalama, dört mürekkep, Marck Script başlık, kalem ucu / kapak / sayfa sesleri. |

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → [`kit/karakter.js`] → `kit/ses.js` → `kit/malzeme.js` → malzeme dosyası → oyunun dosyaları.
CSS: `kit/kagit.css` → malzeme CSS'i → oyunun `style.css`'i. `<html data-malzeme="…">` HTML'de baştan yazılırsa CSS
JS'ten önce uygulanır ve ilk boyamada yanlış font istenmez.

```js
Kit.malzeme.sec('kecelikalem', { cizim: config.cizim, renk: config.renk });   // seçmeyen oyun tükenmezde kalır
const K = Kit.kalem.kalemYap(svgEl);
const s = K.cizgi(svgEl, [0, 0, 100, 40], { stroke: Kit.kalem.renkDeger('ana') }, ['anahtar', 1], { gecikme: 100 });
await s.bitti;   // çizim animasyonu bitti
```

Eski usul (malzeme seçilmez, hiçbir şey değişmez):
`Kit.kalem.ayarla({ roughness: 1.1, strokeWidth: 1.6, sureMs: [200, 300] }, { mavi: '#1f3b9b', kirmizi: '#c62828', kursun: '#555555' })`.

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı titrek çizgiyi üretir.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0, `bitti` anında çözülür. Çağrı başına süre: `{ sureMs: [250, 250] }`.
- **Kağıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde; `--sq` bir defter karesidir,
  `--marj-x` marj çizgisinin yeridir. `--marj` marj çizgisinin **rengidir**; oyun bu adı başka iş için kullanmasın.

## Malzemeler

```js
Kit.malzeme.tanimla(ad, {
  cizim: { roughness, bowing, strokeWidth, fillWeight, sureMs, animasyon },
  renk: { ana, vurgu, kursun, mavi, kirmizi, ... },   // mavi/kirmizi/kursun eski adlar: kit içi çizimler bunları kullanır
  yazi: { aile, ornek },                               // fontBekle/fontGelince varsayılanı
  isle: { secenek(s, anahtar, ek), bitir(g, anahtar, o), iz(q, bilgi) } | null,   // kalem izini malzemeye göre işler
  silgiIzi(katman, node, o) | null,
  ses: { ad: sentez(c, hedef, t0, arg) } | null, sesSeviye, karakter,
});
```

| Malzeme | Çizgi | Yazı | Renk | Ses | Çağrı bayrakları |
|---|---|---|---|---|---|
| `tukenmez` (varsayılan) | rough'un iki geçişi | Patrick Hand | mavi #1f3b9b, kırmızı #c62828, kurşun #555 | kalem, cit, kazan, kaybet | — |
| `kursunkalem` | az titrek, %35 çift geçiş, baskı gradyanı | Kalam | grafit #4a4a4a, kırmızı kurşun #b4382e | tas, kayma, grafit (kısık) | `{ baski: false }` baskıyı kapatır |
| `dolmakalem` | tek geçiş; iz bir **şerittir**: kalınlık 1.2–3 birim (basınç + uç açısı), baş/son damla, %3 sıçrama, opaklık .9 | Patrick Hand; başlık Marck Script (`→` yok) | mavi-siyah #1b2a5e, kırmızı #b3261e, yeşil #1f6e43, mor #5b2a86, kurşun #6e6e6e | uc (arg `{ sureMs }`), kapak, sayfa, cizgi | `{ murekkep: false }` kurşun kalem çizimi · `{ kuruma: true }` taze yaz, 2 sn'de kurusun · `{ kalinlik: 1.3 }` |
| `kecelikalem` | kalın tek geçiş, uçlar yuvarlak, yayılma (+1.6 birim, %12 opak ikinci iz) | Patrick Hand; başlık Caveat Brush (`metinSvg({ sinif: 'baslik' })`, `.baslik`) | siyah #1c1c1c, mavi #1d5bd6, kırmızı #d6362b, yeşil #1e9e5a, turuncu #f08a1e, kurşun #7a7a7a, çim #4e9a5c | keceli (uzunluğa göre), nokta, burusma, bayrak | `{ yayilma: false }` kurşun kalem çizimleri için |

### Kancalar

- `secenek(s, anahtar, ek)`: rough.js seçenekleri çizimden önce.
- `bitir(g, anahtar, o)`: çizim (ve animasyonu) kurulduktan sonra; keçelinin yayılması.
- `iz(q, bilgi)`: `cizdir` içinde, her kalem izi alt yolu için; `bilgi = { gecikme, sure, uzunluk, anahtar, o, hareket }`.
  `{ bitti }` dönerse izi malzeme çizer (dolma kalem şeridi), `null` dönerse bugünkü dash animasyonu. Animasyonsuz
  (`anlik`) çizimde de çağrılır. Alt yol bölme, tarama/dolgu ayrımı ve süre muhasebesi kit'te kalır.
  `iz` tanımlamayan malzemelerde `cizdir` eskisi gibi çalışır.

### Dolma kalem yardımcıları (`Kit.dolmakalem`)

- `kurut(node, { sureMs })`: altındaki hâlâ kuruyan izleri hızlandırır (varsayılan 300 ms; 0 → hemen).
- `karala(K, grup, kutu, o)`: geri alınan çizimin üstüne ince mürekkep çizgisi; grup .3 opaklığa solar ve kalır.
- `metinKurut(textEl, renk, o)`: SVG yazısını taze tondan kurutur ("beş" gibi).
- `taze(renk)`, `kurumaBaslat(dolgular, renk, o)`, `RENK`, `MUREKKEPLER`, `KURUMA_MS`.

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf rough.js ile çizilir.
Yalnız basılı şeyler (kareler, marj, gren, cilt gölgesi) ve kâğıdın üstünde duran nesneler (taşlar) CSS/SVG dolgudur.
Mürekkep rengi yazanı gösterir; kurşun kalem grisi notlar, taslaklar ve süslerdir.
