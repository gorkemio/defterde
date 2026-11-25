// ui/vitrin.js — FAZ 1 statik ekranı: kit eklerinin hepsi bir arada (oyun mantığı yok; Faz 4'te gerçek oyun gelir).
// Cevap KALEM: üç işaretli satır (tekrar eden harfler dahil), geçersiz kelime, düzeltici lekesi, kırmızı şeritle cevap,
// işaretli klavye.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});

  const DEMO = {
    no: 1, tarih: '20 Ekim 2026', cevap: 'KALEM',
    satirlar: [
      { kelime: 'ARMUT', sonuc: [1, 0, 1, 0, 0] },
      { kelime: 'MELEK', sonuc: [1, 0, 2, 2, 1] },
      { kelime: 'KAZAK', sonuc: [2, 2, 0, 0, 0] },
      { kelime: 'KLAEM', gecersiz: true },
      { kelime: 'KAR', sil: [2] },                    // 3. harf basıldı, düzelticiyle silindi
    ],
  };

  // Klavye işaretleri: satırlardaki en iyi durum (x < y < d)
  function tusDurumlari() {
    const ad = { 0: 'x', 1: 'y', 2: 'd' }, sira = { x: 1, y: 2, d: 3 }, m = new Map();
    for (const s of DEMO.satirlar) if (s.sonuc) Array.from(s.kelime).forEach((h, i) => {
      const d = ad[s.sonuc[i]];
      if (!m.has(h) || sira[d] > sira[m.get(h)]) m.set(h, d);
    });
    return m;
  }

  async function goster(o = {}) {
    const anlik = !!o.anlik;
    const KG = BH.kagit;
    KG.kur(document.getElementById('kagit'), { no: DEMO.no, tarih: DEMO.tarih, anlik });
    const bekle = (ms) => (anlik ? Promise.resolve() : Kit.kalem.bekle(ms));
    await bekle(1100);
    for (let r = 0; r < DEMO.satirlar.length; r++) {
      const s = DEMO.satirlar[r];
      const h = Array.from(s.kelime);
      for (let c = 0; c < h.length; c++) { KG.harfBas(r, c, h[c], { anlik }); await bekle(85); }
      if (s.sil) for (const c of s.sil) { await bekle(260); KG.harfSil(r, c, { anlik }); }
      if (s.sonuc) { await bekle(200); const m = KG.isaretle(r, s.sonuc, { anlik }); await bekle(m.sure); }
      if (s.gecersiz) { await bekle(200); KG.gecersiz(r, 'listede yok', { anlik }); await bekle(500); }
    }
    KG.altSatir(DEMO.cevap, { serit: 'kirmizi', anlik });
    await bekle(500);
    let gec = 0;
    for (const [harf, durum] of tusDurumlari()) { BH.klavye.isaretle(harf, durum, { anlik, gecikme: gec }); gec += anlik ? 0 : 60; }
    BH.sahne.duyur('Örnek sayfa: KALEM için üç tahmin işaretlendi.');
  }

  BH.vitrin = { DEMO, goster };
})();
