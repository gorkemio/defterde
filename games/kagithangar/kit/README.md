# kit/ — defter oyunları için ortak parçalar

Kareli deftere tükenmez kalemle çizilmiş gibi görünen tarayıcı oyunları için ortak temel.
`amiralbatti`'den çıkarıldı; sonraki oyunlara klasörü olduğu gibi kopyalayarak taşı.
Vanilla JS, build yok, `file://` ile çalışır (klasik `<script>`; ES modülü yok). Tek dış kütüphane rough.js.

| Dosya | Ne |
|---|---|
| `kagit.css` | Kağıt: 5 mm kareler, kırmızı marj, gren, gölge, hafif eğik sayfa, düğmeler, kalem imleçleri, el yazısı sınıfları. |
| `gren.png` | Kağıt greni (256×256, döşenir). |
| `kalem.js` | `Kit.kalem`: rough.js yardımcıları. `kalemYap(svg)` → `K.cizgi/yol/elips/daire/dikdortgen/cokgen/egri`, `cizdir` (alt yol ayırma + kalemle çizilme animasyonu), `metinSvg`/`harfle` (el yazısı), `dugmeCerceve`, süsler, PNG varlıkları, ölçü birimi, font bekleme. |
| `karakter.js` | `Kit.karakter`: köşe karakteri. Kendi kalem renginde yüz, 4 ruh hali, düşünme baloncuğu. |
| `ses.js` | Web Audio sentezi + sessiz ayarı (oyunun ses fazında eklenir). |

## Kullanım

Script sırası: `rough.js` (CDN, sabit sürüm) → `kit/kalem.js` → `kit/karakter.js` → oyunun dosyaları.

```js
Kit.kalem.ayarla({ roughness: 1.1, strokeWidth: 1.6, sureMs: [200, 300] }, { mavi: '#1f3b9b', kirmizi: '#c62828', kursun: '#7a7a7a' });
const K = Kit.kalem.kalemYap(svgEl);
const s = K.cizgi(svgEl, [0, 0, 100, 40], { stroke: Kit.kalem.renkDeger('mavi') }, ['anahtar', 1], { gecikme: 100 });
await s.bitti;   // çizim animasyonu bitti
```

- **Tohum:** her çizime `['anahtar', ...]` verilir; aynı anahtar her zaman aynı titrek çizgiyi üretir.
  Yeni sayfada anahtara oyun numarasını katarak çizgiler değiştirilir.
- **Ayar kancası:** `ayarla(cizim, renk)` ile oyun kendi kalem kalınlığı, süresi ve renklerini verir.
  Çağrı başına süre: `{ sureMs: [250, 250] }`.
- **Animasyon:** `anlik: true` ya da `prefers-reduced-motion` → süre 0, `bitti` anında çözülür.
- **PNG:** `varlikYukle(liste, klasor)` ile elle çizilmiş PNG'ler yüklenir; olmayan parça için prosedürel SVG çizilir.
- **Kağıt:** `.sayfa` kutusunun boyutu ve içindeki yerleşim oyunun kendi CSS'inde; `--sq` bir defter karesidir
  (`Kit.kalem.olcuBirimi` hesaplar), `--marj-x` marj çizgisinin yeridir.

## Kural

Kalemle çizilen hiçbir şey düz, keskin, "dijital" çizgi olmamalı: çizgi, çerçeve, daire, harf rough.js ile çizilir.
Yalnız basılı şeyler (kareler, marj, gren, cilt gölgesi) CSS'tedir.
Mürekkep rengi yazanı gösterir: mavi = ben, kırmızı = rakip, kurşun kalem grisi = notlar ve süsler.
