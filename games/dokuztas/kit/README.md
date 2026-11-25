# kit/ — defter oyunları için ortak parçalar

Kareli deftere kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel. `amiralbatti`'den çıkarıldı;
`sos`'ta karakterle, `dokuztas`'ta **malzeme** katmanıyla genişledi. Sonraki oyunlara klasörü olduğu gibi kopyala.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js (oyunun
`assets/vendor/` klasöründe yerel kopya).

| Dosya | Ne |
|---|---|
| `kagit.css` | Kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları. |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (kalemle çizilme animasyonu), `metinSvg`/`harfle` (el yazısı), `dugmeCerceve` (kutulu düğme), `altiCiz`/`dugmeAltiCiz`/`dugmeAltiVurgu` (altı çizili sözcük; `tasma` ile uç taşması), süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `karakter.js` | `Kit.karakter`: köşe karakteri (yüz, 4 ruh hali, düşünme baloncuğu). İsteğe bağlı. |
| `ses.js` | `Kit.ses`: Web Audio sentezi, sessiz ayarı, `seviye(v)`, `durdur()`, `cal(ad, gecikmeMs, arg)`. |
| `malzeme.js` | `Kit.malzeme`: malzeme (tema) kaydı ve seçimi. `tukenmez` varsayılandır (bugünkü görünüm). |
| `kursunkalem.js` | "Kurşun kalem" malzemesi: grafit, az titrek cetvel çizgisi, baskı (opaklık çizgi boyunca değişir), yer yer çift çizgi, kırmızı kurşun vurgu, Kalam, `silgiIzi`, sesler (`tas`, `kayma`, `grafit`), karakter yok. |
| `kursunkalem.css` | Kurşun kalemin CSS tarafı: Kalam `@font-face`, renk değişkenleri, kurşun kalem imleci, kutusuz düğme. Yalnız `html[data-malzeme="kursunkalem"]` altında geçerli. |

## Kullanım

Script sırası: `rough.js` → `kit/kalem.js` → [`kit/karakter.js`] → [`kit/ses.js`] → [`kit/malzeme.js` → malzeme dosyaları] → oyunun dosyaları.
CSS: `kit/kagit.css` → [`kit/kursunkalem.css`] → oyunun `style.css`.

```js
// Eski usul (tükenmez kalem; malzeme seçilmez — hiçbir şey değişmez):
Kit.kalem.ayarla({ roughness: 1.1, strokeWidth: 1.6, sureMs: [200, 300] }, { mavi: '#1f3b9b', kirmizi: '#c62828', kursun: '#555555' });

// Malzemeyle (oyunun config'i ikinci parametreyle üstüne yazar):
Kit.malzeme.sec('kursunkalem', { cizim: config.cizim, renk: config.renk });
const K = Kit.kalem.kalemYap(svgEl);
K.cizgi(svgEl, [0, 0, 100, 40], { stroke: Kit.kalem.renkDeger('vurgu') }, ['anahtar', 1], { gecikme: 100 });
Kit.malzeme.aktif.silgiIzi(kagitKatmani, cizgiNode, { noktalar: [x1, y1, x2, y2] });   // çizgiyi silgiyle sil
```

`<html data-malzeme="kursunkalem">` özniteliğini HTML'de baştan koymak, malzeme seçilmeden önceki ilk boyamada eski fontun
istenmesini önler.

### Malzeme tanımı

```js
Kit.malzeme.tanimla('ad', {
  cizim: { roughness, bowing, strokeWidth, fillWeight, sureMs, animasyon },
  renk: { ana, vurgu, kursun, mavi, kirmizi },   // mavi/kirmizi eski adlar: yeni malzemede ana/vurguya eşlenir
  yazi: { aile, ornek },                          // fontBekle / fontGelince varsayılanı
  isle: { secenek(sec, anahtar, ek), bitir(g, anahtar, o) } | null,   // her kalem izini işleme kancası
  silgiIzi(katman, node, o) | null,
  ses: { ad: (c, hedef, t0, arg) => { ... } } | null, sesSeviye: 0.6,
  karakter: true | false,
});
```

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı titrek çizgiyi üretir.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0, `bitti` anında çözülür.
- **Baskı:** kurşun kalemde `o.baski === false` verilen çizimlerin opaklığına dokunulmaz (silik yapım çizgileri gibi).
- **Kağıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde; `--sq` bir defter karesidir,
  `--marj-x` marj çizgisinin yeridir. `--marj` marj çizgisinin **rengidir**; oyun bu adı başka iş için kullanmasın.

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf rough.js ile çizilir.
Yalnız basılı şeyler (kareler, marj, gren, cilt gölgesi) ve kâğıdın üstünde duran nesneler (taşlar) CSS/SVG dolgudur.
Tükenmez malzemede mürekkep rengi yazanı gösterir: mavi = ben, kırmızı = rakip, kurşun kalem grisi = notlar ve süsler.
Kurşun kalem malzemesinde her şey grafittir; vurgu (değirmen, sonuç) kırmızı kurşundur; kim olduğunu taşlar gösterir.

## Geriye uyumluluk

`malzeme.js` yüklenip hiçbir malzeme seçilmediğinde ve `kalem.js`/`ses.js` yeni sürümleriyle, `sos` ekran
görüntüleri Chromium ve WebKit'te, 1280 ve 375 px'te eski kitle bayt bayt aynıdır (19 Ekim 2026).
