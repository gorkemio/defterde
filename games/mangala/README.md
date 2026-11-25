# Mangala — Defterde

`index.html` dosyasını çift tıklayarak aç. Kurulum, build, sunucu ve internet
gerekmez. Yerel önizleme için `python3 -m http.server 18765` da kullanılabilir.

Türk Mangala'sını bilgisayara karşı veya aynı cihazda iki kişi oyna. Alt
taraftaki Ayarlar komutundan rakibi, kolay/orta/zor seviyeyi ve tek set/beş setlik
maçı seç. Değişiklikler yeni oyunla uygulanır; ilk başlayan kura ile belirlenir.

- Dolu bir kuyuna dokun veya ok tuşlarıyla dolaşıp Enter/Space ile oyna.
- Geri al, bilgisayarın takip eden hamlelerini de son kullanıcı kararıyla
  birlikte kaldırır. Yeni sette geçmiş temizlenir.
- İpucu hamle önerir; kendisi oynamaz. Süreli öneri kesin çözüm olarak sunulmaz.
- Nasıl oynanır bölümündeki dört örnek gerçek motoru kullanır; maçın bekler.
- Ses ilk açılışta kapalıdır. Ayarlar saklanabilir; depolama engelli olsa da
  oyun çalışır. Yarım oyun saklanmaz.
- Dağıtımı atlayabilir veya işletim sisteminin hareket azaltma ayarını
  kullanabilirsin. Yeniden boyutlandırma da dağıtımı son duruma getirir.

Kuyularını ilk boşaltan, karşıda kalan taşları da toplar. Tek taşın doğrudan
kendi hazinesine düşmesi, set sürüyorsa ek hamle verir; bu açık ürün
tercihidir. Kale kuralı yoktur.

## Dosyalar

`board.js` tek kural kaynağı, `match.js` setler ve geri alma, `ai.js` arama,
`draw.js` sabit çizim ve olay animasyonu, `ui.js` ekran akışı ve iptallerdir.
Saf modüller tarayıcıda `Mangala` ad alanını, Node'da CommonJS'i kullanır.
Çalışma sırasında dış ağ isteği, ES modülü veya fetch yoktur.

- [Yerel bağımlılıklar ve lisanslar](assets/DEPENDENCIES.md)

## Doğrulama

```sh
node --test test/*.test.js
node test/visual.cjs /kurulu/playwright/paketinin/yolu
node test/layout.cjs /kurulu/playwright/paketinin/yolu
node test/edge-flows.cjs /kurulu/playwright/paketinin/yolu
node test/benchmark.cjs
node test/native-browsers.cjs
node test/capture.cjs /kurulu/playwright/paketinin/yolu
```

Playwright yalnız geliştirme kontrolü içindir; uygulamaya dahil değildir.
Tarayıcı testi geçici HTTP sunucusu ve bağımsız test oturumları açar.
Native kontrol kurulu Firefox ve Safari'yi dener; `18765` yerel önizleme
sunucusunun açık olmasını bekler. Safari uzak otomasyon izni gerektirir.
Testler kullanıcının mevcut tarayıcı profilini kullanmaz.
Tarayıcı kabulü en az bir motor bütün kontrolleri tamamlamazsa hata verir.
`capture.cjs`, etkileşim testlerinden sonra çalıştırılır; Chrome/macOS ekran
yakalama şeritlerini önlemek için karşılaştırma görsellerini temiz WebKit
sayfalarından üretir.
`layout.cjs`, kısa telefon ve pencere ölçülerinde tahta ile altı komutun
ilk görünümde kaldığını, 44 px hedefleri, ayarlar ve geri almayı kontrol eder.

`docs/browser-checks.json`, `docs/native-browser-checks.json` ve
`docs/ai-benchmark.json` gerçek ölçüm kayıtlarıdır. Fiziksel telefon ve
VoiceOver ile manuel kontrol yapılmadı; mobil ölçümler tarayıcı emülasyonudur.
