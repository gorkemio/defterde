# Kağıt Hangar

Kağıttan uçak katlama ve uçurma sitesi. Döngü: **KATLA → İSİM VER ve BOYA → FIRLAT → HANGARA AS.**
Dünya kareli bir defter ve tükenmez kalemdir; uçak gerçek beyaz kağıttır.

## Çalıştırma

Uygulama ES modülleriyle yazıldı. Tarayıcılar ES modüllerini `file://` altında yüklemez, bu yüzden
`index.html`'e çift tıklamak çalışmaz. Klasörü bir HTTP sunucusuyla açın:

```bash
npx serve -l 8140 .
```

İnternet yoksa aynı işi yapan küçük Node sunucusu:

```bash
npm run onizle
```

Sonra tarayıcıda `http://localhost:8140` açın. Build adımı yok, backend yok. Veri tarayıcının localStorage'ında durur.

## Yayın

`Dockerfile` siteyi nginx ile sunar (build adımı yok). Dokploy gibi bir platformda "Dockerfile" derleme türüyle
yayınlanır; konteyner 80 numaralı bağlantı noktasını dinler. Defterde içindeki canlı adres: https://defterde.com/oyunlar/kagithangar/

## Sayfalar

| Rota | Sayfa |
|---|---|
| `#/masa` | Giriş: defterin ilk sayfası |
| `#/katalog` | Katlama Defteri: tasarım kartları |
| `#/atolye/:tasarim` | Katlama (İZLE / ELLE modları) |
| `#/adlandir/:ucakId` | İsim, boya, ayar |
| `#/uc/:ucakId` | Uçuş (2D yan görünüm), sınıfta |
| `#/uc/:ucakId/:sahne` | Uçuş: `sinif`, `koridor`, `merdiven`, `balkon`, `park` ya da `gunun` (günün uçuşu) |
| `#/hangar` | İplerde asılı uçaklar |
| `#/stil` | Stil rehberi: iki malzeme yan yana (kalıcı) |
| `#/yazdir/:ucakId` | A4 baskı şablonu: kırışık deseni, boya ve isim |
| `#/notla/:ucakId` | Uçağa not yaz, katla, bağlantı üret |
| `#/not/:veri` | Gelen uçağı yakala, aç, notu oku |
| `#/pilot` | Pilot kartı: rütbe ve rozetler |
| `#/duello` | Aynı cihazda iki kişilik düello |
| `#/nasil` | Nasıl uçar? Doodle'larla kağıt uçak fiziği |

## Test

```bash
npm test
```

Testler Node'un yerleşik test koşucusuyla çalışır (Node 20+). `engine/` klasörü DOM'a dokunmaz; bütün motor
ve fizik testleri tarayıcısız koşar.

## Klasörler

- `kit/`: defter görünümü için ortak parçalar (`sos/kit` kopyası; dokunulmaz). Klasik betiktir, `window.Kit` üzerinden kullanılır.
- `engine/`: katlama motoru ve uçuş fiziği (DOM'suz).
- `tasarimlar/`: uçak tasarımları, her biri bir katlama dizisi (JSON). Kaynağı `araclar/tasarimlar-kaynak.mjs`;
  `node araclar/beklenen.mjs` JSON'ları yeniden üretir ve regresyon testinin `beklenen` alanını motorun çıktısıyla doldurur.
- `ui/`: sayfalar ve çiziciler. `ui/kagitCiz.js` gerçek kağıt malzemesi, `ui/isaretler.js` kalemle katlama işaretleri.
- `test/`: Node testleri.

Dış kütüphaneler: rough.js 4.6.6 ve lz-string 1.5.0 (CDN, sabit sürüm). Font: Patrick Hand (Google Fonts, Türkçe karakterli).
