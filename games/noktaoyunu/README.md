# Nokta Oyunu (kutu kapmaca)

Noktalı deftere kurşun kalemle çizgi çekip kutuları kuru boyayla karaladığın Nokta Oyunu.
Sırayla iki komşu nokta arasına çizgi çekilir; bir kutunun dördüncü kenarını çeken kutuyu alır ve bir daha oynar;
çizgiler bitince kutusu çok olan kazanır. Bilgisayara karşı (kolay · orta · zor), aynı cihazda iki kişi ya da 20 bulmaca.

Görünüm, Defterde’deki oyunların ortak açık bej masası (`#b6a58a`) ve krem kâğıdıyla (`#fbf9f2`) eşleşir.
Noktalı sayfa ve kurşun kalem korunur; iki ince arka yaprağın yalnız en alttakinde dış gölge vardır.

- **Oynamak:** `index.html`'e çift tıkla. İnternet gerekmez (rough.js ve Kalam yerel kopya).
- **Testler:** `npm test` (kurallar, zincirler, son oyun çözücüleri, yapay zekâ, bulmacalar, yerleşim) ·
  `npm run sim` (seviyeler arası kazanma oranı) · `npm run bench` (zor modun hamle süreleri).
- **Tarayıcıda uçtan uca:** `node tools/uctan.js http://127.0.0.1:8143/ [chromium|webkit]` (Playwright; npm test'e dahil değil).
- **Bulmacaları yeniden üret:** `node tools/bulmaca-uret.js` (tohumlu; her bulmaca çözücüyle doğrulanır).
- **Önizleme sunucusu (yalnız geliştirme):** `npx serve -l 8143 .` → http://127.0.0.1:8143 · oyun ortası örnek konum: `index.html#ornek`.
- **Sürüm damgası:** `./surum.sh` (commit öncesi kancada otomatik).

| Dosya | Ne |
|---|---|
| `board.js` | Tahta ve kurallar: geometri, make/unmake, güvenli/tehlikeli çizgiler (DOM yok) |
| `chains.js` | Zincir/döngü/kavşak ayrıştırması, uzun zincir paritesi, parça çözücüsü, tahta üstü kesin arama, oyun sonu analizi (DOM yok) |
| `ai.js` | Bilgisayar: kolay, orta (sessiz güvenli hamle + kesin son oyun), zor (güvenli hamleler üstünde dilimli alpha-beta) (DOM yok) |
| `bulmacalar.js` | 20 "bu konumda kazan" bulmacası (`tools/bulmaca-uret.js` üretir) |
| `layout.js` | Ekran yerleşimi: geniş "defter" ve dar "dikey" düzen (DOM yok) |
| `draw.js` | Noktalar, kurşun kalem çizgiler, kuru boya kutular, marj puanları, tehlike tikleri, zincir çevreleri, sonuç ve analiz işaretleri |
| `ui.js` | Akış: dokunma (en yakın çizgi), klavye, hamle animasyonları, bilgisayar sırası, geri al, ipucu, iki kişi, izle, bulmaca, ayarlar, ses |
| `config.js` | Boyutlar, zorluk bütçeleri, dokunma eşiği, animasyon süreleri, izle tohumları |
| `kit/` | Ortak defter kiti: noktalı sayfa, kurşun kalem malzemesi, kuru boya katmanı (`kit/README.md`) |

(canlı: `docs/karsilastirma.html`, kardeş klasörler aynı düzeyde olmalı).
