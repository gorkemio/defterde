// engine/rating.js — oyuncu puanı (Elo), sonuç, seçim aralığı, maç turu hedefi, kitap dağıtımı. DOM'a bakmaz.
(function () {
  'use strict';
  const BASLANGIC = 1000, K = 32, ALT = 100, UST = 3000;
  // Bant referans süreleri (s): daha hızlı çözüm 1, daha yavaş .5
  const REFERANS_S = { kolay: 20, orta: 35, zor: 60, cokzor: 75 };
  const ARALIK = [-100, 150];

  const beklenti = (R, P) => 1 / (1 + Math.pow(10, (P - R) / 400));
  function guncelle(R, P, s) {
    const yeni = R + K * (s - beklenti(R, P));
    return Math.max(ALT, Math.min(UST, Math.round(yeni)));
  }
  // ipucu 1–2: en çok .5; ipucu 3 (çözüm gösterildi) ya da pes: 0
  function sonuc(sureS, bant, o = {}) {
    if (o.pes || o.cozdu === false || (o.ipucu || 0) >= 3) return 0;
    const s = sureS <= (REFERANS_S[bant] ?? 35) ? 1 : .5;
    return (o.ipucu || 0) > 0 ? Math.min(s, .5) : s;
  }
  const aralik = (R) => [R + ARALIK[0], R + ARALIK[1]];
  // Maç turları: R − 100'den R + 150'ye doğru zorlaşır
  function turHedefi(R, i, n) { return n <= 1 ? R : Math.round(R + ARALIK[0] + (ARALIK[1] - ARALIK[0]) * i / (n - 1)); }

  // Kategori kayıtları (puana göre sıralı) → kitaplar: i. kayıt i mod N kitabına, her kitap kendi içinde puana göre.
  function kitapDagit(kayitlar, boyut = 100) {
    const N = Math.max(1, Math.ceil(kayitlar.length / boyut));
    const kitaplar = Array.from({ length: N }, () => []);
    kayitlar.forEach((x, i) => kitaplar[i % N].push(x));
    kitaplar.forEach(k => k.sort((a, b) => a.puan - b.puan));
    return kitaplar;
  }

  // Havuzdan seçim: hedef puana en yakın, dışlananlar hariç; eşitlikte tohumlu
  function sec(kayitlar, hedef, dislanan, r, pencere = [-100, 150]) {
    const uygun = kayitlar.filter(x => !dislanan.has(x.kimlik));
    if (!uygun.length) return null;
    const ic = uygun.filter(x => x.puan >= hedef + pencere[0] && x.puan <= hedef + pencere[1]);
    if (ic.length) return ic[Math.floor(r() * ic.length)];
    let en = uygun[0];
    for (const x of uygun) if (Math.abs(x.puan - hedef) < Math.abs(en.puan - hedef)) en = x;
    return en;
  }

  const Ra = { BASLANGIC, K, REFERANS_S, beklenti, guncelle, sonuc, aralik, turHedefi, kitapDagit, sec };
  if (typeof window !== 'undefined') (window.KB = window.KB || {}).rating = Ra;
  if (typeof module !== 'undefined' && module.exports) module.exports = Ra;
})();
