# Mimari ve doğruluk sözleşmeleri

Vanilla HTML/CSS/JS; sıralı klasik `defer` betikleri. Çalışma zamanında
fetch, ES modülü, CDN, backend veya kardeş klasör bağımlılığı yoktur.
Node araçları yalnız geliştirme/üretim/doğrulama içindir.

## Modüller

| Dosya | Sorumluluk |
|---|---|
| `board.js` | 9 bit maskeler, kombinasyon indeksi, yapı ve değer doğrulaması |
| `solver.js` | Hücreye özgü DP desteği, yayılım, kesin çözüm sayımı, dilimli çalışma |
| `logic.js` | Çözümden bağımsız aday analizi, kanıt adımları, Türkçe açıklama |
| `game.js` | Saf durum işlemleri, geri alma, monoton aktif saat |
| `storage.js` | Sürümlü ve doğrulanmış kayıt, tercihler, tamamlanmış denemeler |
| `puzzles.js` | 60 boş başlangıç tanımı ve doğrulama özeti; cevap/iz içermez |
| `draw.js` | Yerel kit ile deterministik dekor ve rakam SVG'leri |
| `view.js` | Erişilebilir hücreler, değer/not güncellemesi, odak ve kaydırma |
| `ui.js` | Klavye/dokunma, yardım yaşam döngüsü, liste, öğretici ve ses |

Çekirdek dosyalar tarayıcıda `Kakuro` ad alanına, Node'da CommonJS'e açılır.
`preview*.js` yalnız eski görsel prova sayfasında kullanılır.

`BoardView.resize`, hem kullanılabilir genişliği hem de CSS'teki tahta
yükseklik sınırını kullanır. Hücreler en az 44 px kalır; daha büyük tahta
yalnız kendi alanında yatay/dikey kayar. Seçim önce bu alan içinde görünür
kılınır, gerekirse sayfa kaydırılır. Yeniden boyutlandırma sayfayı düşeyde
çekmez. Hata, ipucu ve tamamlanma, sayı/araç alanından sonraki ortak
`game-feedback` bölümündedir; liste ve öğretici bu bölümü gizler.

## Tahta ve durum

`PuzzleDefinition`: `id`, `version`, `rows`, `cols`, `cells`,
`difficulty`, `seed`, `verification`. Hücre `white` veya `dark`;
koyu hücre `across` / `down` toplamı taşıyabilir. Hücre indeksleri satır
öncelikli, sıfır tabanlıdır.

`compileBoard(definition)`, geçerliyse `ok: true`, `white`, `groups`,
`membership` ve boyutları; değilse `ok: false, errors` döndürür.
Gruplar bir kez derlenir. Her beyaz hücre tam bir yatay ve bir dikey gruba
bağlanır. Yetim ipucu, 2–9 dışı uzunluk, imkânsız toplam, bağlantısız
beyaz alan ve yanlış hücre türleri reddedilir.

`GameState`: tahta, değerler, kullanıcı not maskeleri, seçim, yön,
not modu, geçmiş, aktif süre, yardım sayısı/anahtarları, deneme kimliği,
tamamlanma ve revizyon. `applyAction` ile `undo` yeni durum döndürür.
Geri alma eski değer ve notu birlikte getirir; yardım sayısını azaltmaz.
Tamamlanma saklanan cevapla karşılaştırılmaz, `validateValues` ile bütün
grupların toplam/tekrar/doluluk kurallarından hesaplanır.

## Kesin çözüm

1–9 tekrarsız kümeleri uzunluk ve toplamla indekslenir. Her grup için
hücre sırası / kullanılan rakam maskesi üzerinden önbellekli DP, mümkün
yerleşimleri ve desteklenen hücre-rakam çiftlerini bulur. Permütasyon
dizileri belleğe açılmaz. Destek yatay/dikey gruplar arasında kararlı
duruma yayılır. Gerekirse en az adaylı hücreden dallanılır; ikinci
çözümde durulur.

`countSolutions(board, values?, budget?)`: `none`, `unique`,
`multiple`, `unknown`; çözümler ve arama istatistikleri. Bütçe biterse
bir çözüm bulunmuş olsa da `unknown` döner. İptalde `cancelled: true`
ve `reason: cancelled` kullanılır. `unique` tamamlanmış bir kanıttır.

`solutionSteps` ve `supportSteps` üreteçleri çalışmayı böler.
`countSolutionsAsync` / `runSliced`, yaklaşık 8 ms'de olay döngüsüne
döner. Tarayıcı yardımının toplam süre sınırı 2 saniyedir.
İçerik kabulü 30 saniye / bir milyon düğümdür. Üreticideki daha dar
ön tarama bütçesi yalnız aday reddeder; `unknown` kabul edilemez.

## Mantık ve yardım

`createAnalysis`, yalnız değerlerden başlar. Kullanıcı notları hiçbir
mantıksal aday hesabına girmez. `nextLogicalStep`, değişiklik öncesi/sonrası
maskeler, dayanak gruplar, teknik, kademe ve gerekçe taşıyan bir adım döndürür.
Teknikler: kombinasyon, verilmiş rakam, tek aday, kalan toplam; filtrelenmiş
kombinasyon, zorunlu tek yer, açık ikili/üçlü; tam yerleşim desteği.

Gizli tek yalnız tüm kalan kombinasyonlarda zorunlu bir rakam için
üretilir. İleri açıklama her elenen rakamı ve ilgili hücre kısıtlarını
açılabilir ayrıntıda gösterir. Yeni çıkarım bir yardım sayılır; yeniden
gösterme veya Uygula ikinci kez sayılmaz.

İpucundan önce mevcut durum kesin çözücüyle denetlenir. Çelişki ve
belirsizlikte doğru hamle önerilmez. Yerel kurallar yanlış hücreyi
belirleyemiyorsa tek hücre suçlanmaz. Değer/bulmaca değişikliği devam
eden analizi iptal eder; istek kimliği ve değer imzası eski sonucun
uygulanmasını önler. Sayı girişinde kesin çözücü çağrılmaz.

## İçerik üretimi ve bağımsız doğrulama

`tools/generate.cjs`, bağlantılı dikdörtgen kümeleri ve dar bağlı yollarla
düzen oluşturur. Rastgele geri izlemeli dolgu grup tekrarlarını ve iki
rakamın değiştirilebildiği döngüleri önler. Bu ek filtre doğruluk kanıtı
değildir; toplamlar çıkarıldıktan sonra kesin sayım yine zorunludur.

Kolay 5–7, orta 7–9, zor 9–11 boyutundadır. Sınıflandırma önce daha düşük
kademe ile çözmeyi dener. İleri tekniğin gereksiz kullanımı kategori
yükseltemez. 1/3/6 ağırlıklı adım puanı beyaz hücre sayısına bölünür;
kategori içindeki sıralama bu puanladır.

`tools/verify-trace.cjs` üretim DP'sini veya mantık adım fonksiyonunu
çağırmaz. Her eleme için bağımsız grup DFS'iyle zorlanmış rakamın
yerleştirilemediğini doğrular, değişiklikleri başlangıçtan yeniden uygular.
Son değerlerin tüm kurallara uyduğunu ayrıca denetler.

`tools/verify-content.cjs` 60 kaydı, 20/20/20 kotasını, kategori boyutlarını,
tek çözümü, tam izleri, alt kademe tıkanmasını, puanları, tüm dönüşümlere
karşı kanonik imzaları, en az beş düzeni ve düzen başına en fazla dört
bulmacayı doğrular. Her bulmacayı kendi seed'inden yeniden üretir.

## Kayıt, süre ve ses

`defterde.kakuro.v1.` öneki altında bulmaca başına ayrı kayıt, tercihler
ve ses seçimi tutulur. Boyut, veri sürümü, rakam/not aralığı, süre,
yardım sayısı ve seçim doğrulanır. Hatalı kayıt diğer oturumları bozmaz.
Depolama erişimi reddedilirse aynı okumadan itibaren bellek yedeği kullanılır;
bozuk JSON bu durumdan ayrı değerlendirilir. Geçmiş sayfa açılışında
yeniden başlar. Tamamlanmış denemeler kimlikle tekilleştirilir; son
hamle geri alınırsa o denemenin tamamlanması kaldırılır.

Kalıcı kayıt her okumada yeniden alınır. Oyun açılırken benimsenen kayıt,
yazmadan önce güncel kalıcı değerle karşılaştırılır; liste okumaları bu
karşılaştırmanın başlangıç değerini değiştirmez. Başka sekme kaydı değiştirmişse
eski sekme kaydetmez, süre ve girişleri durdurur; görünür açıklamadaki
“Son kaydı yükle” eylemi yeni kaydı açıkça benimser. `storage` olayı aynı
durumu açık sekmede de bildirir. Revizyon ve yazar kimliği kayda eklenir.
Bu denetim localStorage üzerinde iyimser çakışma kontrolüdür; bir veritabanı
işlemi veya atomik sekmeler arası kilit değildir.

`ActiveClock`, `performance.now()` farklarını biriktirir. Gizli sekme,
duraklatma, liste, öğretici, kayıt çakışması ve oyun sonu süreyi durdurur; kapalı geçen
duvar saati eklenmez. Ses seviyesi 0.15; yalnız ilk kullanıcı etkileşimi
sonrasında `grafit` ve `kayma` / `silgi` çağrılır. Melodi çağrılmaz.
