# Kareli Defter Adam Asmaca

Tarayıcıda çalışan, Türkçe, kareli deftere tükenmez kalemle çizilmiş gibi görünen bir Adam Asmaca. Kasvet yok: kelime öğreten, sevimli bir defter oyunu.
Vanilla HTML/CSS/JS, build yok, backend yok. `index.html` çift tıklayınca çalışır. Tek dış kütüphane rough.js 4.6.6 ve Patrick Hand yazı tipi
`assets/` altında yerel kopya olarak gelir; internet gerekmez.

Görünüm kardeş defter oyunlarıyla (Amiral Battı, SOS, Alan Kapmaca, Kâğıt Futbolu) aynı dilde: kareli kâğıt, kırmızı marj, büyük harfli başlık,
sağ üst köşede tarih, başlığın altında durum satırı, köşelerde kurşun karalamalar. Üç düzen: defter (≥ 900 px), tablet (600–899 px) ve telefon
(< 600 px; alfabe altta tam genişlikte klavye). İçindekiler, oyun ve kart sayfaları aynı boyuttadır.

> Durum: Faz 0–7 tamam (Faz 7: tasarım yenilemesi). Onay bekleyen son adım: commit.

## Nasıl oynanır

Defterin ilk sayfası **İçindekiler**: mod, kategori ve zorluk seçilir, **Başla** sayfayı çevirir. Soldaki marjda alfabe var; harfe dokun ya da klavyeden
yaz (`i` tuşu İ, `ı` tuşu I; Q, W, X yok sayılır). Doğru harf kelimeye yazılır, yanlış harf karalanır ve darağacına bir çizgi gelir.
Her ipucu ("Bir harf aç", "Anlamını göster") bir çizgiye mal olur; son çizgide kapanır. Kurtarırsan ip kopar ve adam koşarak çıkar; kaybedersen
adam kelimeyi yazan tabelayı tutar. `Esc` içindekilere döner, `Enter` ya da boşluk sonraki kelimeye geçer.

| Mod | Ne |
|---|---|
| Tek kişilik | Kategori ve zorluk seç; kolay 10, orta 7, zor 6 çizgi |
| Okul | İki kişi tek telefonda: "telefonu arkadaşına ver", gizli giriş, "telefonu geri ver". İki çetele marjda |
| Hileci Hoca | Yalnız zor. Bilgisayar kelime seçmez, adayları en kalabalık kümeye göre böler; oyun bitince itiraf eder |
| Günün kelimesi | Herkese aynı, günde bir deneme, 10 çizgi. Yenilenirse kaldığı yerden devam eder. Sonuç panoya kelimesiz kopyalanır |
| Maraton | Kelimeler gittikçe zorlaşır, ilk kayıpta biter; en iyi sonuç saklanır |

Puan: `(10 + harf sayısı − yanlış − 2·ipucu) × (1 + 0,1·seri)`. Rozetler: İlk On, Tek Atış, Uzun Kelime, Atalar Sözü, Yedi Gün.
Ses (Web Audio sentezi) sol köşedeki hoparlörle kapatılır; ayar saklanır. `prefers-reduced-motion` açıksa her şey animasyonsuz, anında belirir.

## Çalıştırma ve test

```bash
open index.html                  # çift tıklamak yeter
node --test                      # tüm testler (klasör argümanı verilmez)
node scripts/hazirla.mjs         # data/*.js üretir (geliştirme sırasında; ham/ klasörüne indirir)
node scripts/hazirla.mjs --yenile --gunluk   # ham dosyaları yeniden indir, günün kelimesi havuzunu yenile
npx serve -l 8139 .            # isteğe bağlı önizleme sunucusu, 127.0.0.1:8139
```

## Dosyalar

| Dosya | Görev | DOM'a dokunur mu |
|---|---|---|
| `tr.js` | 29 harflik alfabe, `tr-TR` büyütme/küçültme, şapka, tuş eşlemesi | hayır |
| `game.js` | oyun durumu, tahmin, ipuçları, puan, rozet, anlam maskeleme, paylaşım metni | hayır |
| `secici.js` | aday havuzu, bantlar, tekrar kontrolü, günün kelimesi, maraton eğrisi | hayır |
| `hileci.js` | Hileci Hoca'nın aday kümesi ve itirafı | hayır |
| `modlar.js` | Okul girişi doğrulama, günlük kayıt ve tekrar oynatma, maraton özeti | hayır |
| `config.js` | haklar, puan, çizim ve renk ayarları | hayır |
| `layout.js` | düzen modu (defter / tablet / telefon) ve kare boyu | hayır |
| `draw.js`, `kart.js`, `ui.js` | çizim, kart sayfası, kontrolör | evet |
| `sesler.js` | oyuna özgü sesler (ip, adım, sayfa, kıkırtı) | evet (yalnız `Kit.ses`) |
| `kit/` | kâğıt, kalem, karakter, ses (sos/kit'ten kopya) | — |
| `assets/` | yerel rough.js ve Patrick Hand, lisanslarıyla (`DEPENDENCIES.md`) | — |
| `data/` | üretilmiş sözlük, kategoriler, atasözleri, günün havuzu (2,6 MB) | — |
| `scripts/` | veri hattı, karaliste, el yazısı tanımlar, kategori/atasözü kaynakları, `rapor.md` | — |

## Veri kaynakları ve lisanslar

| Veri | Kaynak | Lisans / not |
|---|---|---|
| Kelimeler ve tanımlar | **TDK Güncel Türkçe Sözlük**, 12. baskı (99.236 madde), [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) `sozluk/v12` | Depo MIT lisanslıdır; sözlük içeriği TDK'ya aittir, depo içerik için ayrıca bir şart belirtmez. Oyunda her tanımın yanında kaynak gösterilir: "Tanımlar: TDK Güncel Türkçe Sözlük". |
| Kelime sıklığı | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) `content/2018/tr/tr_50k.txt` (OpenSubtitles 2018 Türkçe) | Depo README'sine göre **kod MIT, içerik CC BY-SA 4.0**. Listeden yalnız her kelimenin *sıra numarası* türetilir; veri dosyalarının başlığında kaynak ve lisans yazılıdır. Atıf: Hermit Dave, FrequencyWords; altyapı verisi OpenSubtitles (opus.nlpl.eu). Türev veriyi paylaşırken CC BY-SA 4.0 koşulları geçerlidir. |
| Kategori listeleri, çocuk kelime listesi, atasözleri/deyimler ve açıklamaları, el yazısı tanım düzeltmeleri | Bu proje | Halk malı atasözleri; açıklamalar ve listeler projeye aittir. |
| Yazı tipi | Patrick Hand v25 (Google Fonts), yerel kopya `assets/fonts/` | SIL Open Font License 1.1 (`assets/fonts/PatrickHand-OFL.txt`) |
| Çizim kütüphanesi | rough.js 4.6.6, yerel kopya `assets/vendor/` | MIT (`assets/vendor/rough-LICENSE`) |

Ham dosyalar (`ham/`) repoya girmez; `data/` girer (file:// altında fetch olmadan yüklensin diye).

## Veri hattı

`scripts/hazirla.mjs` → `scripts/filtre.mjs` (saf, testli süzgeç) → `data/*.js` + `scripts/rapor.md` (son çalıştırmanın istatistiği).

- **Elenenler:** özel ad, çok sözcüklü/tireli/kesmeli/noktalı madde, kısaltma ve simge, 3–14 harf dışı, 29 harf dışı, argo/kaba/hakaret, tanımsız kelime.
  Sayılar betik çalıştırıldığında `scripts/rapor.md` dosyasına yazılır.
- **Elle tutulan listeler** (`scripts/`): `karaliste.txt` (çıkar; `kök*` önek de yazılır), `izinli.txt` (ikincil anlamı kaba olan masum kelimeler),
  `tanim-duzelt.txt` (TDK'nın ilk anlamı çocuğa yanlış ya da anlaşılmaz olan kelimeler; `Kategori/kelime` biçimi yalnız o kategoride geçerli),
  `kaynak/cocuk.mjs` (kolay banda girecek çocuk kelimeleri), `kaynak/kategoriler.mjs`, `kaynak/atasozleri.mjs`.
- **Günün kelimesi havuzu** (`data/gunluk.js`) dondurulmuştur: sözlük yenilense de değişmez; yalnız `--gunluk` ile yenilenir.

## Türkçe harf işleme

`tr.js`: büyütme/küçültme yalnız `tr-TR` yereliyle (`i → İ`, `ı → I`); `test/tr.test.js` kaynakları tarayıp yerelsiz çevirme kullanılmadığını denetler.
Şapkalı harfler normalize edilir (kâğıt → KAĞIT). Atasözünde boşluk görünür bir boşluktur, tahmin edilmez.

## Bilinen sınırlar

- Zor banttaki ~28 bin kelimenin tanımları tek tek gözden geçirilmedi (kolay band, kategoriler ve günün havuzu geçirildi).
- Safari, gerçek telefon dokunması, gerçek panoya kopyalama ve sesin kulakla dinlenmesi bu geliştirme ortamında denenemedi.
- Telefonda alfabe altta 8 sütunluk klavye: hücre 390 px genişlikte 41 × 41 px, 320 px'te 34 × 34 px. Gerçek telefonda denenmedi.
- Tanımlar veri hattında 120 harfte kesilir; uzun tanımlar sonuç alanında "…" ile biter.
