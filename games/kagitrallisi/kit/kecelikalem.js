// kit/kecelikalem.js — "keçeli kalem" malzemesi. Hangi oyun olduğunu bilmez.
// Kalın, uçları yuvarlak, tek geçişte çizilen çizgi; mürekkep kağıda hafifçe yayılır: aynı yol, %12 opaklıkla,
// ~2 px daha kalın ikinci kez altına çizilir (kalemle birlikte belirir). Renkler: siyah, mavi, kırmızı, yeşil, turuncu.
// Kurşun kalemle çizilecek şeyler (notlar, taslak, çim) çağrıda { yayilma: false } ve kendi rengini verir.
// Başlıklar Caveat Brush (metinSvg { sinif: 'baslik' } ya da .baslik sınıfı), küçük metinler Patrick Hand.
// Silgi yok (keçeli silinmez). Sesler: keçeli gıcırtısı (uzunluğa göre), nokta tıkırtısı, kağıt buruşması, kağıt bayrak.
// Yükleme: kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/kecelikalem.js; CSS: kit/kecelikalem.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik } = KL;

  const RENK = {
    siyah: '#1c1c1c', mavi: '#1d5bd6', kirmizi: '#d6362b', yesil: '#1e9e5a', turuncu: '#f08a1e',
    kursun: '#7a7a7a', cim: '#4e9a5c', kagit: '#fbf9f2',
  };

  /* ---------- kalem izi ---------- */

  // Keçeli tek geçişte çizer (çağıran açıkça istemedikçe); titreme tohumla biraz değişir.
  function secenek(s, anahtar, ek) {
    const r = rastgele('keceli', ...anahtar);
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = true;
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.roughness === undefined) s.roughness = Math.max(.2, s.roughness + aralik(r, -.1, .1));
    return s;
  }

  // Yayılma: her dolgusuz kalem izinin altına aynı yol, +1.6 birim kalın, %12 opak. Kalem animasyonunu da kopyalar.
  function bitir(g, anahtar, o) {
    if (o.yayilma === false) return;
    for (const p of Array.from(g.querySelectorAll('path'))) {
      if (p.classList.contains('yayilma')) continue;
      const dolgu = p.getAttribute('fill'), renk = p.getAttribute('stroke');
      if ((dolgu && dolgu !== 'none') || !renk || renk === 'none') continue;
      const k = p.cloneNode(false);
      k.setAttribute('class', 'yayilma');
      k.setAttribute('stroke-width', ((parseFloat(p.getAttribute('stroke-width')) || 2) + 1.6).toFixed(2));
      k.setAttribute('stroke-opacity', '.12');
      k.setAttribute('pointer-events', 'none');
      p.parentNode.insertBefore(k, p);
      if (typeof p.getAnimations === 'function') {
        for (const a of p.getAnimations()) {
          try {
            const b = k.animate(a.effect.getKeyframes(), a.effect.getTiming());
            b.finished.then(() => b.cancel(), () => {});
          } catch (e) { /* eski tarayıcı: yayılma hemen görünür */ }
        }
      }
    }
  }

  /* ---------- sesler (Kit.ses.nota / parazit ile) ---------- */

  const S = () => Kit.ses;

  // Keçeli gıcırtısı: dar bantlı, frekansı dalgalanan gürültü + çok hafif ıslık. uzunluk: hücre cinsinden.
  function keceli(c, h, t0, uzunluk) {
    const L = Math.max(0, Math.min(12, Number(uzunluk) || 2));
    const sure = Math.min(.38, .09 + .026 * L);
    const f = 1200 + Math.random() * 600;
    S().parazit(c, h, t0, 'bandpass', f, f * (1.4 + Math.random() * .6), 6, sure, .26);
    S().parazit(c, h, t0 + sure * .3, 'bandpass', f * 1.7, f * 1.2, 8, sure * .7, .12);
    S().nota(c, h, t0, 'sine', f * 2.1, f * 2.4, Math.min(.12, sure), .015);
  }
  // Nokta koyma: kısa, boğuk tık
  function nokta(c, h, t0) {
    S().parazit(c, h, t0, 'highpass', 2400, 1800, .8, .025, .22);
    S().nota(c, h, t0, 'triangle', 900, 520, .03, .12);
  }
  // Kağıt buruşması: rastgele aralıklı kısa çatırtılar
  function burusma(c, h, t0) {
    const n = 6 + Math.floor(Math.random() * 4);
    let t = t0;
    for (let i = 0; i < n; i++) {
      const f = 1000 + Math.random() * 3000;
      S().parazit(c, h, t, 'bandpass', f, f * .7, 1.2, .03 + Math.random() * .04, .28 - i * .02);
      t += .025 + Math.random() * .06;
    }
  }
  // Kağıt bayrak çırpınması: dört yumuşak "pat"
  function bayrak(c, h, t0) {
    for (let i = 0; i < 4; i++) S().parazit(c, h, t0 + i * .11, 'lowpass', 600, 260, .7, .09, .34 - i * .05);
  }

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('kecelikalem', {
    cizim: { roughness: .9, bowing: .6, strokeWidth: 2.6, fillWeight: 1.2, sureMs: [150, 250], animasyon: true },
    renk: Object.assign({ ana: RENK.siyah, vurgu: RENK.kirmizi }, RENK),
    yazi: { aile: 'Patrick Hand', baslik: 'Caveat Brush', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, bitir },
    silgiIzi: null,
    ses: { keceli, nokta, burusma, bayrak, kalem: keceli },
    sesSeviye: .4,
    karakter: false,
  });
  Kit.kecelikalem = { RENK };
})();
