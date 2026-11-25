# Tangram — Defterde

120 hazır şekil, on kategori ve kendi şeklini yapma modu. Vanilla HTML/CSS/JS; bütün fontlar, dokular, kitaplıklar ve bulmaca verileri yereldir.

120 kaydın tamamı geometri kontrolünden geçer; dönmüş veya aynalanmış kopya yoktur. Tek krem kareli çalışma sayfası, yerel Patrick Hand ve lacivert/kırmızı kalem dili kullanılır. Katalog ile oyun ayrı açılır; katalog kapasitesi ekranın kalan yüksekliğine göre seçilir. Hedef ve bütün parçalar aynı ölçekte sığdırılır, 44 px komutlar küçültülmez.

## Açma

`index.html` dosyasını doğrudan açın. Oyun için kurulum, build, sunucu veya internet gerekmez. Tarayıcı dosya kökeninde kalıcı depolamayı engellerse oyun bellekte çalışmaya devam eder; kaydedilemediği ekranda belirtilir.

İsteğe bağlı yerel HTTP önizlemesi:

```sh
npm run preview
```

Ardından `http://127.0.0.1:4173` adresini açın. Bu komut yalnız Python'un yerel dosya sunucusunu başlatır.

## Oyun

- Fare/trackpad: parçaya tıklayın, düğmeyi basılı tutmadan taşıyın ve tekrar tıklayıp bırakın. Sürükleme de çalışır. Dokunmada seçip boş noktaya dokunma ve parmağın üstünde yakın görünüm korunur.
- Parça elinizdeyken sağ tık, tekerlek veya trackpad'de iki parmakla kaydırma 45° döndürür. Shift + sağ tık ters yöndür; Q/E de çalışır. Escape ya da Geri al, eldeki taşımayı iptal eder.
- Sağa/sola döndürme komutları ve paralelkenarı ters çevirme sürükleme sırasında da çalışır. Kenar ve köşe hizalaması yalnız görünür geometriyi kullanır; parça bırakılacağı konumda görünür.
- Geri al ve baştan başlat kullanılabilir. Başarı, hedefi çakışmasız kaplamaya dayanır; alternatif çözümler ve eş üçgenlerin değişmesi kabul edilir.
- Katalogda Türkçe ad/etiket araması, kategori, zorluk, tamamlanma ve favori filtreleri vardır. Son oyuna devam edilebilir.
- İlk üç öğretici şekilde iç sınırlar açık başlar. Sınırları açma, iki aşamalı ipucu ve çözüm önizlemesi ayrı kontrollerdir. Önizleme kendi düzeninizi korur, tek başına başarı sayılmaz.
- İlerleme, parça düzenleri, favoriler ve tercihler bu tarayıcıya kaydedilir. Ses kapatılabilir.
- `design.html`: boş sayfada kendi şeklinizi kurun, ad verin, kaydedin ve oynayın. Yedi parçanın tamamı çakışmadan birleşmelidir. Kişisel şekiller hazır 120 kayda katılmaz.

Klavye: **1–7** seçim; **oklar** taşıma; **Shift + ok** ince hareket; **Q/E** dönüş; **F** çevirme; seçili parçadayken **Enter/Space** hizalama; **Delete** tepsiye alma; **Ctrl/Cmd + Z** geri alma; **Escape** sürüklemeyi iptal. Metin alanlarında oyun kısayolları çalışmaz.

## İçerik araçları

- `editor.html`: geliştirici atölyesi; temas/çakışma tanısı, sayısal konum düzeltme, metadata ve geçerli JSON içe/dışa aktarma.
- `review.html`: isimleri gizli, karışık sırada inceleme; tahminler, tanınabilirlik kararları, notlar ve indirilebilir rapor. Kullanıcı inceleme kararı olmadan hiçbir kayıt kabul edilmiş sayılmaz.

```sh
npm test
npm run catalog:check
npm run catalog:previews
node tools/catalog.cjs pack girdi.json yeni-kategori.js
```

`pack` mevcut dosyayı ezmez. `npm run catalog:build`, seçilmiş kaynak verilerinden kategori dosyalarını yeniden üretir; oyun açılışının parçası değildir. Node testleri harici paket kurulumu istemez.

20 özgün yerleşim ve Peces projesinden açık lisansla uyarlanan 100 yerleşim kullanıldı. Kaynak kayıtları, uyarlama yöntemi ve GPL-2.0-or-later içerik lisansı [CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md) içinde; diğer yerel varlıklar [DEPENDENCIES.md](assets/DEPENDENCIES.md) içinde.

Gerçek 120 kaydın listesi: [CONTENT-CATALOG.md](docs/CONTENT-CATALOG.md).
