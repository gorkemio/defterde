# Domino — Defterde

Kareli defter üzerinde iki oyunculu Çekmeli Domino. Bilgisayara karşı üç zorluk
seviyesi veya aynı cihazda iki kişi; tek el, 50 ve 100 puanlık maçlar.

Vanilla HTML/CSS/JS kullanır. Kurulum, paket indirme, build, hesap veya sunucu
gerektirmez. Fontlar, Rough.js, kâğıt dokusu ve ses üretimi yereldir.

## Açma

`index.html` dosyasını tarayıcıda açın. Klasik scriptler ve yerel varlıklar
`file://` kullanımı için düzenlenmiştir. Bu oturumda doğrudan dosya açılışı,
tarayıcı aracının erişim politikası nedeniyle canlı doğrulanamadı.

Doğrulanmış yerel HTTP yolu için proje klasöründe:

```sh
python3 -m http.server 4187 --bind 127.0.0.1
```

Ardından [oyunu açın](http://127.0.0.1:4187/). İnternet bağlantısı gerektiren
bir çalışma zamanı kaynağı yoktur.

## Oynama

- İlk kurulum varsayılanı: bilgisayar, orta zorluk, 50 puan.
- Taş seç → uygun uç seç → önizlemeyi gör → **Oyna**. Tek uygun uç kendiliğinden seçilir.
- Açılışta dağıtılmış ellerdeki en büyük çift zorunludur. Çift yoksa toplamı en
  yüksek taş; eşitlikte büyük yarısı yüksek taş başlar.
- Hamlen yoksa **Taş çek**, ilk uygun taş gelene veya havuz bitene kadar çeker.
  Çekilen uygun taş otomatik oynanmaz. Havuz da boşsa kısa açıklama ardından pas verilir.
- **Geri al**, yalnız seçim ve önizlemeyi temizler. Onaylanan hamle geri alınmaz.
- **İpucu**, yaklaşık taş/uç önerisidir; hamleyi sen onaylarsın.
- **Sırala**, elini bir kez sıralar. Sonraki çekilen taşlar sona eklenir.
- İki kişilik modda el kapanınca cihazı diğer oyuncuya ver. **Hazırım** yeni eli açar.
- Bir el bitince iki el açılır ve puan hesabı gösterilir. **Sonraki el** skoru korur;
  **Yeni maç** yeni kurulum açar.

Elini ilk boşaltan rakibinin kalan noktalarını alır. İki ardışık pas eli kilitler;
noktası az olan farkı alır. Eşit toplam beraberliktir. Sıfır puanlık galibiyet mümkündür.

## Klavye ve ekran

Tab ile kontrollere ilerle; Enter/Space ile seç. Eldeyken ok tuşları, Home ve End
taşlar arasında dolaşır. Escape seçimi temizler. Sol/Sağ uç kısayolları kıvrılan
zincirin ilgili ucunu görünür alana getirir. Tahta ve el ayrı kaydırılır.

Azaltılmış hareket tercihi desteklenir. Ses ilk etkileşimden sonra düşük düzeyde
başlar ve hoparlör düğmesiyle kapatılabilir. Yalnız kurulum ve ses tercihi saklanır;
yeniden yükleme maçı sıfırlar. Depolama kapalıysa oyun bellekte devam eder.

## Yapı

| Dosya | Görev |
| --- | --- |
| `board.js` | Saf kurallar, yasal seçenekler, çekme/pas ve el sonucu |
| `match.js` | Tohumlu dağıtım, puan ve sonraki el |
| `view.js` | AI için gizli bilgiyi dışarıda bırakan bağımsız oyuncu görünümü |
| `ai.js` | Üç seviye, örnek dağılımlar, süre bütçesi ve iptal |
| `layout.js` | Sabit açılış, iki yönde büyüyen zincir, temas geometrisi |
| `draw.js` | Taş kimliğine bağlı sabit ve önbellekli SVG çizimleri |
| `ui-support.js` | Odak korunarak DOM güncelleme ve erişilebilir sonuç metni |
| `ui.js` | Kurulum, oyun akışı, gizli geçiş, klavye ve ses |

AI gerçek rakip elini, havuz sırasını veya dağıtım tohumunu almaz. Zor seviye,
yalnız görünür bilgiden olası eller örnekler. 600 ms bütçesinde tamamlanan aday
turları kullanılır; süre yetmezse yasal orta seviye hamlesine dönülür.

## Doğrulama

Node 24 ile:

```sh
node --test tests/*.test.js
node tests/benchmark.js
node tests/prepare-browser.js
```

24 test geçer. Kapsam: 400 tamamlanan el, 120 puanlı maç, 4.880 yerleşim kurgusu,
AI bilgi sınırı/yasallık/iptal, yerel kaynaklar ve beş UI yardımcı testi.
UI testleri küçük DOM sözleşmesi modelleri kullanır; gerçek tarayıcı testi yerine geçmez.
Benchmark 200 eşlenmiş dağıtımda
koltukları değiştirerek her seviye çifti için 400 el oynatır.

Yerel HTTP test sayfaları:

- `tests/browser.html`: 3/10/20/28 taş, dönüşler, AI süre/iptal raporu.
- `tests/blocked-hand.html`: gerçek kurallarla oynanan, tekrarlanabilir kilitlenme eli.
- `tests/storage-denied.html`: depolama reddedildiğinde normal oyun.

Çevrimiçi oyun kapsam dışıdır.

