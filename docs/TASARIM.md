# Tasarım sözleşmesi

Defterde'nin görsel otoritesi oyunların kendisidir: kareli defter kâğıdı, mürekkep ve kurşun kalem. Platform sayfaları bu malzemeyi taklit eder, oyunların önüne geçmez.

## Malzeme

| Öğe                         | Değer                  |
| --------------------------- | ---------------------- |
| Masa                        | `#b6a58a`              |
| Kâğıt                       | `#fbf9f2`              |
| Mavi mürekkep (`--mavi`)    | `#1f3b9b`              |
| Kırmızı kalem (`--kirmizi`) | `#c62828`              |
| Kurşun kalem (`--kursun`)   | `#555555`              |
| Kareler                     | `rgba(86,140,214,.32)` |
| Marj çizgisi                | `rgba(214,64,64,.6)`   |

- Ana kâğıt yüzeyi 1040 px (ana sayfadaki oyun rehberinde 1240 px). Kâğıt dokusu olarak `gren.png` döşenir.
- Arkada iki ince yaprak vardır (`#efebdf` ve `#f7f4eb`). Masaüstünde 2/4 px sağa, 3/6 px aşağı kayarlar; mobilde 1/2 px ve 1.5/3 px. Tek dış gölge en arkadaki yaprakta: `16px 28px 40px -6px rgba(58,36,16,.44)`. Ön yüzde yalnız `inset 0 1px 2px rgba(255,255,255,.85)` bulunur.
- Spiral cilt, kalın kâğıt yığını, kart ızgarası ve cam efektleri kullanılmaz. Dekorlar `pointer-events: none` taşır ve baskıda gizlenir.
- Platform yazı tipi yerel Patrick Hand'dir (OFL). Çizimler build sırasında sabit tohumlu Rough.js ile üretilen SVG'lerdir; metin her zaman HTML'dir.

## Ana sayfa: oyun rehberi

Kısa giriş → arama, tür ve oyuncu sayısı süzgeçleri → oyun listesi → alt bilgi.

- Süzgeç bir `GET` formudur; JavaScript kapalıyken de çalışır. `src/client/discovery.ts` yalnız anlık süzme ve "Bana bir oyun seç" düğmesini ekler.
- Her oyun tek bir bağlantıdır; oyun modu `config/games.json` içindeki gerçek manifestten gelir.
- Oyun listesi `src/components/GameList.astro` bileşenidir; yönetimdeki taslak önizlemesi de aynı bileşeni kullanır.
- Sağ üst köşede GitHub logolu kaynak kodu bağlantısı durur: yalnız ikon, 44×44 px dokunma alanı, mavi mürekkep, hover'da kırmızı. Ekran okuyucu etiketi "Kaynak kodu GitHub'da". Mobilde markanın sağında kalır, baskıda gizlenir. Adres `PUBLIC_REPO_URL` ile değiştirilebilir.

## Oyunlardan dönüş

Her oyunda kâğıdın üst kenarına hizalı sessiz bir `← İçindekiler` notu bulunur: kutusuz, arka plansız, 18 px Patrick Hand, koyu kurşun kalem rengi. Hover'da mavi ve altı çizili, klavye odağında kesikli çizgi. Dokunma yüksekliği en az 44 px, üstte 48 px yerleşim payı ayrılır. HTML bağlantısıdır; baskı ve tam ekranda gizlenir.

## Oyunlara özgü malzemeler

Oyunların kendi kalemleri ve yazı tipleri yalnız o oyunun içinde kalır; platform başlıklarına taşınmaz. Örnekler: 5'li XOX dolma kalem ve Marck Script, Nokta Oyunu noktalı sayfa ve kuru boya dolguları, Sayı Bulma çizgili sayfa ve üst yırtık kenar, Dokuz Taş Kalam. Amiral Battı çift sayfalıdır: arka yaprak yerine özgün orta cildi kullanır.

## Erişilebilirlik ve performans

- Kontroller en az 44 px, klavye odağı görünür (`2px dashed var(--kirmizi)`), azaltılmış hareket ve yakınlaştırma korunur, otomatik ses yoktur.
- İlk oyun bağlantısı 360×800 ekranda görünür.
- Ana sayfa oyun dosyası indirmez veya önceden yüklemez. Bütçe: JS ≤ 50 KB gzip, ilk görünüm ≤ 300 KB sıkıştırılmış, mobil LCP ≤ 2,5 s, CLS ≤ 0,1. Oyunlar bu bütçeye göre değiştirilmez.
