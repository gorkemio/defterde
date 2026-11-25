# Kağıt Futbolu

Kareli defter üzerinde bilgisayara karşı veya iki kişiyle oynanan, vanilla JavaScript ile yazılmış oyun. Derleme ve sunucu gerektirmez: `index.html` dosyasını tarayıcıda açmak yeterlidir.

HTTP önizlemesi için:

```sh
npx serve .
```

Ardından `http://127.0.0.1:8139` adresini açın. Bu sunucu yalnızca yerel geliştirme içindir.

## Cihazlar ve kontroller

- Yerleşim hem kullanılabilir yüksekliğe hem genişliğe uyar; tarayıcının görünür alanı ve ekranın güvenli kenar boşlukları hesaba katılır.
- Dikey ekranda kaleler üstte/altta, yatay ekranda solda/sağdadır. Mavi yatayda sağ kaleye, kırmızı sol kaleye hücum eder. Ekranı çevirmek oyun durumunu değiştirmez.
- Bir saha adımı 44 px altına düştüğünde sekiz adet 44×44 px yön düğmesi açılır. Yalnızca yasal hamleler etkindir. Ayarlardan düğmeleri her zaman göstermek de mümkündür.
- Hedef noktaya dokunun veya tıklayın. Fareyle topu sürükleyebilirsiniz; dokunmatik sürükleme ayarlardan açılır. Sürüklemeyi iptal etmek hamle yapmaz.
- Sahaya klavye odağı verildiğinde ok tuşları düz, **Q/E/Z/C** çapraz hamle yapar. **W/A/X/D** de düz yönleri kontrol eder. Yönler her zaman ekrana göredir.
- Ayarlar ayrı, kaydırılabilir bir modalda açılır. Tab/Shift+Tab panel içinde dolaşır; Escape veya “tamam” kapatır ve odağı açan kontrole döndürür.
- Daha rahat saha sağlayacaksa kapatılabilir bir çevirme önerisi çıkar. “Tam ekran / yatay” kullanıcı dokunuşuyla tarayıcı desteğini dener; destek yoksa cihazı elle çevirmek yeterlidir.
- Skor ve sıra görünür metindir; sıradaki oyuncunun skorunun altında kalem çizgisi gösterilir. Sıra, sekme ve sonuçlar canlı duyuru alanına da yazılır. Büyük metin ve hareket azaltma tercihi desteklenir. Aşırı yakınlaştırmada tarayıcının kaydırma/yakınlaştırma davranışı korunur.

## Kodun sınırları

| Dosya | Sorumluluk |
|---|---|
| `board.js`, `ai.js` | Kurallar ve bilgisayar rakip; görünümden bağımsız mevcut `KF.board` / `KF.ai` arayüzleri. |
| `layout.js` | Saf saha sığdırma, ekran–saha yön dönüşümleri ve kâğıt baskısı hizası; tarayıcı ve Node testlerinde ortak. |
| `gorunum.js` | Görünür alana göre ölçüm, kareleri saha noktalarına hizalama, skor vurgusu, yön düğmeleri, klavye, ekran yönü ve tam ekran. |
| `draw.js` | SVG çizimi. Saha `T.dunya` grubunda döner, yazılar ters dönüşle düz tutulur. Giriş koordinatları bu grubun ters ekran matrisiyle hesaplanır. |
| `ui.js` | Oyun akışı, modal, giriş doğrulama, kayıtlı sesler ve sayfa zamanlayıcıları. Dokunma, sürükleme, klavye ve yön düğmeleri aynı hamle doğrulamasına gider. |
| `kit/ses.js` | Sentezlenmiş ses ve iptal edilebilir gecikmeler. Sessize alma eski ses çıkışını ayırır. |

Bitmemiş maçta tekrar izleme otomatik sayfa geçişini durdurur; tekrar bittiğinde 3,2 saniyelik geçiş yeniden kurulur. Tekrar skor yazmaz. Yeni sayfa eski zamanlayıcıları ve sesleri iptal eder.

Kâğıt, doku ve gölge tek `::before` yüzeyindedir. Bu yüzeyin içindeki kare ve marj baskısı SVG deseniyle düz tutulur; her saha adımı iki kareye karşılık gelir. Baskının başlangıcı sahanın ekran koordinatından hesaplanır. Böylece kâğıdın dış kenarı hafif eğik kalırken saha noktaları dikey ve yatay ekranlarda kare kesişimlerine oturur.

Defterin masası, tonu ve katmanları `defter.css`'te (Dokuz Taş'taki `kit/kursunkalem.css` hissinden uyarlandı): koyu ahşap masa ve lamba ışığı, sıcak eskimiş kâğıt (`--kagit`, soluk kareler ve marj), kenarlara doğru sararma, üst kenarda ışık ve masaya düşen uzun yumuşak gölge. Üstteki sayfanın altında iki yaprak daha durur (`.defter::before/::after`); eğimleri sayfanın `--defter-egimi` değerine göre biraz farklıdır. Küçük ekranda kayma ve dönme gövde boşluğuna (8 px) sığacak kadar azdır, geniş masaüstünde belirgindir. Basılı kareleri ve eğimi `.sayfa::before` taşıdığı için `gorunum.js` hizası etkilenmez.

Geniş yatay düzende sayfa araçları, skor, menü, bilet ve kaptan aynı sütunda ortalanır. Biletin merkezi kale merkeziyle hizalanır; menü ve kaptan üst/alt alanları paylaşır. Sütun genişliği yazı boyutuna uyar, daralan alanda mevcut yön düğmeli düzen devreye girer. Korner bayrağının yüksekliği sahanın alt kenarından hesaplanır.

Rough.js 4.6.6, MIT lisansıyla `assets/vendor/` altında yereldir. Çevrimdışı oyun için CDN gerekmez. Google Fonts yüklenmezse yerel el yazısı yazı tipi kullanılır; varlık kaynakları `assets/README.md` içindedir.

## Testler

Node.js ve npm ile:

```sh
npm ci
npm test
npx playwright install chromium webkit firefox
npm run test:browser
BROWSER=webkit npm run test:browser
BROWSER=firefox npm run test:browser
```

`npm test`, mevcut 44 motor/oyun testiyle birlikte yerleşim, koordinat ve ses iptali testlerini çalıştırır. Tarayıcı testleri varsayılan olarak doğrudan `file://` üzerinden açılır. `BASE_URL=http://127.0.0.1:8139` HTTP üzerinden, `BROWSER_CHANNEL=chrome` kurulu Chrome ile çalıştırır. `npm run test:all` birim testlerini ve varsayılan tarayıcı süitini birleştirir.

Dış kaynak engelleme testi `file://` altında bütün HTTP isteklerini kapatır; `BASE_URL` verildiğinde yalnızca test sunucusunun kendi dosyalarına izin verir.

Tarayıcı matrisi her üç saha boyutunu şu CSS piksel ölçülerinde sınar: 320×568, 360×640, 375×667, 390×844, 568×320, 667×375, 844×390, 768×1024, 1024×768, 1440×900. Saha, kale köşeleri, skor ve ana kontrollerin ekran sınırları; taşma, örtüşme ve yön düğmesi boyutları ölçülür. Ayrıca dokunma, sürükleme/iptal, çift dokunma, yön değiştirme, AI sırasında boyut değişimi, geri alma, maç/tekrar/sıkışma akışları, odak, canlı duyuru, iki kat metin, tam ekran reddi, ses iptali ve dış ağ kapalı başlangıç sınanır.

Performans örneklemesi:

```sh
node test/perf.js olcum
```

İstenen hamle sayısına ulaşan bitmemiş konum üretilemezse `NaN` yerine “örnek yok” raporlanır; bu satır performans kanıtı sayılmaz.

### Doğrulama sınırı — 18 Ekim 2026

50 birim testi geçti; 27 tarayıcı senaryosu HTTP üzerinden Chromium ile Playwright WebKit üzerinde doğrulandı. Sağ sütun düzenlemesinin son metin sarma düzeltmesinden etkilenen beş senaryo iki motorda tekrarlandı; iki kat yazıda tekrar düğmesinin etiket sınırları ayrıca ölçüldü. Matris kare baskısının saha ve kale noktalarıyla hizasını da ölçer; skor vurgusu hamle, geri alma, gol ve yeni sayfada sınanır. HTTP üzerinden mobil Chromium'da normal animasyonlar, dokunma ve oyun sürerken yön değişimi de kontrol edildi. Bunlar otomatik tarayıcı/dokunma testleridir. WebKit sonucu fiziksel Safari/iPhone/iPad testi yerine geçmez. Firefox bu ortamda profil klasörü hatasıyla sayfa açılmadan kapandığı için doğrulanamadı. Fiziksel iPhone, iPad, Android telefon/tablet ve tarayıcıların önceki ana sürümleri ayrıca denenmelidir. Hedef güncel ve önceki Safari, Chrome, Firefox ve Edge sürümleridir; bütün cihazlarda kusursuzluk doğrulanmış değildir.
