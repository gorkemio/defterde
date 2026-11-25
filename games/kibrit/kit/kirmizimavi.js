// kit/kirmizimavi.js — "kırmızı-mavi kurşun kalem" malzemesi. Hangi oyun olduğunu bilmez.
// Okulun iki uçlu kalemi: bir ucu mavi (#2b4a9f), öbürü kırmızı (#c0392b). Renkli kurşun: tek geçiş (çift çizgi yok),
// biraz kalın, yumuşak; mürekkep değil grafit olduğu için izin opaklığı ~.85 ve çizgi boyunca hafifçe değişir (baskı).
// Kâğıdın dişi kalemi yer yer tutmaz: doku(svg) bir dizi açık benek maskesi kurar, kalem izleri o maskeyle çizilir.
// Kurşun grisi (#8a8783) silik notlar, otomatik işaretler ve karalamalar içindir. Karakter yok, silgi yok.
// Yükleme: kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/kirmizimavi.js; CSS: kit/kirmizimavi.css
// Çağrı bayrakları: { baski: false } baskıyı kapatır · { yumusak: false } kalemin yumuşak kenarını kapatır.
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl } = KL;

  const RENK = { mavi: '#2b4a9f', kirmizi: '#c0392b', kursun: '#8a8783', kagit: '#fbf8f0' };

  /* ---------- kalem izi ---------- */

  // Renkli kurşun tek geçişte çizer (çağıran açıkça istemedikçe); titreme tohumla biraz değişir.
  function secenek(s, anahtar, ek) {
    const r = rastgele('kirmizimavi', ...anahtar);
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = true;
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.roughness === undefined) s.roughness = Math.max(.2, s.roughness + aralik(r, -.1, .1));
    return s;
  }

  let gradyanNo = 0;
  function tanimlar(svg) {
    let d = svg.querySelector(':scope > defs.kirmizimavi');
    if (!d) { d = svgEl('defs', { class: 'kirmizimavi' }); svg.insertBefore(d, svg.firstChild); }
    return d;
  }

  // Kalem animasyonlarını (cizdir'in dash animasyonu) eş izine de kopyala: yumuşak kenar kalemle birlikte belirsin.
  function animasyonKopyala(p, k) {
    if (typeof p.getAnimations !== 'function') return;
    for (const a of p.getAnimations()) {
      try {
        const b = k.animate(a.effect.getKeyframes(), a.effect.getTiming());
        b.finished.then(() => b.cancel(), () => {});
      } catch (e) { /* eski tarayıcı: hemen görünür */ }
    }
  }

  // Baskı: her ize tohumlu opaklık (.79–.91); 80 birimden uzun izlerde opaklık çizgi boyunca değişir (gradyan).
  // Yumuşak kenar: izin altına aynı yol, +1.4 birim kalın, %9 opak (renkli kurşunun dağılan kenarı).
  function bitir(g, anahtar, o) {
    const r = rastgele('baski', ...anahtar);
    const svg = g.ownerSVGElement;
    for (const p of Array.from(g.querySelectorAll('path'))) {
      if (p.classList.contains('yumusak')) continue;
      const dolgu = p.getAttribute('fill'), renk = p.getAttribute('stroke');
      if ((dolgu && dolgu !== 'none') || !renk || renk === 'none') continue;
      if (o.yumusak !== false) {
        const k = p.cloneNode(false);
        k.setAttribute('class', 'yumusak');
        k.setAttribute('stroke-width', ((parseFloat(p.getAttribute('stroke-width')) || 2) + 1.4).toFixed(2));
        k.setAttribute('stroke-opacity', '.09');
        k.setAttribute('pointer-events', 'none');
        p.parentNode.insertBefore(k, p);
        animasyonKopyala(p, k);
      }
      if (o.baski === false) continue;
      let L = 0;
      try { L = p.getTotalLength(); } catch (e) { /* görünmeyen svg */ }
      if (L > 80 && svg) {
        const a = p.getPointAtLength(0), b = p.getPointAtLength(L);
        const id = 'km' + (++gradyanNo);
        const gr = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, tanimlar(svg));
        [0, aralik(r, .3, .7), 1].forEach((ofs, i) => svgEl('stop', {
          offset: ofs.toFixed(2), 'stop-color': renk,
          'stop-opacity': (i === 1 ? aralik(r, .86, .94) : aralik(r, .76, .86)).toFixed(2),
        }, gr));
        p.setAttribute('stroke', `url(#${id})`);
      } else {
        p.setAttribute('stroke-opacity', aralik(r, .79, .91).toFixed(2));
      }
    }
  }

  /* ---------- kâğıt dişi: kalem izini benek benek açan maske ---------- */

  // Bir kez üretilen 128×128 gürültü (tuval → PNG adresi): çoğu beyaz; %40 kadarı gri benek (kalem orayı az tutmuş).
  let dokuAdresi = null;
  function dokuResmi() {
    if (dokuAdresi !== null) return dokuAdresi;
    dokuAdresi = '';
    try {
      const N = 128, c = document.createElement('canvas');
      c.width = c.height = N;
      const x = c.getContext('2d'), im = x.createImageData(N, N), r = rastgele('dis');
      const kaba = new Float32Array((N / 2) * (N / 2)).map(() => r());
      for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) {
        const k = kaba[(y >> 1) * (N / 2) + (i >> 1)], ince = r();
        const dis = k > .6 ? (k - .6) * 2.1 : 0;             // kaba benek: dişin tepesi, kalem değmemiş
        const v = 255 - Math.round(Math.min(1, dis + (ince > .86 ? .32 : 0)) * 175);
        const j = (y * N + i) * 4;
        im.data[j] = im.data[j + 1] = im.data[j + 2] = v; im.data[j + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      dokuAdresi = c.toDataURL('image/png');
    } catch (e) { dokuAdresi = ''; }
    return dokuAdresi;
  }

  // svg'ye maske tanımı kurar, maskenin adresini döndürür ('url(#...)'). Kalem katmanına mask="..." olarak verilir.
  // Tuval yoksa (eski tarayıcı) null: izler maskesiz çizilir.
  function doku(svg) {
    const adres = dokuResmi();
    if (!adres) return null;
    const d = tanimlar(svg);
    let m = d.querySelector('mask.dis');
    if (!m) {
      const id = 'dis' + (++gradyanNo);
      const p = svgEl('pattern', { id: id + 'd', patternUnits: 'userSpaceOnUse', width: 128, height: 128 }, d);
      svgEl('image', { href: adres, width: 128, height: 128 }, p);
      m = svgEl('mask', { id, class: 'dis', maskUnits: 'userSpaceOnUse', x: -50, y: -50, width: '200%', height: '200%' }, d);
      svgEl('rect', { x: -50, y: -50, width: '200%', height: '200%', fill: `url(#${id}d)` }, m);
    }
    return `url(#${m.id})`;
  }

  /* ---------- sesler: Web Audio sentezi (dosya yok). Melodi yok; kısık. ---------- */

  const S = () => Kit.ses;
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;

  // Tanecikli sürtünme: gürültü genliği küçük adımlarla oynar (kâğıt dişi)
  function surtunme(c, h, t0, o) {
    const sure = o.sure, s = c.createBufferSource();
    const uz = Math.ceil(c.sampleRate * (sure + .05)), b = c.createBuffer(1, uz, c.sampleRate), v = b.getChannelData(0);
    let g = .6;
    const adim = Math.max(1, Math.floor(c.sampleRate * (o.tanecik || .005)));
    for (let i = 0; i < uz; i++) {
      if (i % adim === 0) g = .35 + Math.random() * .65;
      v[i] = (Math.random() * 2 - 1) * g;
    }
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = o.tip; f.Q.value = o.q;
    f.frequency.setValueAtTime(o.f0, t0);
    f.frequency.linearRampToValueAtTime(o.f1, t0 + sure);
    const z = c.createGain();
    z.gain.setValueAtTime(0.0001, t0);
    z.gain.linearRampToValueAtTime(o.tepe, t0 + Math.min(.02, sure * .25));
    z.gain.setValueAtTime(o.tepe * .85, t0 + sure * .7);
    z.gain.exponentialRampToValueAtTime(0.0001, t0 + sure);
    s.connect(f); f.connect(z); z.connect(h);
    s.start(t0); s.stop(t0 + sure + .05);
  }

  const SESLER = {
    // Rakam yazma: kısa, yumuşak grafit sürtmesi. arg: süre (ms)
    rakam(c, h, t0, arg) {
      const sure = Math.max(.07, Math.min(.2, (arg || 90) / 1000));
      surtunme(c, h, t0, { sure, tip: 'bandpass', f0: 1900 * sapma(.12), f1: 1500, q: .8, tepe: .13, tanecik: .004 });
    },
    // Kalemi çevirme: parmak arasında kalemin hafif tıkı
    cevir(c, h, t0) {
      S().parazit(c, h, t0, 'bandpass', 2600 * sapma(.1), 1900, 1.6, .02, .16);
      S().nota(c, h, t0, 'sine', 820 * sapma(.05), 700, .03, .05);
    },
    // Sayfa yırtma: uzayan tanecikli yırtılma + birkaç lif çatırtısı
    yirt(c, h, t0) {
      surtunme(c, h, t0, { sure: .38, tip: 'bandpass', f0: 700, f1: 3400, q: .7, tepe: .22, tanecik: .011 });
      surtunme(c, h, t0 + .04, { sure: .3, tip: 'highpass', f0: 2500, f1: 5200, q: .5, tepe: .07, tanecik: .004 });
      for (let i = 0; i < 4; i++) {
        const t = t0 + .05 + i * (.07 + Math.random() * .03), f = 1800 + Math.random() * 2400;
        S().parazit(c, h, t, 'bandpass', f, f * .7, 1.4, .02 + Math.random() * .02, .14);
      }
    },
    // Tik çizme: kısa, hızlı kalem süpürmesi
    tik(c, h, t0) {
      surtunme(c, h, t0, { sure: .06, tip: 'bandpass', f0: 1500, f1: 2100, q: .9, tepe: .12, tanecik: .004 });
      surtunme(c, h, t0 + .07, { sure: .1, tip: 'bandpass', f0: 2100, f1: 2900, q: .9, tepe: .14, tanecik: .003 });
    },
  };

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('kirmizimavi', {
    cizim: { roughness: .9, bowing: .8, strokeWidth: 2.4, fillWeight: 1, sureMs: [150, 200], animasyon: true },
    renk: { ana: RENK.mavi, vurgu: RENK.kirmizi, mavi: RENK.mavi, kirmizi: RENK.kirmizi, kursun: RENK.kursun, kagit: RENK.kagit },
    yazi: { aile: 'Kalam', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, bitir },
    silgiIzi: null,
    ses: Object.assign({ kalem: SESLER.rakam }, SESLER),
    sesSeviye: .35,
    karakter: false,
  });
  Kit.kirmizimavi = { RENK, doku };
})();
