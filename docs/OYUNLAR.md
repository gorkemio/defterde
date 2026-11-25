# Oyun ekleme ve güncelleme

Her oyun `games/<slug>/` altında, kendi HTML, CSS ve JavaScript dosyalarıyla **bağımsız** bir belgedir. Ortak motor, SDK veya çalışma anında enjekte edilen kod yoktur; bir oyun platform olmadan da `index.html` açılarak çalışabilir. Platform yalnız katalog, rehber ve yayın katmanıdır.

## Yayın modeli: izin listesi + hash

- `config/games.json` teknik katalogdur: kısa ad (slug), başlık, açıklama, oyun modu ve **tam dosya yolu izin listesi** (`runtime`). Klasör glob'u kullanılmaz.
- `docs/imports/<slug>.json` oyunun kayıt raporudur: oyun klasöründeki bütün dosyaların SHA-256 envanteri (`files`), yayımlanacak dosyaların hash'leri (`runtime`), oyunun ilk alındığı ayrı deponun kökeni (`source`, `commit`) ve platforma özgü uyarlamaların gerekçeleri (`localChanges`).
- `npm run build` (`scripts/package-games.mjs`) yalnız izin listesindeki dosyaları `dist/games/` altına kopyalar ve her birinin hash'ini raporla karşılaştırır. Kaydedilmemiş bir değişiklik build'i durdurur. Fastify yalnız bu üretilmiş ağacı sunar; testler, araçlar, belgeler ve dotfile'lar web'den erişilemez.
- `npm run games:verify` bütün oyun klasörlerinin raporla birebir aynı olduğunu doğrular.

Bu model, yayına giden her baytın gözden geçirilmiş olmasını sağlar. Bedeli tek adımdır: bir oyun dosyasını değiştirdikten sonra değişikliği rapora işlemek.

## Mevcut bir oyunu değiştirme

1. Oyunu düzenle. Oyunu platform sunucusunda dene (`npm run dev`, ardından `http://localhost:4321/oyunlar/<slug>/`). Hangar gibi modül kullanan oyunlar `file://` ile değil HTTP üzerinden çalışır.
2. Oyunun kendi testlerini çalıştır: `npm run test:games`.
3. Yeni bir runtime dosyası eklediysen `config/games.json` içindeki `runtime` listesine ekle.
4. Değişikliği kaydet:

   ```sh
   npm run games:record -- <slug>
   ```

   Komut `docs/imports/<slug>.json` içindeki envanteri ve runtime hash'lerini günceller; kaç dosyanın değiştiğini yazar. Rapordaki farkı PR'da incelenecek şekilde commit et. Kalıcı bir platform uyarlaması yaptıysan gerekçesini `localChanges` alanına bir cümleyle ekle.

5. `npm run build`, `npm run games:verify` ve ilgili tarayıcı testi (`tests/browser/<oyun>.spec.ts`).

### Önbellek sürümleri

Oyunların `index.html` dosyaları yerel CSS ve script adreslerine içerik hash'inden türetilmiş `?v=` parametresi ekler; böylece güncellenen dosya eski tarayıcı önbelleğinden okunmaz. Bir CSS/JS dosyasını değiştirdiğinde ilgili `?v=` değerini yeni hash'in ilk 12 karakteriyle güncelle:

```sh
shasum -a 256 games/<slug>/<dosya> | cut -c1-12
```

Kağıt Hangar ES modüllerini `index.html` içindeki bir import map ile sürümler; değişen modülün satırını aynı şekilde güncelle.

## Yeni oyun ekleme

Yeni bir oyun birkaç yere birlikte kaydedilir:

| Yer                                | Ne eklenir                                                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `games/<slug>/`                    | Oyunun kendisi. Lisans dosyaları (`assets/DEPENDENCIES.md`, font OFL metinleri vb.) dahil.                                                                                                                        |
| `config/games.json`                | Benzersiz slug (`a-z0-9-`), başlık (≤ 60), açıklama (≤ 180), gerçek oyun modu ve incelenerek çıkarılmış `runtime` listesi. Test, README, ham veri, veri üretici betik veya build ayarı eklenmez.                  |
| `docs/imports/<slug>.json`         | `npm run games:import -- <üst-klasör> --only <slug>` (ayrı bir depodan) veya `npm run games:record -- <slug>` (bu depoda yazıldıysa; önce `{"slug":"<slug>","files":{},"runtime":{}}` ile boş bir rapor oluştur). |
| `content/guides.json`              | "Nasıl oynanır" rehberi: `intro`, `rules`, `controls`, `paper`.                                                                                                                                                   |
| `src/lib/discovery.ts`             | `discoveryMeta`: tür(ler) ve oyuncu biçimi (`solo`, `together`).                                                                                                                                                  |
| `scripts/assets.mjs`               | Ana sayfa çizimi (Rough.js, sabit tohum) ve gerekiyorsa lisans künyesinin `public/assets/licenses/` altına kopyası.                                                                                               |
| `src/pages/kaynaklar.astro`        | Fontlar, kütüphaneler, veriler için atıf.                                                                                                                                                                         |
| `deploy/migrations/NNN_<slug>.sql` | Yayındaki kataloğa ve yönetim taslağına oyunu **ayrı ayrı** ekleyen migration. Taslaktaki yayımlanmamış metinler yayına karışmamalı, geçmiş revizyonlar değişmemeli. Önceki migration'ları örnek al.              |
| `deploy/rollback/<slug>.sql`       | Aynı oyunu taslak ve yayından çıkaran, migration kaydını silen geri dönüş.                                                                                                                                        |
| `src/lib/catalog.ts`               | `releases` listesine bir önceki tam kataloğu ekle; böylece eski snapshot ve revizyonlar okunabilir kalır.                                                                                                         |
| `tests/<slug>-migration.test.ts`   | İleri/geri/ileri geçişin taslak, yayın, sıra, görünürlük ve çakışmayı koruduğunu doğrulayan test.                                                                                                                 |
| `tests/browser/<slug>.spec.ts`     | Oyunun alt dizinde açıldığını, yalnız izinli dosyaların sunulduğunu ve temel akışı doğrulayan test.                                                                                                               |

Oyunlarda dikkat edilecekler:

- Kullanıcı verisini veya dış veriyi DOM'a `innerHTML` ile değil `textContent` ile yaz. Oyunlar yönetim alanıyla aynı origin'de çalışır.
- `localStorage`/`sessionStorage` erişimini `try` içinde yap; tarayıcı depoyu kapattığında oyun bellekte çalışmaya devam etmeli. Anahtarlar oyuna özgü önek taşımalı.
- `<base>`, analytics, üçüncü taraf betik veya ortak platform CSS'i ekleme. Dış font/CDN kullanılıyorsa gizlilik sayfasında belirt.
- Kâğıdın üst kenarına `← İçindekiler` dönüş bağlantısını ekle (bkz. [tasarım sözleşmesi](TASARIM.md#oyunlardan-dönüş)).

## Ayrı bir depodan oyun güncelleme

Oyunların çoğu başlangıçta ayrı depolarda geliştirilip buraya alındı; raporlardaki `source` alanı (ör. `../xox`) bu depoların bu klasörün yanına klonlandığı düzeni gösterir. Bu depolar herkese açık değildir; açık kaynak katkılar doğrudan `games/` altında yapılır. Ayrı depodan güncelleme iki adımlıdır ve hiçbir zaman doğrudan üzerine yazmaz:

```sh
node scripts/update-game.mjs stage <slug> ../<kaynak-depo>
```

Bu komut `.imports/` altında aday bir kopya ve eklenen/değişen/silinen dosyaların raporunu üretir. Yerel kopyada kaydedilmemiş değişiklik varsa önce `games:record` ister. Raporu, yeni modül/asset bağımlılıklarını ve runtime izin listesini incele; yeni runtime dosyası gerekiyorsa manifeste ekleyip yeniden stage et. Ardından raporun sonunda yazan tam SHA-256 ile:

```sh
node scripts/update-game.mjs apply <slug> <RAPOR_SHA256>
npm run games:verify && npm run build && npm run test:games
```

Eski kopya `.imports/backups/` altına taşınır. Platforma özgü uyarlamalar (dönüş bağlantısı, `?v=` sürümleri, Hangar import map'i) yeni sürüme yeniden uygulanır ve `games:record` ile kaydedilir. `npm run games:verify -- --sources` kaynak depolar yanınızda klonluysa onların da kayıttaki commit ve dosyalarla aynı olduğunu doğrular; yoksa bu adımı atlar. `.imports/` Git'e ve üretime girmez.

## Platform uyarlamaları

Oyun kopyalarında platform için yapılmış, bilinçli değişiklikler (ayrıntılı gerekçeler raporların `localChanges` alanındadır):

- Bütün oyunlarda kâğıdın üst kenarında sessiz `← İçindekiler` bağlantısı, ortak açık kâğıt paleti, iki ince arka yaprak ve baskı kuralları.
- Kağıt Hangar: `manifest.webmanifest` içindeki `start_url` ve `scope` alt dizin için `./`; ES modülleri import map ile sürümlenir.
- Amiral Battı: `draw.js` içinde kullanıcı isteğiyle eski batma efekti (3 px aşağı kayma, 6° yatma).
- Sayı Bulma: odak dönüş bağlantısındayken klavye dinleyicisi Enter'ı yakalamaz.
- Kağıt Futbolu: kaynak deponun son hâli yerine incelenmiş önceki görünüm sürümü alınmıştır.
- Oyunlar `games/package.json` ile CommonJS sınırı içinde tutulur; kök paketin ESM ayarı oyun testlerine sızmaz. Oyunlardaki kendi `package.json` dosyaları yalnız o oyunun geliştirme araçları içindir; platform build'i onları kurmaz.
