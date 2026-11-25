# Sayı Bulma (+ / −)

Okulda oynanan sayı bulma, defterin son sayfasında: çizgili kâğıt, kırmızı-mavi kurşun kalem. Biri 4 haneli bir sayı
tutar (rakamlar tekrar edebilir, 5755 gibi; Ayarlar'dan "farklı" seçilebilir), öbürü tahmin eder; her tahmine "+" (doğru rakam, doğru yer) ve "−" (doğru rakam, yanlış yer)
sayısıyla cevap verilir.

- **Oynamak:** `index.html`'e çift tıkla. İnternet gerekmez (rough.js ve Kalam yerel kopya).
- **Oyunlar (Ayarlar → oyun):** sen bul · o bulsun (aklında tut ya da sayını yazıp izle) · yarış · iki kişi · günün sayısı.
  "Nasıl oynanır?" içindeki **izle** bilgisayara bir sayıyı çözdürür.
- **Ayarlar:** zorluk (sen bul'da yardımlar, diğerlerinde bilgisayarın seviyesi), hane 3 · 4 · 5, ilk hane 0, tekrarlı rakam,
  çizelge elle/otomatik, iki kişide cevapları kim verir. Tercihler tarayıcıda saklanır.
- **Testler:** `npm test` (= `node --test test/*.test.js`; kurallar, çözücü, rakam glifleri).
- **Önizleme sunucusu (yalnız geliştirme):** `npx serve -l 8143 .` → http://127.0.0.1:8143
- **Sürüm damgası:** `./surum.sh` (commit öncesi kancada otomatik).

| Dosya | Ne |
|---|---|
| `rules.js` | Sayı kümesi, cevap hesabı (tekrarlıda çoklu küme), günün sayısı, paylaşım metni (DOM yok) |
| `solver.js` | Aday kümesi, kolay/orta/zor tahmin (dilimli, bütçeli), çelişki, çıkarım (DOM yok) |
| `draw.js` | Sayfa yerleşimi (tek/iki sütun), satırlar, giriş kutuları, sayaçlar, çizelge, kalan notu, sonuç |
| `ui.js` | Akış: modlar ve aşamalar, giriş, bilgisayar sırası, çelişki ve düzeltme, ayarlar, ses, yırtma |
| `config.js` | Varsayılanlar ve çözücü bütçesi |
| `kit/` | Ortak defter kiti: dört malzeme, çizgili sayfa, kalem rakamları (`kit/README.md`) |

