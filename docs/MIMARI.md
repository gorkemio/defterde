# Mimari, sınırlar ve güvenlik

## İstek sırası

Fastify önce API/auth ve üretilmiş statik oyun ağacını çözer. Astro'nun resmî Node adaptörünün middleware `handler(req,res,next,locals)` girişine yalnız platform sayfaları gider. `Astro.locals` ile yayımlanmış katalog ve doğrulanmış yönetici bağlamı aktarılır. API veya eksik oyun asset'i SSR fallback'e düşmez. Statik sunum `@fastify/static`, API/statik sıkıştırma `@fastify/compress`, Astro HTML sıkıştırması standart `compression` middleware'i ile yapılır.

Oyunlar ayrı HTML belgeleridir. Göreli modül/asset yolları, hash rotaları ve browser storage anahtarları korunur. Oyunlara yalnız CDN, ses, fullscreen, baskı ve clipboard yeteneklerini kısıtlamayan asgari bir CSP gönderilir: `object-src 'none'; base-uri 'self'; frame-ancestors 'self'`. Oyunlar yönetim alanıyla aynı origin'dedir; bir oyunda XSS bulunursa yönetici oturumu adına istek atılabilir. Bu yüzden yeni oyunlar `innerHTML` yerine `textContent` kullanmalı; ileride yönetim ayrı bir alt alana taşınabilir. Platform sayfalarının CSP'si yalnız yerel kaynakları, script için `self` ve form için `self` kabul eder; frame/object/base engellidir. Platformun tüm dinamik katalog metinleri Astro tarafından escape edilir; yönetim JS'i textContent kullanır.

Tek kök bağımlılık paketi vardır; oyunlardaki `package.json` dosyaları yalnız o oyunun kendi geliştirme araçları içindir. Build onları kurmaz/çalıştırmaz. Adam Asmaca veri üretimi çağrılmaz. Platform drawing kodu build sırasında deterministic Rough.js yolları üretir. Ana sayfa JS olmadan tam çalışır (form GET ile süzer); `src/client/discovery.ts` yalnız anlık süzme ve "Bana bir oyun seç" düğmesini ekler.

## Veri modeli

- `catalog_state`: tek satırda taslak, iyimser sürüm sayısı ve yayındaki revizyon.
- `catalog_revisions`: değişmez yayın içerikleri, zaman, yönetici ID'si.
- `admin_sessions`: rastgele oturum belirtecinin SHA-256 özeti, yönetici ID'si, CSRF sırrı, 8 saatlik son kullanma.
- `oauth_states`: tek kullanımlık state özeti, PKCE verifier, 10 dakikalık son kullanma.
- `daily_opens`: İstanbul günü + slug başına toplam; kişi/session/IP içermez.
- `admin_audit`: yönetim işlem türü, zaman, aktör ID'si, revizyon; form içeriklerini tekrar kopyalamaz.

Yazmalar PostgreSQL transaction + `SELECT … FOR UPDATE` ile sıralanır. Gönderilen sürüm mevcut sürüm değilse 409; mevcut taslak ezilmez. Yayın ve restore yeni immutable revizyon oluşturur. Snapshot DB commit'inden sonra atomik temp-file/rename ile kalıcı diske yazılır. Tek process kuyruğu yayın dosyalarının sırasını korur. Son yayın bellekte tutulur; 30 saniyede bir DB ile toparlanır. DB erişilebilirken yayımlanmış katalog için tek doğruluk kaynağıdır: DB yedekten geri yüklenip snapshot'tan geride kalırsa uyarı loglanır ve DB'deki yayın esas alınır. Snapshot dosyası yalnız içerik değiştiğinde yeniden yazılır; eski oturum/OAuth kayıtlarının temizliği saatte bir yapılır. Snapshot başarısızsa API başarı iddiasında bulunmaz; DB yayınını geri döndürmeden hatayı açıklar. Yönetim formu kaydedilmemiş metni tutar.

## API sözleşmesi

Bütün yazmalar JSON; gövde üst sınırı 32 KB. Kimliği doğrulanmış yazmalar `Origin: PUBLIC_ORIGIN` ve `X-CSRF-Token` ister. Validation dışındaki alanları reddeder; slug kümesi tekildir ve teknik manifestteki oyunlarla eşleşir. Başlık 1–60, açıklama 1–180 karakterdir. Oyun modu ve dosya yolu panelden değiştirilemez.

| İstek                                | İçerik                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| GET `/api/v1/catalog`                | görünür yayımlanmış items, salt okunur mode, revision, publishedAt                   |
| GET `/api/v1/admin/catalog`          | version, draft, publishedRevision, son 50 yayın geçmişi, son snapshot                |
| PATCH `/api/v1/admin/catalog`        | `{version, items:[{slug,title,description,visible}]}`; dizi sırası katalog sırasıdır |
| POST `/api/v1/admin/catalog/publish` | `{version}`                                                                          |
| POST `/api/v1/admin/catalog/restore` | `{version, revision}`; eski yayın yeni revizyon olur                                 |
| GET `/api/v1/admin/metrics`          | son 30 İstanbul günü toplamları; UI 7/30 gün hesaplar                                |
| GET `/api/v1/admin/audit`            | en yeni 100 işlem                                                                    |
| GET `/auth/github`                   | state + S256 PKCE; scope boş                                                         |
| GET `/auth/github/callback`          | state/cookie eşleşmesi, tek kullanımlık DB state, GitHub ID allowlist                |
| POST `/auth/logout`                  | CSRF korumalı oturum silme                                                           |

401 giriş, 403 yetki/CSRF/state, 400 içerik, 409 eski revizyon, 502 GitHub doğrulama, 503 hizmet/DB/snapshot hatasıdır. Bilinmeyen sayfa 404, SSR hatası 500 döner. Admin/auth yanıtları no-store/noindex'dir. Draft önizleme aynı oturum kontrolünden geçer. Gizleme bir erişim kontrolü değildir; direkt oyun ve rehber bağlantıları açık kalır.

## Güven sınırları

1. Ziyaretçi → HTTP: sınırlı/validate edilmiş JSON, CSRF ve origin denetimi; upload yok, SQL değerleri parametreli.
2. GitHub → OAuth: yalnız sabit `github.com` ve `api.github.com` URL'leri, 8 sn timeout, state tarayıcı çerezi + DB, PKCE S256, sabit **sayısal ID** kontrolü. Provider token'ı işlem dışında saklanmaz. Client ID/secret yoksa hiçbir bypass yok.
3. Tarayıcı → session: production `__Host-defterde`, Secure, HttpOnly, SameSite=Lax, path `/`; server hash araması ve her istekte owner kontrolü. Çıkış DB kaydını siler. Dev HTTP yalnız yerel önizleme içindir.
4. Oyun kaynakları → yayın: tam dosya izin listesi + SHA-256; dotfile, traversal, test ve development dosyaları reddedilir. Kaynak tümden static root değildir.
5. DB → katalog: JSON schema kontrolü, atomik snapshot, string escape; son başarılı katalog DB kesintisinden bağımsızdır.

Global request logging kapalıdır. Hata logları yalnız hata sınıfını (ör. `PostgresError`) içerir; URL, IP, cookie, header, OAuth code, bağlantı dizesi veya secret yazılmaz. Rate limit OAuth yollarında IP başına 10/dakikadır. Varsayılan `trustProxy:false`'tur; istemcinin gönderdiği sahte X-Forwarded-For kabul edilmez. Ters vekil (Traefik vb.) arkasında `TRUST_PROXY` ayarlanmalıdır: sayı → güvenilen vekil hop sayısı (Dokploy/Traefik için `1`), aksi halde virgüllü IP/CIDR listesi. Ayarlanmazsa bütün ziyaretçiler vekilin IP'sini paylaşır ve 10 anonim istek sahibin girişini bir dakika kilitleyebilir. Reverse proxy log politikası ayrıca işletmecinin sorumluluğudur.

## Ölçüm sınırları

Yalnız 200 dönen oyun giriş HTML GET sayılır. Asset, HEAD, redirect, 304, health check, yaygın bot ve Purpose/Sec-Purpose/X-Purpose/X-Moz ön yüklemeleri hariçtir. 304 yeniden doğrulamalarda açılışın sayılmaması bilinçli sınırdır; benzersiz/eksiksiz kullanım ölçümü iddiası yoktur. İstek bittiğinde yalnız bellekte oyun/gün sayısı artar; DB toplu yazımı yanıtı bekletmez. Kesinti parti kaybı yaratabilir. Timer 10 saniyedir.

## Test yaklaşımı

API testi gerçek PostgreSQL ile çalışır; migration testleri her yayın adımının ileri/geri alınabildiğini ayrı `*_test` veritabanlarında doğrular. Tarayıcıdaki yönetim testi ayrı test DB'sine geçici oturum ekler. Sahte GitHub kimlik sağlayıcısı yalnız test fonksiyonuna enjekte edilir; üretim kodunda bypass veya test modu yoktur.
