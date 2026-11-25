# Beş Harf

Her gün herkese aynı, beş harfli bir Türkçe kelime; altı tahmin hakkı. Harfleri daktilo basar; kutular ve işaretler mor
kopya kalemiyle çizilir: doğru yerdeki harfin kutusu taranır, kelimede olup başka yerde duran harf çember içine alınır,
kelimede olmayan harfin üstü çizilir. Defterde ailesinin bir oyunu: daktilo kâğıdı deftere iki zımbayla tutturulmuş.

Vanilla HTML/CSS/JS; build yok, backend yok. `index.html` çift tıklayınca çalışır (klasik `<script>`, tek ad alanı `window.BH`;
ortak kit `window.Kit`). Tek dış kütüphane rough.js, `assets/vendor/`'da yerel kopya. Bütün yollar göreli.

Durum ve plan: `PLAN.md` (fazlar, kararlar, uygulama notları). MVP (Faz 1–6) tamam, 21 Ekim 2026.

## Oyun

- **Günün kelimesi** (açılış): herkese aynı kelime, Türkiye saatiyle 00:00'da değişir (No. 1 = 20 Ekim 2026). Sayfa
  yenilenince kaldığı yerden sürer; istatistik ve seri yalnız burada tutulur.
- **Serbest** komutu: rastgele kelime (son 500 cevap dışında), **arkadaşına kelime gönder** (`#k=…` linki; açan o kelimeyi
  oynar), **iki kişi aynı cihaz** (biri gizlice yazar, öbürü bulur; "telefonu arkadaşına ver" notları).
- **Düello**: bilgisayarla aynı kelime; sen bir satır, o bir satır; onun kâğıdında yalnız işaretler. 3 ya da 5 kelime,
  Kolay / Orta / Zor.
- **Analiz** (oyun sonunda): kalan aday sayıları, bilgisayarın her adımdaki önerisi, beceri ve şans.
- **Ayarlar**: klavye düzeni (Q, F, Alfabe), zor mod, tuş sesi ve diğer sesler ayrı, renkli paylaşım, azaltılmış hareket,
  düello seviyesi. **Ses** sözcüğü ana anahtardır (kapalıyken üstü çizili).
- Fiziksel klavye: Türkçe ve İngilizce düzende harfler, Enter, Backspace (`i` → İ, `I`/`ı` → I; Q, W, X yok sayılır).
- Kayıt: localStorage `bh-ayar`, `bh-istatistik`, `bh-gun`, `bh-gecmis`, `bh-duello`, `bh-sessiz`, `bh-ogretici`.

## Çalıştırma

- Oyun: `index.html`'i tarayıcıda aç ya da önizleme sunucusu: `npx serve -l 8146 .` → http://127.0.0.1:8146
- Testler: `npm test` (`node --test`, `test/*.test.js` ve `test/*.test.mjs`)
- Çözücü ölçümleri: `node scripts/olc.mjs` (Zor ortalaması, tutarlılık, hız); ilk tahmin tablosu: `node scripts/oneriler.mjs`
- Ekran görüntüleri (Playwright yerelde kuruluysa):
  `PLAYWRIGHT_PATH=../defterde/node_modules/playwright node scripts/ekran.cjs son` (ya da `faz1`: kit vitrini) → `docs/`
- Kit vitrini: `index.html#vitrin`
- Sürüm damgası: `./surum.sh` (git pre-commit kancası da çalıştırır)

## Dosyalar

| Yer | Ne |
|---|---|
| `kit/` | Defterde ortak kiti (kibrit'ten, 20 Ekim 2026) + beş ekleme: `tr.js`, `daktilo.*`, `kopyakalemi.*`, `daktilokagidi.*`, `daktilotusu.*` |
| `config.js` | `BH.config` sabitleri (yayın günü, hak, havuz, düello) |
| `ui/` | `sahne.js` ölçü, `kagit.js` daktilo kâğıdı, `klavye.js` tuşlar, `akis.js` oyun akışı, `sonuc.js` oyun sonu/fiş/paylaşım, `modlar.js`, `duello.js`, `analiz.js`, `ayarlar.js`, `not.js` fişler, `depo.js` kayıt, `vitrin.js`, `ana.js` |
| `engine/` | `game.js` kurallar, `solver.js` çözücü, `daily.js` günlük eşleme; DOM'a dokunmaz |
| `audio/` | `sesler.js`: Web Audio sentezleri ve iki ses anahtarı |
| `data/` | üretilmiş listeler: cevaplar (kodlu, günlük sırada), tahminler (sıklık sırası), anlamlar, öneriler (açılış tablosu) |
| `scripts/` | `kelimeler.mjs` kelime hattı (`suzgec.mjs`, `ekler.mjs`), `dene.mjs`, `oneriler.mjs`, `olc.mjs`, `ekran.cjs` |
| `docs/` | karşılaştırma sayfası ve faz ekran görüntüleri |

## Bağımlılıklar ve lisanslar

`assets/DEPENDENCIES.md`: rough.js 4.6.6 (MIT), Courier Prime (SIL OFL 1.1), Patrick Hand (SIL OFL 1.1).
## Veri kaynakları ve lisanslar

- **TDK Güncel Türkçe Sözlük, 12. baskı** — [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) deposundan
  (`v12.gts.json.tar.gz`). Depo MIT lisanslıdır; sözlük içeriği TDK'ya aittir. Oyun, cevabın ilk uygun anlamını (en çok 120
  karakter) gösterir ve ekranda kaynak notu yazar: "Tanımlar: TDK Güncel Türkçe Sözlük".
- **Sıklık listesi** — [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) `content/2018/tr/tr_50k.txt`
  (OpenSubtitles 2018). README'deki lisans: "MIT License for code", "CC-by-sa-4.0 for content" (okundu, 20 Ekim 2026).
  Oyuna kelimenin kendisi değil yalnız sıra numarası türetilir (cevap süzgeci ve tahmin listesinin sırası); atıf: Hermit Dave
  ve OpenSubtitles. Türetilmiş veri paylaşılırsa CC BY-SA 4.0 koşulları geçerlidir.
- Ham dosyalar `ham/` altında (git dışı); yoksa `node scripts/kelimeler.mjs` önce `../adamasmaca/ham`'dan kopyalar, o da
  yoksa indirir (`--yenile` her zaman indirir).

## Kelime hattı

`node scripts/kelimeler.mjs` → `data/cevaplar.js`, `data/tahminler.js`, `data/anlamlar.js`, `scripts/sira.txt`,
`scripts/rapor.md`, `scripts/inceleme.md` (betik çıktıları; depoda tutulmaz). Süzgeçler `scripts/suzgec.mjs`'te, ek tablosu tek yerde `scripts/ekler.mjs`'te.
Elle tutulan listeler: `yasakli-cevap.txt` (konu süzgeci), `yasakli-tahmin.txt`, `elle-ekle.txt` ve `elle-cikar.txt`
([cevap] / [tahmin] bölümleri), `izinli.txt`. Kelime denemek: `node scripts/dene.mjs kalem geldi burda …`.
Günlük sıra **dondurulmuştur**: liste değişince geçmiş günlerin cevabı kaymaz.
