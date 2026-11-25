# kit/ — defter oyunları için ortak parçalar

Kareli deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel.
`amiralbatti`'den çıkarıldı, `dokuztas`'ta malzeme katmanı, `kagitrallisi`'nde keçeli kalem eklendi.
Sonraki oyunlara klasörü olduğu gibi kopyalayarak taşı.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun `assets/vendor/` altında yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları, Patrick Hand `@font-face`. |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (kalemle çizilme animasyonu), `metinSvg`/`harfle` (el yazısı), `dugmeCerceve`, `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu` (altı çizili sözcük), süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. |
| `kursunkalem.js` / `.css` | "Kurşun kalem" malzemesi (grafit, baskı, silgi izi, Kalam). |
| `kecelikalem.js` / `.css` | "Keçeli kalem" malzemesi (kalın tek geçiş, mürekkep yayılması, beş renk, Caveat Brush başlık, keçeli sesleri). |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yalnız tükenmez oyunlarında). |
| `ses.js` | Web Audio sentezi, sessiz ayarı, `seviye`, `durdur`, `cal(ad, gecikme, arg)`. |

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → `kit/ses.js` → `kit/malzeme.js` → malzeme dosyası (`kit/kecelikalem.js` …) → oyunun dosyaları.
CSS: `kit/kagit.css` → malzeme CSS'i → oyunun `style.css`'i. `<html data-malzeme="…">` önceden yazılırsa CSS JS'ten önce uygulanır.

```js
Kit.malzeme.sec('kecelikalem', { cizim: config.cizim, renk: config.renk });   // seçmeyen oyun tükenmezde kalır
const K = Kit.kalem.kalemYap(svgEl);
const s = K.cizgi(svgEl, [0, 0, 100, 40], { stroke: Kit.kalem.renkDeger('mavi') }, ['anahtar', 1], { gecikme: 100 });
await s.bitti;   // çizim animasyonu bitti
```

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı titrek çizgiyi üretir.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0, `bitti` anında çözülür. Çağrı başına süre: `{ sureMs: [250, 250] }`.
- **Kağıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde; `--sq` bir defter karesidir, `--marj-x` marj çizgisinin yeridir.

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
| `kursunkalem` | az titrek, %35 çift geçiş, baskı gradyanı | Kalam | grafit #4a4a4a, kırmızı kurşun #b4382e | (kısık) | `{ baski: false }` baskıyı kapatır |
| `kecelikalem` | kalın tek geçiş, uçlar yuvarlak, yayılma (+1.6 birim, %12 opak ikinci iz) | Patrick Hand; başlık Caveat Brush (`metinSvg({ sinif: 'baslik' })`, `.baslik`) | siyah #1c1c1c, mavi #1d5bd6, kırmızı #d6362b, yeşil #1e9e5a, turuncu #f08a1e, kurşun #7a7a7a, çim #4e9a5c | keceli (uzunluğa göre), nokta, burusma, bayrak | `{ yayilma: false }` kurşun kalem çizimleri için |

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf rough.js ile çizilir.
Yalnız basılı şeyler (kareler, marj, gren, cilt gölgesi) CSS'tedir.
Mürekkep rengi yazanı gösterir; kurşun kalem grisi notlar, taslaklar ve süslerdir.
