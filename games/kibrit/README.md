# Kibrit Bulmacası

Kibrit çöplerinden yapılmış yanlış bir eşitlik; bir (ya da iki) çöpün yerini değiştirerek, kutudan bir çöp ekleyerek ya da
bir çöpü kutuya kaldırarak doğru yaparsın. Varsayılan mod bilgisayara karşı maç: aynı bulmaca iki gazete kupüründe, önce
çözen turu alır. Defterde ailesinin oyunu: kareli defter, kurşun kalem marjı, üstünde bantlanmış gazete kupürü ve gerçek
kibrit çöpleri.

- **Çalıştırma:** `index.html`'e çift tıkla (`file://` ile çalışır) ya da `npx serve -l 8145 .` → http://127.0.0.1:8145
- **Testler:** `npm test` (`node --test test/*.test.js`; bağımlılık yok). Havuzun tamamını denetlemek: `KB_TAM=1 npm test`.
- **Havuz üretimi:** `node scripts/uret.mjs` (~10 s) → `data/havuz/*.js`, `docs/havuz-raporu.md`, `engine/difficulty.js` kalibrasyon bloğu.
- **Bilgisayar simülasyonu:** `node scripts/sim.mjs` → `docs/bilgisayar.md` (seviye × kategori × bant ortalama süre ve pes oranı).
- **Sürüm damgası:** `./surum.sh` (`index.html`'deki `?v=` damgalarını içerikten günceller; pre-commit kancası çalıştırır).

| Klasör | Ne |
|---|---|
| `engine/` | DOM'a dokunmayan motor: `model.js` (hücreler, tanıyıcı, değerlendirici), `solver.js` (hızlı çözücü), `generator.js`, `difficulty.js`, `rating.js`, `ai.js` |
| `ui/` | sahne ölçüsü, kupür, sürükle-bırak, marj, havuz yükleyici, kalıcılık, modlar, ayarlar, açılış |
| `kit/` | ortak defter kiti + gazete kupürü, kibrit, damga (bkz. `kit/README.md`) |
| `data/havuz/` | kategori × bant paketleri (tembel yüklenen `.js` dosyaları) |
| `test/` | node testleri; `naif.js` referans çözücü |
| `docs/` | havuz raporu, bilgisayar simülasyonu, Faz 1 karşılaştırması |

Modlar: Maç (3/5/7 tur, Kolay · Orta · Zor · Usta), Hepsini Bul, Boz ve Düzelt, Kitaplar, Sonsuz, Günün bulmacası,
İki kişi (sırayla Boz ve Düzelt; tablette karşılıklı yarış).

<!-- HAVUZ-BAS -->
**Havuz** (2026-10-20): 19000 bulmaca. Tek Çöp 8000 · İki Çöp 5000 · Bir Çöp Ekle 2000 · Bir Çöp Çıkar 2000 · Hepsini Bul 1500 · Romen 500.
<!-- HAVUZ-SON -->
