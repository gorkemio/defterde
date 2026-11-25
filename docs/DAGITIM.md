# Dağıtım, yedekleme ve geri dönüş

Defterde tek bir Node servisi (Astro SSR + Fastify) ve ona özel bir PostgreSQL ile çalışır. Canlı site [defterde.com](https://defterde.com) [Dokploy](https://dokploy.com) üzerinde Docker Compose ile yayınlanır; aynı dosyalar herhangi bir Docker Compose ortamında da çalışır.

## Paket

- `Dockerfile` iki aşamalıdır: build aşaması oyunları izin listesine göre paketler, Astro sitesini ve sunucuyu derler; çalışma aşaması yalnız `dist/`, `build/`, üretim bağımlılıkları, `config/` ve migration dosyalarını içerir.
- Node taban imajı sürüm ve digest ile, npm paketleri `package-lock.json` ile sabitlenmiştir. Kurulum `--ignore-scripts` ile yapılır.
- Uygulama root olmayan `node` kullanıcısıyla çalışır. Katalog snapshot'ı `/app/var` kalıcı volume'undadır.
- `deploy/compose.yml` web ve db servislerini tanımlar. Veritabanı yalnız iç ağdadır; dışarıya port açılmaz.

## Ortam değişkenleri

| Değişken                                   | Zorunlu | Açıklama                                                                                                                                                           |
| ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_ORIGIN`                            | evet    | Sitenin HTTPS adresi, ör. `https://defterde.com`. Üretimde `https://` zorunludur.                                                                                  |
| `POSTGRES_PASSWORD`                        | evet    | Veritabanı parolası. URL içinde güvenli, uzun rastgele bir değer kullan: `openssl rand -hex 32`.                                                                   |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | evet    | Yönetim girişi için GitHub OAuth App bilgileri.                                                                                                                    |
| `GITHUB_OWNER_ID`                          | evet    | Yönetime girebilecek tek hesabın **sayısal** GitHub kullanıcı ID'si (kullanıcı adı değil). `https://api.github.com/users/<kullanıcı-adı>` yanıtındaki `id`.        |
| `TRUST_PROXY`                              | hayır   | Compose'da varsayılan `1`. Ters vekil arkasında istemci IP'sinin hangi hop'tan okunacağı. Ayarlanmazsa OAuth oran sınırı bütün ziyaretçiler için tek kovaya düşer. |
| `SITE_HOST`                                | hayır   | `www.` yönlendirmesi için çıplak alan adı. Varsayılan `defterde.com`.                                                                                              |
| `PUBLIC_REPO_URL`                          | hayır   | Sitedeki GitHub bağlantısı. Build sırasında okunur; çatallar kendi depolarını yazar.                                                                               |

Secret'lar yalnız dağıtım ortamında (ör. Dokploy Environment bölümü) tutulur; depoda ve imajda bulunmaz.

## İlk kurulum (Dokploy)

1. Docker Compose projesi oluştur, Git kaynağını bağla, compose yolu olarak `deploy/compose.yml` seç. Build context proje köküdür.
2. Environment bölümüne yukarıdaki değişkenleri gir.
3. `web` servisine alan adını ekle: path `/`, container port **4321**, HTTPS/Let's Encrypt. Veritabanına alan adı veya host portu verme.
4. İstersen `www.` alan adını ekle ve **yalnız** o router'a `defterde-www@docker` middleware'ini bağla. Etiketler `www.<SITE_HOST>` → `<SITE_HOST>` kalıcı yönlendirmesini tanımlar. Ana alan adını aynı middleware'e bağlama, döngü olur. Dosya sağlayıcısı kullanıyorsan [traefik-www.yml](../deploy/traefik-www.yml) örneğine bak; iki yöntemi birlikte kullanma.
5. GitHub OAuth App ayarları: ana sayfa `https://<alan adı>`, callback `https://<alan adı>/auth/github/callback`. İstenen scope boştur; depo erişimi istenmez.
6. Dağıtımdan sonra `/healthz`, ana sayfa, birkaç oyun ve `/yonetim/` kontrol edilir. Sahip hesapla giriş/yayın/çıkış denenir, sahip olmayan bir hesabın reddedildiği görülür. Otomatik kontrol:

```sh
node scripts/smoke-production.mjs https://<alan adı>
```

Bu betik bütün oyun sayfalarını ve runtime dosyalarının hash'lerini canlı siteyle karşılaştırır; sonucu `test-results/production-smoke.json` dosyasına yazar.

## Migration'lar

Uygulama açılışta bekleyen migration'ları transaction ve advisory lock içinde, checksum kontrolüyle uygular; uygulanmış dosya tekrar çalışmaz. Uygulanmış bir migration dosyası **düzenlenmez**; her şema veya katalog değişikliği yeni bir numaralı SQL dosyasıdır. Şema `src/server/schema.ts` (Drizzle) ile birlikte güncellenir.

Migration'ı dağıtımdan önce ayrıca çalıştırmak için:

```sh
docker compose -f deploy/compose.yml up -d db
docker compose -f deploy/compose.yml build web
docker compose -f deploy/compose.yml run --rm --no-deps web node build/server/migrate.js
docker compose -f deploy/compose.yml up -d web
```

Dokploy'un compose proje adı ve env dosyası hostta farklı olabilir; komutlarda paneldeki `-p`/`--env-file` değerlerini kullan. Container terminali `/` dizininde açılabilir: `cd /app && node build/server/migrate.js`.

## Yedekleme ve geri yükleme

PostgreSQL custom-format yedeğini ve katalog volume'unu düzenli olarak sunucu dışında sakla. Günlük ölçümler ve işlem geçmişi 13 ayda temizlenir; katalog revizyonları saklanır.

```sh
mkdir -p backups && chmod 700 backups
docker compose -f deploy/compose.yml exec -T db pg_dump -U defterde -d defterde -Fc > backups/defterde.dump
docker compose -f deploy/compose.yml cp web:/app/var/catalog.json backups/catalog.json
```

Geri yüklemeyi önce **ayrı, boş bir veritabanında** dene:

```sh
docker compose -f deploy/compose.yml exec -T db createdb -U defterde defterde_restore
docker compose -f deploy/compose.yml exec -T db pg_restore -U defterde -d defterde_restore --no-owner --exit-on-error < backups/defterde.dump
```

Doğrulandıktan sonra yönetim yazmalarını durdur ve `DATABASE_URL`'yi geri yüklenen veritabanına çevir. Oturumları iptal etmek için orada `TRUNCATE admin_sessions, oauth_states;` çalıştır. Veritabanı erişilebilir olduğunda yayımlanmış katalog için tek doğruluk kaynağıdır: snapshot dosyası DB'den ilerideyse uyarı loglanır ve DB'deki yayın diske yazılır. Doğrulama bitmeden eski veritabanını veya volume'u silme. Snapshot'ı elle geri koyman gerekirse dosyanın sahibi UID 1000, modu 600 olmalı.

## Önceki sürüme dönüş

Her yayında commit ve imaj digest'ini not et. Yalnız uygulama kodu değiştiyse Dokploy'da önceki başarılı deployment'ı seçmek yeterlidir; DB ve volume aynı kalır. Oyun dosyaları `must-revalidate` + ETag ile sunulur, uzun ömürlü önbellek yoktur.

Kataloğa oyun ekleyen her migration'ın bir geri dönüş SQL'i vardır. Eski uygulama yeni oyunu içeren kataloğu kabul etmez; bu yüzden bu sürümlere dönüşte yalnız imajı değiştirmek yetmez:

1. Web servisini durdur; PostgreSQL ve katalog volume'unu yedekle.
2. İlgili geri dönüş dosyasını aynı veritabanında çalıştır. Dosya yalnız o oyunu güncel taslak ve yayından çıkarır; diğer oyunların metin, sıra ve görünürlüğünü, geçmiş revizyonları korur ve migration kaydını siler:

   ```sh
   docker compose -f deploy/compose.yml exec -T db psql -U defterde -d defterde -v ON_ERROR_STOP=1 < deploy/rollback/<oyun>.sql
   ```

3. Güncel snapshot'ı ayrı sakla. Uygulama bir migration'dan önceki snapshot'ı ilk okumada `catalog.json.before-<oyun>` adıyla yedekler; oyun sayısı eski sürüme uyuyorsa onu `catalog.json` olarak geri koy, uymuyorsa güncel snapshot'tan yalnız o oyunun çıkarıldığı bir kopya kullan.
4. Önceki imajı aynı DB ve volume ile başlat; katalogdaki oyun sayısını kontrol et. Volume'ları silme. Yeniden ileri geçildiğinde migration güvenle tekrar uygulanır.

Birden fazla adım geriye gidiliyorsa geri dönüşler yeniden eskiye doğru sırayla uygulanır.

| Migration              | Eklenen oyun(lar)                 | Geri dönüş                         |
| ---------------------- | --------------------------------- | ---------------------------------- |
| `002_kagitrallisi.sql` | Kağıt Rallisi                     | `deploy/rollback/kagitrallisi.sql` |
| `003_dokuztas.sql`     | Dokuz Taş                         | `deploy/rollback/dokuztas.sql`     |
| `004_three_games.sql`  | 5'li XOX, Nokta Oyunu, Sayı Bulma | `deploy/rollback/three-games.sql`  |
| `005_turkdamasi.sql`   | Türk Daması                       | `deploy/rollback/turkdamasi.sql`   |
| `006_kibrit.sql`       | Kibrit Bulmacası                  | `deploy/rollback/kibrit.sql`       |
| `007_labirent.sql`     | Labirent                          | `deploy/rollback/labirent.sql`     |
| `008_kakuro.sql`       | Kakuro                            | `deploy/rollback/kakuro.sql`       |
| `009_tangram.sql`      | Tangram                           | `deploy/rollback/tangram.sql`      |
| `010_domino.sql`       | Domino                            | `deploy/rollback/domino.sql`       |
| `011_mangala.sql`      | Mangala                           | `deploy/rollback/mangala.sql`      |
| `012_nonogram.sql`     | Kare Karalamaca                   | `deploy/rollback/nonogram.sql`     |
| `013_besharf.sql`      | Beş Harf                          | `deploy/rollback/besharf.sql`      |

Her ileri/geri/ileri geçiş, `tests/*-migration.test.ts` içinde ayrı PostgreSQL test veritabanlarında doğrulanır.

## Önizleme ortamı

Ayrı bir Compose projesi kullan: kendi `PUBLIC_ORIGIN`'i, kendi OAuth App'i, ayrı DB ve `catalog` volume'u. Üretim oturumlarını, yedeklerini ve secret'larını paylaşma. Arama motorlarına kapatmak için önizleme router'ına `X-Robots-Tag: noindex` ekle.

## Arıza davranışı

- **DB kapalı:** Oyunlar ve bellekteki/diskteki son katalog açık kalır. Hiç yayın yoksa dağıtımla gelen başlangıç kataloğu kullanılır. Yönetim 503 ile kapalı kalır; bağlantı 30 saniyede bir yeniden denenir.
- **Migration checksum hatası:** Uygulanmış bir migration dosyası değiştirilmiş demektir. Log satırı dosya adını verir; migration'lar uygulanmaz, site son katalogla açık kalır.
- **Snapshot yazılamıyor:** Yayın DB'ye kaydedilmiş olabilir; API bunu açıkça bildirir. Volume izinlerini/diski düzelt, yenileme son DB yayınını tekrar diske yazar.
- **Ölçüm:** En çok 10 saniyede bir toplu yazılır. Başarısız parti bırakılır, oyun yanıtı beklemez.
- `/healthz` yalnız uygulamanın oyun sunabildiğini gösterir; DB sağlığı iddiası değildir.
- Loglarda IP, URL, OAuth code, cookie, token veya bağlantı dizesi yoktur. Ters vekilin erişim loglarını da kişisel veri saklamayacak şekilde yapılandır.
- Bu sürümün işletim modeli tek web replica'dır; snapshot birden fazla replica arasında paylaşılmaz.

Resmî kaynaklar: [Astro Node middleware](https://docs.astro.build/en/guides/integrations-guide/node/), [Fastify Static](https://github.com/fastify/fastify-static), [GitHub OAuth ve PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [Dokploy Compose](https://docs.dokploy.com/docs/core/docker-compose), [Dokploy alan adları](https://docs.dokploy.com/docs/core/domains).
