# Kare Karalamaca

Satır ve sütun başlarındaki sayılara bakarak kareleri karala; doğru kareler karalanınca saklı resim ortaya çıkar.
Bulmaca bitince 12'li kuru boya kutusu açılır, resim boyanır ve albüme girer (MEB Zekâ Oyunları'ndaki "Kare Karalamaca", nonogram).
Defterde ailesinin oyunu: kareli matematik defteri, kurşun kalem tarama, kuru boya. "Bulmaca Defteri"nin ilk türü.

## Oynamak

`index.html`'i çift tıkla (internet gerekmez). Önizleme sunucusu: `npx serve -l 8147 .` → http://127.0.0.1:8147

- **Defterler:** sekiz kategori defteri (Mutfak, Hayvanlar, Şehir, Doğa, Okul, Defterde, Taşıtlar, Müzik aletleri), 167 resim, Kilim Defteri.
- **Modlar:** Klasik (hiçbir şey gösterilmez; Kontrol et yanlışları gösterir) · Rahat (yanlış hemen silinir) · Üç Silgi (üç hata hakkı).
- **Günün karalaması** (Türkiye saati; pazartesi 10×10 … pazar 25×25, cumartesi kilim), **Kilim** (sonsuz), **İzle** (bilgisayar adım adım, açıklamalı çözer),
  **Kendi resmini yap** (bağlantıyla paylaş), **Yazdır** (A4, cevap anahtarı, sınıf seti), **Çocuk modu**.
- Dokun: karala → çarpı → temizle; basılı tut: çarpı; sürükle: bir satır/sütun boyunca. İki parmak: yakınlaştır, kaydır. Klavye: oklar, boşluk, X, Sil, Shift+ok.

Adresler: `#gunluk`, `#resim=vapur`, `#kilim=15.214`, `#kendi=v1.…`, `#ornek` (yarısı çözülmüş örnek), `#boyali` (bitmiş örnek), `?olc=1` (kare süresi ölçümü).

## Geliştirme

```
npm test                         # node --test: satır çözücü (kaba kuvvetle birebir), çözücü, zorluk, açıklama, kilim, resimler, kit, yerleşim
npm run bench                    # 25×25 yayılım / tekillik / derece süreleri
npm run resimler -- --temas      # resimleri doğrula, data/hesap.js + docs/rapor.md + docs/temas.html
node tools/olc.js 4              # sürükleme kare süresi (başsız Chromium, CPU ×4; Playwright ../sos'tan)
node tools/ekran.js son          # docs/karsilastirma-son.png, docs/telefon-son.png
```

`tools/atolye.html`: resim atölyesi (çiz, tekillik ve zorluğu canlı gör, sorunlu kareler, dışa aktar). `./surum.sh`: `?v=` damgası (pre-commit).

| Klasör | Ne |
|---|---|
| `kit/` | Defterde ortak kiti + tuval tarafı (`tuval`, `tarama`, `boyama`, `rakamtuval`, `nesneler`) + `kit/bulmaca/` ortak bulmaca altyapısı |
| `nonogram/` | DOM'suz motor: `model`, `linesolver`, `solver`, `difficulty`, `explain`, `kilim` |
| `ui/` | tahta (kamera, katmanlar, yapışık ipuçları), giriş, oyun, bitiş, albüm, günlük, İzle, kendi resmin, yazdır, ayarlar |
| `data/` | `defterler.js`, `resimler/*.js` (özgün piksel resimler), `hesap.js` (üretilir) |
| `docs/` | `npm run resimler -- --temas` çıktıları (`rapor.md`, `temas.html`); depoda tutulmaz |

