// config.js — Labirent ayarları tek yerde (tarayıcıda LB.config, Node'da require). DOM'a dokunmaz.
(function () {
  'use strict';
  const C = {
    anahtar: 'lb',                        // localStorage öneki: lb-ayar, lb-bolum, lb-eniyi-<kod> …
    dprTavan: 2,
    minHucrePx: 18,                       // telefonda varsayılan yakınlıkta koridor en az bu kadar
    yolOrani: .45,                        // yol kalınlığı / koridor genişliği
    renkler: ['turkuaz', 'pembe', 'altin', 'yesil', 'mor'],
    varsayilanRenk: 'turkuaz',
    // Boylar (dikey telefon için H > W). Daire: halka sayısı; altıgen: yarıçap.
    boy: {
      K: { ad: 'Küçük', dik: [8, 11], daire: 5, altigen: 5 },
      O: { ad: 'Orta', dik: [14, 20], daire: 9, altigen: 9 },
      B: { ad: 'Büyük', dik: [22, 32], daire: 14, altigen: 15 },
      V: { ad: 'Dev', dik: [40, 60], daire: 22, altigen: 27 },
    },
    tur: { D: 'Dikdörtgen', H: 'Daire', A: 'Altıgen', T: 'Dokuma' },
    alg: { G: 'geri izleme', P: 'Prim', W: 'Wilson', K: 'karışım' },
    karisim: .5,                          // büyüyen ağaç: en yeni hücreyi seçme olasılığı (1 = geri izleme, 0 = Prim'e yakın)
    cikisPayi: .2,                        // çıkış: girişe en uzak dış hücrelerin ilk %20'si
    // Bilgisayar hayaleti: hız (hücre/s), bakış derinliği (hücre), kavşakta duraksama (s), karar gürültüsü (σ)
    hayalet: {
      kolay: { hiz: 3, bakis: 1, dur: .6, gurultu: .9 },
      orta: { hiz: 5, bakis: 3, dur: .35, gurultu: .6 },
      zor: { hiz: 7, bakis: 6, dur: .2, gurultu: .4 },
    },
    geriHiz: 1.3,                         // hayalet çıkmazdan dönerken bu kat hızlı
    parOrnek: 50,                         // par: Orta hayaletin bu kadar gürültü örneğinin ortalaması
    // Bölümler: her türün defterinde 20 seviye. Boy seviyeye göre; algoritma sırayla döner (Prim → karışım → geri izleme).
    // Hedef zorluk her boy diliminde o boyun zorluk dağılımının %10'luk diliminden %90'lık dilimine doğrusal çıkar.
    bolum: {
      defterler: ['D', 'H', 'A', 'T'],
      seviye: 20,
      boy: (s) => (s <= 5 ? 'K' : s <= 12 ? 'O' : 'B'),
      alg: (s) => ['P', 'K', 'G'][(s - 1) % 3],
      aday: 400,                          // seviye başına denenen tohum
      parAday: 8,                         // hedefe en yakın bu kadar adayın par'ı hesaplanır
      dilim: [.1, .9],
    },
    // Sonsuz: 12 sütun, satırlar 30 önden üretilir; silgi 0.6 satır/s ile başlar, her 10 sn'de %8 hızlanır
    sonsuz: { W: 12, H: 1500, onden: 30, bant: 8, silgiHiz: .6, hizlanma: 1.08, hizlanmaSn: 10, silgiBas: -3, ucOrani: .4 },
    // Zorluk puanı ağırlıkları (tek tablo; sec.mjs ve arayüz de bunu okur)
    agirlik: { uzunluk: 1, karar: 4, cikmazOrt: 2, cikmazSayi: .3, donus: .5 },
    modlar: [['gunun', 'Günün'], ['bolum', 'Bölümler'], ['serbest', 'Serbest'], ['sonsuz', 'Sonsuz']],
    komutlar: [['yeni', 'Yeni labirent'], ['bastan', 'Baştan'], ['ipucu', 'İpucu'], ['cozum', 'Çözümü göster'],
      ['hayalet', 'Hayalet'], ['yazdir', 'Yazdır'], ['ayarlar', 'Ayarlar']],
  };
  // Silginin t saniyede aldığı yol (satır): hız v(t) = v0 · k^(t / T); yol = ∫ v = v0 · T / ln k · (k^(t / T) − 1)
  C.silgiYol = (t, s = C.sonsuz) => s.silgiBas + s.silgiHiz * s.hizlanmaSn / Math.log(s.hizlanma) * (Math.pow(s.hizlanma, t / s.hizlanmaSn) - 1);
  C.silgiHizi = (t, s = C.sonsuz) => s.silgiHiz * Math.pow(s.hizlanma, t / s.hizlanmaSn);
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).config = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})();
