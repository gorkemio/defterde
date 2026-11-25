// Ayarlar tek yerde. Tarayıcıda window.AA.config olur; node'da require edilebilir.
(function () {
  'use strict';

  const config = {
    hak: { kolay: 10, orta: 7, zor: 6 },          // çizgi hakkı; hazır çizili parça sayısı = 10 − hak (0 · 3 · 4)
    gunlukHak: 10,                                 // günün kelimesi herkese aynı: 10 çizgi
    gunlukBaslangic: '2026-10-18',                 // "Adam Asmaca #1" günü (yerel tarih, yyyy-mm-dd)
    gecmisUzunlugu: 200,                           // aynı kelime tekrarı için hatırlanan son kelime sayısı
    maraton: { kolayBitis: 5, ortaBitis: 12 },     // 1–5. kelime kolay, 6–12. orta, 13+ zor
    aday: { enAz: 15 },                            // bir bantta 15'ten az aday varsa komşu bant eklenir
    okul: { oyuncular: ['mavi', 'kırmızı'], enCokSozcuk: 3 },
    hileci: { enAzAday: 20 },                      // Hoca uzunluğu seçerken en az bu kadar adayı olan uzunlukları tercih eder                            // bir bantta 15'ten az aday varsa komşu bant eklenir
    puan: { taban: 10, ipucuMaliyeti: 2, seriAdim: 0.1, seriTavan: 10 },
    kategoriler: ['Genel', 'Hayvanlar', 'Meyve-Sebze', 'Şehirler', 'Ülkeler', 'Meslekler', 'Okul', 'Mutfak', 'Spor', 'Doğa', 'Vücut', 'Atasözleri'],
    cizim: {
      roughness: 1.2,
      bowing: 1,
      strokeWidth: 1.7,
      fillWeight: 0.8,
      sureMs: [200, 320],                          // darağacı parçası çizim süresi (kardeş oyunlarla aynı tempo)
      animasyon: true,
    },
    renk: {
      mavi: '#1f3b9b',                             // oyuncunun tükenmezi: doğru harf, darağacı, adam
      kirmizi: '#c62828',                          // yanlış harf karalaması, Hoca
      kursun: '#555555',                           // notlar ve süsler (kit/kagit.css --kursun ile aynı)
    },
  };

  if (typeof window !== 'undefined') (window.AA = window.AA || {}).config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})();
