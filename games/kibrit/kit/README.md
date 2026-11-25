# kit/ — defter oyunları için ortak parçalar

Deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel. `amiralbatti`'den çıkarıldı; `sos`'ta karakter,
`dokuztas`'ta malzeme katmanı ve kurşun kalem, `kagitrallisi`'nde keçeli kalem, `sayibulma`'da çizgili sayfa, kırmızı-mavi
kalem ve kalem rakamları, `xox`'ta dolma kalem ve `isle.iz` kancası, `noktaoyunu`'nda kuru boya ve noktalı kâğıt,
`turkdamasi`'nda dama taşı eklendi. **`kibrit`** (20 Ekim 2026) bu parçaları tek klasörde birleştirdi ve dört ekleme yaptı:
gazete kupürü, kibrit çöpü ve kutusu, lastik damga, rakam gliflerine `/` ve `=`; ardından kâğıt yanıkları `Kit.yanik`'e
ayrıldı (kibrit artık yalnız defter kullanır: gazete ve damga yüklenmez ama kitte duruyor). Sonraki oyunlara klasörü olduğu
gibi kopyala.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun
`assets/vendor/` klasöründe yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kareli kağıt: kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları, Patrick Hand; `html[data-kagit="noktali"]` noktalı kâğıt. |
| `cizgili.css` / `cizgili.js` | Çizgili kağıt (`.sayfa.cizgili`): satırlar, delikler, tohumlu yırtık üst kenar (`Kit.cizgili.kur`). |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları (`kalemYap`, `cizdir`, `metinSvg`, `harfle`, `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu`, ölçü, font bekleme, `karma`/`tohum`/`rastgele`). En geniş sürüm (xox, 619 satır): `isle.iz` kancası, `bayrak`. |
| `rakam.js` | `Kit.rakam`: kalemle yazılmış `0–9 + − . : ? / =` ve tik (darbe listesi). `ciz`, `yaz`, `genislik`; node'da `GLIF` okunur. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. `tukenmez` varsayılandır. |
| `kursunkalem.js` / `.css` | "Kurşun kalem" (noktaoyunu sürümü: açık masa ve kâğıt `kagit.css`'ten). |
| `kecelikalem.js` / `.css`, `kirmizimavi.js` / `.css`, `dolmakalem.js` / `.css` | Diğer üç kalem malzemesi. |
| `kuruboya.js` / `.css` | `html[data-boya="kuruboya"]` boya katmanı. |
| `damatasi.js` | `Kit.damatasi`: kâğıtta duran dama taşı (kuru boyalı). |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yalnız tükenmez oyunlarında). |
| `ses.js` | Web Audio sentezi, sessiz ayarı, `seviye`, `durdur`, `cal(ad, gecikme, arg)`, `nota`, `parazit`. |
| **`gazete.js` / `.css`** | **YENİ.** `Kit.gazete`: deftere bantla yapıştırılmış gazete kupürü (yanık köşesi için `yanik.js` de yüklenmeli). |
| **`kibrit.js` / `.css`** | **YENİ.** `Kit.kibrit`: tahta kibrit çöpü, boş yuva izi, çekmeceli kibrit kutusu. |
| **`damga.js` / `.css`** | **YENİ.** `Kit.damga`: kırmızı lastik damga. |
| **`yanik.js` / `.css`** | **YENİ.** `Kit.yanik`: defter sayfasının yanık köşeleri ve herhangi bir çokgen köşesini yakan yardımcı. |

## Nesne katmanı (malzeme değil)

Gazete kupürü, kibrit ve damga **basılı ya da kâğıdın üstünde duran nesnelerdir**: kalemle çizilmezler, rough.js
kullanmazlar; düz SVG dolgu ve gradyandır. Kalem malzemesinden bağımsızdır (kibrit oyununda marj kurşun kalemle yazılır,
kupür matbaadır). Yeni CSS yalnız `.kupur`, `.bant`, `.kupur-arka`, `.cop`, `.yuva`, `.kibrit-kutu`, `svg.damga` altında
eşleşir; bunları kullanmayan oyunda hiçbir kural değişmez.

### `Kit.gazete`
```js
const k = Kit.gazete.kur(el, { tohum: ['kupur', 7], bant: 2, renk, yanik: 1 })   // el: position relative kutu (.kupur); k.yenile() boyut değişince
                                                 // yanik: 0–2 hafif yanık köşe (ya da köşe listesi 0–3); bantlı köşeler yanmaz
Kit.gazete.arka(el, { tohum, satir: 9 })        // ters duran kupür: başka sayfanın aynalı, silik, okunmayan satırları
Kit.gazete.bant(el, { x, y, w, aci, tohum })    // sarımsı yarı saydam bant parçası (uçları dişli)
Kit.gazete.kenar(w, h, tohum, yanik) → [[x, y], …]   // makasla kesilmiş dikdörtgen: kenar başına 2–4 düzce parça, 0–2 makas ısırığı
Kit.gazete.sayfaYak(…)                               // eski ad: Kit.yanik.sayfa'ya geçer (yanik.js yüklü değilse null)
Kit.gazete.dokuResmi() → PNG veri adresi             // gazete kâğıdı dokusu (256×256, tohumlu, bir kez üretilir)
Kit.gazete.dolgu(r, n) → 'Belediye pazar …'           // zararsız dolgu metni (kesik satırlar, komşu sütun)
Kit.gazete.sesler.hisirti                        // yeni bulmaca: gazete hışırtısı
```
Kâğıt (`#e8e2d0`), 45° raster nokta deseni, sararmış kenar (radyal gradyan), birkaç silik leke, kesik boyunca koyu kenar
ve açık lif çizgisi; gölge bulanık (kupür başına tek süzgeç, statik) + ince temas gölgesi. İki bant karşı köşeleri çapraz
tutar (yazıya binmez). Kâğıt dolgusu `dokuResmi()` deseni (lif, benek, hafif dalgalanma; tüm yüzeye yayılan tram yok) ve
tohumlu, her kupürde olmayan soluk bir katlanma izi (`kat: false` kapatır). Kupürde yanık varsayılan olarak yok (`yanik: 0`). **Yanık köşe** (`yanik`): köşe 8–15 px'lik dalgalı bir çeyrek
elips yayıyla kopmuş gibi kesilir (iç boşluğu aşmaz), yay boyunca kömürleşmiş ince kenar ve içeri doğru solan kahverengi is. Fontlar yerel: **PT Serif** (metin) ve **Archivo Narrow**
(başlık, damga); `.matbaa`, `.matbaa-ince` sınıfları. Değişkenler: `--gazete-kagit`, `--gazete-murekkep`, `--gazete-sari`, `--gazete-silik`.

### `Kit.yanik`
```js
Kit.yanik.sayfa(sayfaEl, { tohum, koseler: [1], yaricap: 7, yuvarlak: [1, 2], derin, altKap: defterEl })   // defter sayfasının yanık köşeleri
Kit.yanik.kose(P, w, h, tohum, koseler, { derin, nokta, titreme, fraktal, anahtar })   // P çokgenini yerinde yakar; P.yanik
Kit.yanik.yuvarlakDikdortgen(w, h, R, yuvarlak) → [[x, y], …]
```
Kâğıt katmanıdır (rough.js yok); oyunu bilmez. Ayrıntı aşağıda, "Yanık sayfa köşesi". CSS yalnız `svg.sayfa-yanik` ve
`svg.alt-yanik` altında eşleşir.

### `Kit.kibrit`
```js
const c = Kit.kibrit.cop(svg, { uzunluk: 56, tohum: ['cop', 3], ebeveyn, basit, golge: [dx, dy] })   // → { node: g.cop, uzunluk }
Kit.kibrit.konumla(c.node, x, y, aci, { kayma: true, tohum, yon: 1 | -1, olcek, yukseklik })        // yerel: merkez orijin, x ekseni
Kit.kibrit.basYonu(aci) → 1 | -1                 // tutarlı baş yönü: yatayda sağda, dikey ve çaprazda yukarıda
const y = Kit.kibrit.yuva(svg, { x, y, aci, uzunluk, ebeveyn }); Kit.kibrit.yuvaDurum(y, 0 | 1 | 2 | 3) // gizli / silik / vurgulu / uzak (daha silik)
const kutu = Kit.kibrit.kutu(kap, { acik, tohum, etiket: 'KİBRİT' })                                 // → { node, ac(), kapa(), acik() }
Kit.kibrit.sesler = { kaldir, koy (arg: perde 0–1), cekmece }
```
Çöp: sıcak ahşap gövde (kalınlık boyun %10'u; üstte ışık alan dikey gradyan ve koyu kenar çizgisi: açık kâğıtta okunur),
2–4 ince damar, kuyrukta kesit, kırmızı baş (sol üstten ışık alan küre), koyu uç ve küçük parlaklık; uzunluk ±%2, baş biçimi ve ton tohumlu. Gölge iki katmandır: bulanık yumuşak gölge
(svg başına tek `feGaussianBlur`) ve çöpün hemen altında ince temas gölgesi; `konumla` dönüşe göre gölgeyi hep sağ-alta
düşürür, `yukseklik > 1` kalkmış çöpün gölgesini uzatır ve temas gölgesini kaldırır. Boş yuva çöp boyunda ve kalınlığında çok soluk
bir iz (`.yuva-zemin`) üstünde matbaa noktalarıdır (`.yuva-iz`; kalınlık ve nokta aralığı çöp boyuyla ölçeklenir),
bırakılacak yer sıcak bir ışıkla vurgulanır (`.yuva-vurgu`). `.cop.uzerinde` fare üstündeki çöpü aydınlatır. `kayma: true` elle konmuş gibi ±1.5 px, ±2°.
Kutu: mukavva kılıf, iki sürtme şeridi, uydurma sade etiket ("KİBRİT · ortalama 40 çöp · ÇOCUKLARDAN UZAK TUTUNUZ"; gerçek marka yok), çekmece CSS
geçişiyle kayar (az hareket ayarında anında).

### `Kit.damga`
```js
const d = Kit.damga.bas(kap, 'Çözüldü', { x, y, aci, tohum, boyut: 34, renk: '#b3261e', cerceve: true, anlik, opaklik })
Kit.damga.kaldir(kap)
Kit.damga.sesler.damga
```
Metin `toLocaleUpperCase('tr-TR')` ile büyütülür ("ÇÖZÜLDÜ", "İ"). Çift çizgili yuvarlak köşeli çerçeve, Archivo Narrow
kalın harf; lastik kenarı için hafif `feDisplacementMap`; mürekkep eksikleri eşiklenmiş gürültü + 5–9 leke maskesi ve bir
kenarı açık baskı gradyanı. Eğim verilmezse tohumlu ±8°; 150 ms basma animasyonu; `mix-blend-mode: multiply`.

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → `kit/ses.js` → `kit/malzeme.js` → malzeme dosyası → [`kit/cizgili.js`] →
[`kit/rakam.js`] → [`kit/kibrit.js`, `kit/yanik.js`, `kit/gazete.js`, `kit/damga.js`] → oyunun dosyaları.
CSS: `kit/kagit.css` → [`kit/cizgili.css`] → malzeme CSS'i → [`kit/kibrit.css`, `kit/yanik.css`, `kit/gazete.css`, `kit/damga.css`] → oyunun `style.css`'i.
`<html data-malzeme="…">` önceden yazılırsa CSS JS'ten önce uygulanır. Nesne seslerini oyun `Kit.malzeme.sec(…)`'ten
**sonra** `Object.assign(Kit.ses.sentez, Kit.kibrit.sesler, …)` ile ekler (malzeme seçimi aynı adlı sesleri ezer).

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı çizgiyi, aynı kesiği, aynı çöpü üretir.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0.
- **Kâğıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde. `kagit.css` `--marj-x`'i `.sayfa` üzerinde
  tanımlar; oyun kendi değerini `.sayfa` kuralında vermelidir (`:root`'taki değer ezilir).
- `.kupur` kutusuna `filter`/`clip-path` verilmez; kesik biçim kupürün içindeki SVG'dir.
- **Yanık sayfa köşesi** (`Kit.yanik.sayfa`): sayfaya px cinsinden `clip-path: polygon(...)` verir; köşe beş oktav değer
  gürültüsü + birkaç ısırıkla **fraktal** bir kenarla kopar, altından bir sonraki yaprak görünür. Üstündeki tıklanmaz
  `svg.sayfa-yanik`: kenarı izleyen katmanlı kömür → kahve → sarımsı is bandı (türbülansla bozulur ve bulanıklaşır; basamak
  yok), ince kömür çizgisi, kül grisi ve benekler. `altKap` verilirse alttaki yaprağın kavrulması `svg.alt-yanik` olarak
  defter kabına (sayfaların altına; sayfalar `z-index: 1`) çizilir. `yaricap`/`yuvarlak` köşe yuvarlaklığını korur. Süzgeç
  bölgeleri sayfanın tamamını kapsar (varsayılan sınırlar bandı dikdörtgen keserdi). Yalnız dış gölgesi alttaki yaprakta
  olan sayfalarda kullan (kurşun kalem malzemesi böyledir); sayfa boyu değişince yeniden çağır (`ResizeObserver`).
- `gazete.css`'te kupür içeriği kuralı `:where()` ile düşük özgüllüktedir: oyun kendi konumlamasını (kesik satırlar gibi)
  ek ağırlık vermeden yapabilir.

## Malzemeler

`Kit.malzeme.tanimla(ad, { cizim, renk, yazi, isle: { secenek, bitir, iz }, silgiIzi, ses, sesSeviye, karakter })`.
Malzemeler: `tukenmez` (varsayılan), `kursunkalem`, `kecelikalem`, `kirmizimavi`, `dolmakalem`; ayrıntılar her dosyanın başında.

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf, rakam rough.js ile çizilir.
Yalnız basılı şeyler (kareler, satırlar, marj, delikler, gren, gazete kupürü, matbaa harfleri, damga) ve kâğıdın üstünde
duran nesneler (kibrit, kutu, bant, taş) CSS/SVG dolgudur.

## Geriye uyumluluk

Yeni dosyalar yalnız eklenir; var olan dosyalarda tek değişiklik `rakam.js`'e iki yeni glif (`/`, `=`) ve `EN` tablosuna
iki giriştir; var olan karakterler değişmez. Birleştirilen dosyaların kaynağı: `kalem.js` xox, `kagit.css` ve
`kursunkalem.css` noktaoyunu, `cizgili.*` `rakam.js` `kirmizimavi.*` sayibulma, `kecelikalem.*` `dolmakalem.*` xox,
`kuruboya.*` noktaoyunu, `damatasi.js` turkdamasi; `malzeme.js`, `ses.js`, `karakter.js`, `kursunkalem.js` her yerde aynı.
