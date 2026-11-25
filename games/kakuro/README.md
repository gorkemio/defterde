# Kakuro — Defterde

Türkçe, çevrimdışı Kakuro. 20 kolay, 20 orta ve 20 zor bulmaca; tümü boş
başlar, tek çözüm ve tahminsiz mantıksal çözüm doğrulamasından geçmiştir.

`index.html` dosyasını çift tıkla veya `npm run preview` çalıştırıp
http://127.0.0.1:4178 adresini aç. İnternet, npm kurulumu ve build gerekmez.
HTTP önizlemesi için Node gerekir; dosyayı doğrudan açmak için gerekmez.

## Oyna

- Bir beyaz kare seç, 1–9 ile veya sayı tuşlarıyla yaz. Seçim kendiliğinden ilerlemez.
- **N / Not al:** boş karelerde küçük adayları açıp kapat.
- **Delete / Backspace / Sil:** değeri, boşsa notları sil.
- **Ctrl / Cmd + Z / Geri al:** önceki değeri ve notlarını geri getir.
- Oklarla gezin; Yatay / Dikey düğmeleriyle grubu seç.
- **İpucu:** kanıtlı aday daraltmalarını adım adım incele. Rakam kesinleşince **Uygula** ile yaz.
- **Bir hücreyi aç:** seçili boş kareyi ayrı bir yardım olarak doldur.
- **Bulmacalar:** zorluğu seç, kaldığın yerden devam et veya tamamladığın bulmacayı yeniden oyna.

İlerleme ve tercihler Kakuro'ya ait localStorage alanında saklanır. Süre,
gizli sekmede, duraklatmada, listede, öğreticide ve tamamlanınca durur.
Depolama reddedilirse oyun bellekte sürer ve bunu ekranda bildirir.
Başka sekme aynı bulmacayı güncellerse eski sekme durur; **Son kaydı yükle**
ile güncel ilerlemeye geçilir.
Yardım sayısı geri almayla azalmaz; bitmiş denemeler yardımlı / yardımsız
ayrı tutulur. Ses ilk kullanıcı etkileşiminden sonra kısık kalem/silgi sesidir.

`file://` ve HTTP farklı tarayıcı depolarını kullanabilir. Aynı oyuna aynı
adres üzerinden dönmek kaydını bulmanı sağlar.

## Geliştirme ve doğrulama

```sh
npm run check
npm test
npm run verify:content
npm run preview
```

`npm run generate`, seed kullanan üreticiyi `generated/generation-progress.json`
kontrol noktasından sürdürür. Paket ancak 20/20/20 kotası tamamlanınca yazılır.
`generated/proofs.json` tam mantık izlerini ve bulmaca başına tekrar üretilebilir
seed'leri; `generated/verification-report.json` bağımsız doğrulama sonuçlarını
tutar. `verify:content`, her seed'i yeniden üretip imzasını da karşılaştırır.
Yeni bir üretim yapmak için mevcut `generated/` çıktılarını önce ayrı bir
yere arşivle; yeni kontrol noktasıyla üretim uzun sürebilir.

Tarayıcı kontrolleri Playwright ile çalışır; çalışma zamanı bağımlılığı değildir:

```sh
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-game.cjs
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-navigation.cjs
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-zoom.cjs
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-visibility.cjs
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-multitab.cjs
PLAYWRIGHT_MODULE=/tam/yol/node_modules/playwright node tools/verify-layout.cjs
```

Zoom kontrolü tarayıcının gerçek %200 ayarını kullanır. Görünürlük kontrolü
geçici normal Chromium penceresinde ikinci sekmeyi açar; otomasyonun
zorunlu odak emülasyonunu kullanmaz. Testler sonunda kendi profillerini
siler. İlk üç komuta ekran görüntüsü almak için `CAPTURE=1` eklenebilir.

## Belgeler

- [Mimari ve veri sözleşmeleri](docs/architecture.md)

Kaynak kit dosyaları değiştirilmeden kopyalanmıştır. Kalem malzemesinin
eski ahşap zeminli CSS'i yüklenmez. Kâğıt kenarı yerel SVG'nin CSS'e
gömülmüş kopyasıdır; file:// üzerinde ayrıca maske isteği yapılmaz.

Faz 1'in ayrı görsel provası [preview.html](preview.html) içinde korunur.
Oradaki örnekler doğrulanmış oyun paketine dahil değildir.
