# Katkı rehberi

Defterde'ye katkın için teşekkürler! Hata bildirimi, oyun iyileştirmesi, erişilebilirlik düzeltmesi, yazım düzeltmesi ya da yeni oyun önerisi: hepsi değerli.

## Başlamadan önce

- Küçük düzeltmeler için doğrudan PR açabilirsin.
- Yeni oyun, büyük görsel değişiklik veya kural değişikliği için önce bir [öneri issue'su](https://github.com/gorkemio/defterde/issues/new/choose) aç; harcayacağın emek boşa gitmesin.
- Güvenlik açıklarını issue olarak değil, [SECURITY.md](SECURITY.md)'deki özel kanaldan bildir.

## Geliştirme ortamı

Gerekenler: **Node 24** ve npm. PostgreSQL isteğe bağlıdır.

```sh
git clone https://github.com/gorkemio/defterde.git
cd defterde
npm ci --ignore-scripts
npm run dev
```

`http://localhost:4321` açılır. Veritabanı olmadan bütün oyunlar ve katalog çalışır; yalnız yönetim alanı kapalıdır. Kod değiştirdikten sonra `npm run dev` komutunu yeniden çalıştır (build + sunucu; canlı yenileme yoktur).

Veritabanıyla çalışmak için:

```sh
docker run -d --name defterde-pg -e POSTGRES_USER=defterde -e POSTGRES_PASSWORD=yerel -p 127.0.0.1:5432:5432 postgres:17-alpine
cp .env.example .env   # DATABASE_URL içindeki parolayı "yerel" yap
npm run dev            # migration'lar açılışta uygulanır
```

## Kod düzeni

| Klasör                          | İçerik                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| `src/server/`                   | Fastify sunucusu: API, GitHub girişi, statik oyun sunumu, ölçüm, migration |
| `src/pages/`, `src/components/` | Astro sayfaları (ana sayfa, rehberler, yönetim)                            |
| `src/lib/`                      | Katalog modeli, keşif süzgeçleri, yönetim arayüzü betiği                   |
| `games/<oyun>/`                 | Her oyun bağımsız bir HTML/CSS/JS belgesi                                  |
| `config/games.json`             | Oyun kataloğu ve yayımlanacak dosyaların izin listesi                      |
| `docs/imports/`                 | Oyun dosyalarının hash kayıtları                                           |
| `deploy/`                       | Docker Compose, migration ve geri dönüş SQL'leri                           |
| `scripts/`                      | Oyun paketleme, çizim üretimi, kayıt ve doğrulama araçları                 |
| `tests/`                        | Platform testleri; `tests/browser/` Playwright testleri                    |

Ayrıntılar: [mimari](docs/MIMARI.md), [tasarım sözleşmesi](docs/TASARIM.md), [oyun ekleme ve güncelleme](docs/OYUNLAR.md).

## Bir oyunu değiştirmek

Oyun dosyaları yayına hash kontrolüyle çıkar. Bir oyunda değişiklik yaptıysan:

```sh
npm run test:games                 # oyunların kendi testleri
npm run games:record -- <oyun>     # değişikliği docs/imports/<oyun>.json'a işler
npm run build
```

Kaydetmeden build alırsan `Runtime changed without reviewed import` hatası görürsün; bu beklenen bir korumadır. Değişen CSS/JS dosyalarının `index.html` içindeki `?v=` sürümlerini de güncelle ([ayrıntı](docs/OYUNLAR.md#önbellek-sürümleri)).

## Testler

```sh
npm run check          # Astro + TypeScript tür denetimi
npm run format:check   # Prettier (düzeltmek için: npm run format)
npm run build          # testlerden önce gerekir
npm test               # platform testleri
npm run test:games     # her oyunun kendi testleri
npm run games:verify   # oyun klasörleri kayıtlarla aynı mı?
```

Veritabanı testleri `TEST_DATABASE_URL` yoksa atlanır. Çalıştırmak için ayrı, adı `_test` ile biten bir veritabanı ver; testler tabloları temizler, **asla üretim bağlantısı kullanma**:

```sh
TEST_DATABASE_URL=postgres://defterde:yerel@127.0.0.1:5432/defterde_test npm test
```

Migration testleri her biri için ayrı bir değişken ve veritabanı kullanır (`TEST_KAKURO_DATABASE_URL`, `TEST_TANGRAM_DATABASE_URL` …); hepsini kurmak için CI dosyasındaki adımlara bak: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

Tarayıcı testleri çalışan bir sunucuya karşı koşar:

```sh
npx playwright install chromium
npm start &                               # ayrı terminalde de olur
npx playwright test --project=chromium
```

Firefox ve WebKit de yapılandırılmıştır: `npx playwright install firefox webkit && npm run test:browser`.

## Stil

- Biçim Prettier ile otomatik denetlenir (`games/` hariç; oyunlar kendi stillerini korur).
- Arayüz metinleri Türkçedir ve oyuncuya "sen" diye hitap eder. Kısa, sıcak ve açık yaz.
- Erişilebilirlik: dokunma alanı en az 44 px, görünür klavye odağı, `prefers-reduced-motion` desteği. Ayrıntılar [tasarım sözleşmesinde](docs/TASARIM.md).
- Yeni font, kütüphane veya veri eklersen lisans dosyasını yanına koy ve [UCUNCU-TARAF.md](UCUNCU-TARAF.md)'ye ekle.

## Commit ve PR

- Commit mesajları [Conventional Commits](https://www.conventionalcommits.org/) biçimindedir: `feat:`, `fix:`, `docs:`, `test:`, `style:`, `refactor:`.
- Bir PR tek bir konuya odaklansın. PR şablonundaki kontrol listesini doldur.
- CI biçim, tür denetimi, build, platform/DB testleri, oyun testleri ve Chromium tarayıcı testlerini çalıştırır.

Katkıların [MIT lisansı](LICENSE) ile paylaşılır.
