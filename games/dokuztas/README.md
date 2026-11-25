# Dokuz Taş (Dokurcun)

Kareli deftere kurşun kalemle, cetvelle çizilmiş tahtada, gerçek çakıl taşlarıyla oynanan Dokuz Taş.
Bilgisayara karşı (kolay · orta · zor) ya da aynı cihazda iki kişi.

- **Oynamak:** `index.html`'e çift tıkla. İnternet gerekmez (rough.js ve Kalam yerel kopya).
- **Testler:** `npm test` (kural motoru, yapay zekâ, yerleşim) · `npm run sim` (seviyeler arası kazanma oranı, ~5 sn) · `npm run bench` (düğüm/s).
- **Önizleme sunucusu (yalnız geliştirme):** `npx serve -l 8142 .` → http://127.0.0.1:8142
- **Sürüm damgası:** `./surum.sh` (commit öncesi kancada otomatik).

| Dosya | Ne |
|---|---|
| `board.js` | Tahta grafı ve kurallar (DOM yok) |
| `ai.js` | Bilgisayar: alpha-beta, iterative deepening, transposition table (DOM yok) |
| `layout.js` | Ekran yerleşimi: geniş "defter" ve dar "dikey" düzen (DOM yok) |
| `draw.js` | Başlık harfleri, yapım çizgileri, tahta, taşlar, değirmen, silgi izi, marj |
| `ui.js` | Akış: dokunma ve sürükleme, alma, geri al, ipucu, iki kişi, gösteri, ayarlar, ses |
| `config.js` | Kurallar (uçma, köşegen, çift değirmen, beraberlik), zorluk bütçeleri |
| `kit/` | Ortak defter kiti + malzeme katmanı (`kit/README.md`) |

