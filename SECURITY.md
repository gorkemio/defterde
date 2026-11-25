# Güvenlik politikası

Defterde'de bir güvenlik açığı bulduysan lütfen **herkese açık issue açma**.

## Nasıl bildirilir

GitHub'ın özel bildirim kanalını kullan: depodaki **Security** sekmesinden **Report a vulnerability** düğmesine bas. Bildirim yalnız depo sahibine görünür.

Bildirimde şunlar yardımcı olur:

- Etkilenen adres veya dosya (ör. `src/server/auth.ts`, `/oyunlar/<oyun>/`)
- Açığı yeniden üretme adımları
- Olası etki (ör. yönetim oturumunu ele geçirme, başka origin'e yönlendirme)

İlk yanıt için hedef bir haftadır. Düzeltme yayımlandıktan sonra, istersen bildirimin için teşekkür notu eklenir.

## Kapsam

- Platform: `src/`, `deploy/`, `scripts/` ve canlı site [defterde.com](https://defterde.com)
- Oyunlar: `games/` altındaki kod (ör. XSS, depolama kötüye kullanımı)

Kapsam dışı: hizmet engelleme (DoS) denemeleri, otomatik tarayıcı çıktıları, sosyal mühendislik ve üçüncü taraf hizmetlerdeki (GitHub, Google Fonts, jsDelivr) açıklar. Canlı sitede test yaparken başkalarının deneyimini bozacak yük oluşturma.

## Tasarım notları

Güven sınırları, oturum ve CSRF modeli [docs/MIMARI.md](docs/MIMARI.md) içinde anlatılır.
