# kit/ — defter oyunları için ortak parçalar

Deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel.
`amiralbatti`'den çıkarıldı, `dokuztas`'ta malzeme katmanı, `kagitrallisi`'nde keçeli kalem, `noktaoyunu`'nda noktalı sayfa ve kuru boya eklendi.
Sonraki oyunlara klasörü olduğu gibi kopyalayarak taşı. `kare karalamaca`'da canvas tarafı (tuval, tarama, boyama, rakamtuval), nesneler ve `bulmaca/` eklendi; eski dosyalar değişmedi.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun `assets/vendor/` altında yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları, Patrick Hand `@font-face`. **Noktalı sayfa:** `<html data-kagit="noktali">` (ya da `.sayfa.noktali`) kareleri ve marjı kaldırır, basılı nokta örgüsü koyar; `--nokta` (aralık), `--nokta-x/-y` (örgü fazı), `--nokta-r`, `--nokta-renk`. |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (kalemle çizilme animasyonu), `metinSvg`/`harfle` (el yazısı), `dugmeCerceve`, `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu` (altı çizili sözcük), süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. |
| `kursunkalem.js` / `.css` | "Kurşun kalem" malzemesi (grafit, baskı, silgi izi, Kalam). |
| `kecelikalem.js` / `.css` | "Keçeli kalem" malzemesi (kalın tek geçiş, mürekkep yayılması, beş renk, Caveat Brush başlık, keçeli sesleri). |
| `kuruboya.js` / `.css` | **Boya katmanı** (kalem malzemesinden bağımsız): `Kit.kuruboya.kur/palet/katman/karala/yaz/ustunuCiz/tik`. Rough zigzag/hachure dolgu, kalın yarı saydam darbeler, canvas'ta bir kez üretilen tane maskesi (kâğıdın dişleri), multiply. Paletler yeşil–turuncu, mor–sarı. `html[data-boya="kuruboya"]`. |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yalnız tükenmez oyunlarında). |
| `ses.js` | Web Audio sentezi, sessiz ayarı, `seviye`, `durdur`, `cal(ad, gecikme, arg)`. |
| `rakam.js` | `Kit.rakam`: kalemle yazılmış rakamlar (rough.js darbeleri, font değil); SVG. (kibrit'ten) |
| `tuval.js` | **Canvas tarafı** `Kit.tuval`: DPR'li boyut, dünya uzayında katman, rough.js generator çıktısını `Path2D` darbelerine çevirme, ilerlemeli (kısmi) çizim, tohumlu desen, kare süresi ölçümü. |
| `tarama.js` | `Kit.tarama` "kurşun kalem tarama": kare taraması (4–6 hachure çizgisi, 40–50°, grafit #4a4a4a, parlaklık), ince çarpı, silgi izi + kırıntılar, cetvel çizgisi, çerçeve, basılı kareler, kırmızı kalem kare/halka. Şekiller 100×100 yerel kutuda üretilip saklanır. |
| `boyama.js` | `Kit.boyama` "kuru boya boyama" (canvas): kareyi 2–3 yönlü mumsu, taneli vuruşlarla boyar, 1–2 px taşar; 12'li palet; tane maskesi; multiply. |
| `rakamtuval.js` | `Kit.rakamTuval`: `Kit.rakam` gliflerini canvas'a yazar (ipucu rakamları). |
| `nesneler.js` | `Kit.nesne`: 12'li kuru boya kutusu (kapağı açılan teneke), kurşun kalem, silgi parçası, cetvel (SVG). |
| `bulmaca/` | **Ortak bulmaca altyapısı** (DOM'suz, node testli): `depo` (localStorage zarfı + bellek yedeği), `izgara` (durum + RLE), `gecmis` (sınırsız geri al/yinele), `ipucu` (teknik merdiveni: açıklamalı ipucu iskeleti), `uretici` (üretici döngüsü + zorluk bandı), `gunluk` (Europe/Istanbul tarihi, seri, paylaşım), `album`, `sure` (kronometre). Kare Karalamaca ilk tür; Çit, Apartmanlar, Kendoku aynı parçaları kullanır. |

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → `kit/ses.js` → `kit/malzeme.js` → malzeme dosyası (`kit/kecelikalem.js` …) → [`kit/kuruboya.js`] → oyunun dosyaları.
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

## Boya katmanı (kuru boya)

Kalem malzemesi çizginin nasıl çekildiğini, boya katmanı yüzeyin nasıl boyandığını söyler; ikisi birlikte kullanılır
(`noktaoyunu`: kurşun kalem çizgiler + kuru boya kutular).

```js
Kit.malzeme.sec('kursunkalem', { cizim: { strokeWidth: 1.4 } });
Kit.kuruboya.kur({ palet: 'yesil-turuncu' });
const boya = Kit.kuruboya.katman(svg, svg, 'kutular');      // tane maskeli, multiply <g>; svg'nin viewBox'ı önceden kurulmuş olmalı
Kit.kuruboya.karala(K, boya, { x, y, w: 40, h: 40 }, { renk: 0, tohum: ['kutu', oyunId, k] });   // 250 ms'de karalanır
Kit.kuruboya.yaz(boya, 'S', { x, y, boyut: 26, renk: 0, bastir: .55, hiza: 'middle' });         // bastırılmış harf
```

Renk `0`/`1` seçili paletin iki rengi, `'tehlike'` silik kırmızı ya da hex. Karalamalar kurşun kalem baskısını
almaz (`baski: false`). Tane deseni sayfaya sabittir (`userSpaceOnUse`): boya eklendikçe tane kaymaz.

Sesler (`kit/ses.js` yüklüyse `kur()` `Kit.ses.sentez`'e ekler): `karalama` (mumsu, boğuk, 11–15 Hz ileri geri sürtme;
`cal('karalama', gecikme, süreMs)`) ve `cizik` (baş harf). Ses düzeyi kalem malzemesinden gelir (kurşun kalemde kısık, .35).

## Canvas tarafı (tarama ve kuru boya)

```js
const d = Kit.tarama.tarama(['kare', r, c]);                 // bir kez üretilir, saklanır
Kit.tarama.hucre(ctx, x, y, b, d, { ilerleme: .4 });          // 120 ms'lik çizilme için kısmi
Kit.tarama.carpiCiz(ctx, x, y, b, Kit.tarama.carpi(['kare', r, c]));
Kit.tarama.silgiLeke(ctx, x, y, b, ['leke', r, c], 2);       // iki kez silinmiş
Kit.boyama.hucre(ctx, x, y, b, { renk: 'kirmizi', tohum: ['boya', i] });   // katmanı multiply ile bindir
Kit.rakamTuval.yaz(ctx, '12', x, taban, { boyut: 16, hiza: 'sag' });
```

rough.canvas kullanılmaz: geometri `rough.generator()` ile bir kez üretilir, `Path2D` olarak saklanır ve birçok katmana
(işaretler, büyüteç, harita) çizilir; yakınlaştırma geometriyi yenilemez.
