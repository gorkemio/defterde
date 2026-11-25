// kit/dolmakalem.js — "dolma kalem" malzemesi. Hangi oyun olduğunu bilmez.
// Çizgi bir kalem izi değil, mürekkep şerididir: rough.js titrek orta hattı verir, şerit onun iki yanına kurulur.
// Kalınlık yol boyunca 1.2–3 birim arasında değişir (uçlar ince, orta dolgun; uca dik giden çizgi kalın), baş ve
// sonda küçük mürekkep damlası, çok nadir minik sıçrama, opaklık .9. Mürekkepler: mavi-siyah, kırmızı, yeşil, mor.
// Taze mürekkep: { kuruma: true } verilen iz koyu ve hafif parlak yazılır, 2 saniyede normal tonuna kurur.
// Kurşun kalemle çizilecek şeyler (notlar, önizleme, tehdit işaretleri) çağrıda { murekkep: false } verir.
// Başlıklar Marck Script (metinSvg { sinif: 'baslik' }, .baslik), küçük metinler Patrick Hand.
// Silgi yok: dolma kalem silinmez; geri alma karalamadır (Kit.dolmakalem.karala).
// Sesler: kalem ucu (uc), kapak tıkırtısı (kapak), sayfa çevirme (sayfa), uzun çizgi (cizgi). Melodi yok.
// Yükleme: kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/dolmakalem.js; CSS: kit/dolmakalem.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, svgEl } = KL;

  const RENK = {
    mavisiyah: '#1b2a5e', kirmizi: '#b3261e', yesil: '#1f6e43', mor: '#5b2a86',
    kursun: '#6e6e6e', kagit: '#fbf9f2',
  };
  const MUREKKEPLER = ['mavisiyah', 'kirmizi', 'yesil', 'mor'];
  const KURUMA_MS = 2000;
  const OPAKLIK = .9;

  /* ---------- renk ---------- */

  function rgb(renk) {
    const h = String(KL.renkDeger(renk)).trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(h);
    if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
    const r = /rgba?\(([^)]+)\)/.exec(h);
    if (r) return r[1].split(',').slice(0, 3).map(v => parseFloat(v));
    return [27, 42, 94];
  }
  // Taze mürekkep: %35 daha koyu, biraz daha doygun (ıslak mürekkep kağıda girmeden önce derin görünür)
  function taze(renk) {
    const c = rgb(renk), ort = (c[0] + c[1] + c[2]) / 3;
    const t = c.map(v => Math.max(0, Math.min(255, Math.round((ort + (v - ort) * 1.18) * .65))));
    return `rgb(${t[0]}, ${t[1]}, ${t[2]})`;
  }

  /* ---------- kalem izi: rough seçeneği ---------- */

  // Dolma kalem tek geçişte yazar (rough'un ikinci geçişi yok); titreme tohumla biraz değişir.
  function secenek(s, anahtar, ek) {
    const r = rastgele('dolma', ...anahtar);
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = true;
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.roughness === undefined) s.roughness = Math.max(.2, s.roughness + aralik(r, -.1, .1));
    return s;
  }

  /* ---------- şerit geometrisi ---------- */

  const ADIM = 1.5;                 // orta hat örnekleme aralığı (birim)
  const f1 = (v) => v.toFixed(2);

  // q: kalem izi <path> (DOM'da). Örnekler, her örnekte sol/sağ kenar ve uç bilgisi.
  function seritKur(q, L, anahtar, sw) {
    const r = rastgele('serit', ...anahtar);
    const n = Math.max(8, Math.ceil(L / ADIM));
    const p = [];
    for (let i = 0; i <= n; i++) { const a = q.getPointAtLength(L * i / n); p.push([a.x, a.y]); }
    // teğet: ±2 örnek üstünden (rough titremesi kalınlık gürültüsüne dönüşmesin)
    const aci = p.map((_, i) => {
      const a = p[Math.max(0, i - 2)], b = p[Math.min(n, i + 2)];
      return Math.atan2(b[1] - a[1], b[0] - a[0]);
    });
    // uç açısı: 30° ± 8° (sabit 45° olsaydı her X'in aynı çaprazı kalın olurdu)
    const uc = (30 + aralik(r, -8, 8)) * Math.PI / 180;
    // gürültü: birkaç tohumlu düğüm arasında yumuşak geçiş
    const dugum = [];
    for (let k = 0; k < 6; k++) dugum.push(1 + aralik(r, -.12, .12));
    const gurultu = (t) => {
      const x = t * (dugum.length - 1), i = Math.min(dugum.length - 2, Math.floor(x)), f = x - i;
      const s = f * f * (3 - 2 * f);
      return dugum[i] * (1 - s) + dugum[i + 1] * s;
    };
    const k = sw / 2, wMin = 1.2 * k, wMax = 3 * k;
    const sol = [], sag = [], yari = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // basınç: uçlar ince, orta dolgun · yön: uca dik giden çizgi kalın, uç boyunca giden ince (dolma kalemin imzası)
      const basinc = .35 + .65 * Math.pow(Math.sin(Math.PI * t), .6);
      const yon = Math.pow(Math.abs(Math.sin(aci[i] - uc)), 1.4);
      const w = (wMin + (wMax - wMin) * (.38 * basinc + .62 * yon)) * gurultu(t);
      const h = w / 2, nx = -Math.sin(aci[i]), ny = Math.cos(aci[i]);
      yari.push(h);
      sol.push([p[i][0] + nx * h, p[i][1] + ny * h]);
      sag.push([p[i][0] - nx * h, p[i][1] - ny * h]);
    }
    // nadir sıçrama: %3 olasılıkla, son ucun ilerisinde minik nokta
    let sicrama = null;
    if (r() < .03) {
      const d = aralik(r, 4, 8), a = aci[n] + aralik(r, -.6, .6);
      sicrama = { x: p[n][0] + Math.cos(a) * d, y: p[n][1] + Math.sin(a) * d, r: aralik(r, .3, .5) };
    }
    return { n, p, aci, sol, sag, yari, sicrama, damlaR: aralik(r, 1.7, 2.05), basR: aralik(r, 1.1, 1.3) };
  }

  // İlerleme m (0..n, kesirli) kadar şeridin dış çizgisi
  function seritYolu(S, m) {
    if (m <= 0) return '';
    const i = Math.floor(m), f = m - i;
    const ara = (A) => {
      if (i >= S.n || f === 0) return null;
      return [A[i][0] + (A[i + 1][0] - A[i][0]) * f, A[i][1] + (A[i + 1][1] - A[i][1]) * f];
    };
    const sl = S.sol.slice(0, i + 1), sg = S.sag.slice(0, i + 1);
    const a = ara(S.sol), b = ara(S.sag);
    if (a) { sl.push(a); sg.push(b); }
    let d = `M${f1(sl[0][0])} ${f1(sl[0][1])}`;
    for (let k = 1; k < sl.length; k++) d += `L${f1(sl[k][0])} ${f1(sl[k][1])}`;
    for (let k = sg.length - 1; k >= 0; k--) d += `L${f1(sg[k][0])} ${f1(sg[k][1])}`;
    return d + 'Z';
  }
  function ortaYol(S, m) {
    const i = Math.min(S.n, Math.floor(m));
    if (i < 1) return '';
    let d = `M${f1(S.p[0][0])} ${f1(S.p[0][1])}`;
    for (let k = 1; k <= i; k++) d += `L${f1(S.p[k][0])} ${f1(S.p[k][1])}`;
    return d;
  }
  // m noktasındaki konum, yön ve yarı kalınlık
  function uctaki(S, m) {
    const i = Math.min(S.n, Math.max(0, Math.round(m)));
    return { x: S.p[i][0], y: S.p[i][1], a: S.aci[i], h: S.yari[i] };
  }
  function damlaKoy(e, u, olcek, geri) {
    const rx = u.h * olcek, ry = u.h * olcek * .82;
    const x = u.x - Math.cos(u.a) * u.h * geri, y = u.y - Math.sin(u.a) * u.h * geri;
    e.setAttribute('cx', f1(x)); e.setAttribute('cy', f1(y));
    e.setAttribute('rx', f1(rx)); e.setAttribute('ry', f1(ry));
    e.setAttribute('transform', `rotate(${(u.a * 180 / Math.PI).toFixed(1)} ${f1(x)} ${f1(y)})`);
  }

  /* ---------- kuruma ---------- */

  // el'in dolgusu taze tondan renk'e kurur. Parlaklık (varsa) kurumayla solar ve kaldırılır.
  function kurumaBaslat(dolgular, renk, o = {}) {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return Promise.resolve();
    const sure = o.sureMs ?? KURUMA_MS, gec = o.gecikme || 0, ton = taze(renk), son = KL.renkDeger(renk);
    const isler = dolgular.map(el => {
      const opak = parseFloat(el.getAttribute('fill-opacity') || '1');
      const a = el.animate([{ fill: ton, fillOpacity: Math.min(1, opak + .1) }, { fill: son, fillOpacity: opak }],
        { duration: sure, delay: gec, fill: 'both', easing: 'cubic-bezier(.3, 0, .55, 1)' });
      a.id = 'kuruma';
      el._kuruma = a;
      return a.finished.then(() => { a.cancel(); el._kuruma = null; }, () => { el._kuruma = null; });
    });
    if (o.parlak) {
      const a = o.parlak.animate([{ opacity: 1 }, { opacity: 0 }], { duration: sure * .8, delay: gec, fill: 'both' });
      o.parlak._kuruma = a;
      isler.push(a.finished.then(() => o.parlak.remove(), () => o.parlak.remove()));
    }
    return Promise.all(isler);
  }

  // Hâlâ kuruyan izleri hızlıca kurut (yeni sembol yazılırken önceki taze kalmasın). node: herhangi bir ata.
  function kurut(node, o = {}) {
    if (!node) return Promise.resolve();
    const sure = o.sureMs ?? 300;
    const els = [node, ...node.querySelectorAll('*')].filter(e => e._kuruma);
    return Promise.all(els.map(el => {
      const a = el._kuruma;
      if (a.playState === 'finished') return Promise.resolve();
      if (sure <= 0) { a.finish(); return a.finished.catch(() => {}); }
      const kalan = Math.max(0, (a.effect.getTiming().duration + (a.effect.getTiming().delay || 0)) - (a.currentTime || 0));
      if (kalan > sure) a.playbackRate = kalan / sure;
      return a.finished.catch(() => {});
    }));
  }

  /* ---------- iz kancası: kalem izini mürekkep şeridi yap ---------- */

  function iz(q, bilgi) {
    const o = bilgi.o || {};
    if (o.murekkep === false) return null;
    const L = bilgi.uzunluk;
    if (!L || !isFinite(L)) return null;                    // görünmeyen svg: ölçü yok → düz kalem izi
    const renk = q.getAttribute('stroke');
    if (!renk || renk === 'none') return null;
    const sw = (parseFloat(q.getAttribute('stroke-width')) || 2) * (o.kalinlik || 1);
    const S = seritKur(q, L, bilgi.anahtar, sw);
    const taze_ = o.kuruma === true;

    const g = svgEl('g', { class: 'murekkep' });
    q.parentNode.insertBefore(g, q);
    q.remove();
    const dolgu = { fill: renk, 'fill-opacity': OPAKLIK, stroke: 'none' };
    const serit = svgEl('path', Object.assign({ class: 'serit' }, dolgu), g);
    const bas = svgEl('ellipse', Object.assign({ class: 'damla' }, dolgu), g);
    const son = svgEl('ellipse', Object.assign({ class: 'damla' }, dolgu), g);
    const dolgular = [serit, bas, son];
    let nokta = null;
    if (S.sicrama) {
      nokta = svgEl('circle', Object.assign({ class: 'sicrama', cx: f1(S.sicrama.x), cy: f1(S.sicrama.y), r: f1(S.sicrama.r) }, dolgu), g);
      dolgular.push(nokta);
    }
    let parlak = null;
    if (taze_) {
      const ort = S.yari.reduce((a, b) => a + b, 0) / S.yari.length;
      parlak = svgEl('path', {
        class: 'parlak', fill: 'none', stroke: '#ffffff', 'stroke-opacity': .34,
        'stroke-width': f1(ort * .8), 'stroke-linecap': 'round', 'pointer-events': 'none',
      }, g);
    }

    const tamCiz = () => {
      serit.setAttribute('d', seritYolu(S, S.n));
      damlaKoy(bas, uctaki(S, 0), S.basR, .15);
      damlaKoy(son, uctaki(S, S.n), S.damlaR, -.15);
      if (parlak) parlak.setAttribute('d', ortaYol(S, S.n));
      if (nokta) nokta.removeAttribute('visibility');
    };

    let bitti;
    if (!bilgi.hareket || !bilgi.sure) {
      tamCiz();
      bitti = Promise.resolve();
    } else {
      // yazım: kısmi şerit her karede yeniden kurulur; son damla kalemin ucu gibi ilerler
      [serit, bas, son].forEach(e => e.setAttribute('visibility', 'hidden'));
      if (nokta) nokta.setAttribute('visibility', 'hidden');
      const t0 = performance.now() + (bilgi.gecikme || 0), T = bilgi.sure;
      const yumusak = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      bitti = new Promise(coz => {
        let tamam = false;
        const bitir = () => {
          if (tamam) return;
          tamam = true;
          [serit, bas, son].forEach(e => e.removeAttribute('visibility'));
          tamCiz();
          coz();
        };
        // arka plandaki sekmede kare gelmez: süre dolunca yine de bitir (oyun akışı takılmasın)
        setTimeout(bitir, (bilgi.gecikme || 0) + T + 120);
        const kare = (simdi) => {
          if (tamam) return;
          if (!g.isConnected) { tamam = true; return coz(); }
          const x = (simdi - t0) / T;
          if (x < 0) { requestAnimationFrame(kare); return; }
          if (x >= 1) return bitir();
          const m = Math.max(.6, yumusak(x) * S.n);
          serit.setAttribute('d', seritYolu(S, m));
          damlaKoy(bas, uctaki(S, 0), S.basR, .15);
          damlaKoy(son, uctaki(S, m), .95, 0);
          if (parlak) parlak.setAttribute('d', ortaYol(S, m));
          [serit, bas, son].forEach(e => e.removeAttribute('visibility'));
          requestAnimationFrame(kare);
        };
        requestAnimationFrame(kare);
      });
    }
    if (taze_) kurumaBaslat(dolgular, renk, { gecikme: bilgi.hareket ? (bilgi.gecikme || 0) : 0, parlak });
    return { bitti };
  }

  /* ---------- karalama: geri alınan sembolün üstü ---------- */

  // grup: karalanacak sembolün <g>'si (çizgi ona eklenir). kutu: { x, y, w, h } sembolün kutusu.
  // o: { renk, tohum: [...], anlik, solukluk (varsayılan .3), solmaMs (600) }. Grup solar ve sayfada kalır.
  function karala(K, grup, kutu, o = {}) {
    const r = rastgele('karala', ...(o.tohum || [kutu.x, kutu.y]));
    const { x, y, w, h } = kutu;
    const pts = [];
    const adet = 5;
    for (let i = 0; i <= adet; i++) {
      const f = i / adet;
      pts.push([x + w * (.02 + .96 * f) + aralik(r, -1.5, 1.5), y + h * (.62 - .3 * f) + (i % 2 ? -h * .1 : h * .1) + aralik(r, -1.5, 1.5)]);
    }
    kurut(grup, { sureMs: 0 });
    const s = K.egri(grup, pts, { stroke: KL.renkDeger(o.renk || 'mavisiyah'), strokeWidth: .9, roughness: .9 },
      ['karala', ...(o.tohum || [])], { anlik: o.anlik, sureMs: [160, 160] });
    const hedef = o.solukluk ?? .3;
    const bitti = s.bitti.then(() => {
      if (!KL.animasyonVar() || o.anlik) { grup.setAttribute('opacity', hedef); return; }
      const a = grup.animate([{ opacity: 1 }, { opacity: hedef }], { duration: o.solmaMs ?? 600, fill: 'forwards' });
      return a.finished.then(() => { grup.setAttribute('opacity', hedef); a.cancel(); }, () => grup.setAttribute('opacity', hedef));
    });
    return { node: grup, bitti, sure: s.sure + (o.solmaMs ?? 600) };
  }

  /* ---------- metin kuruması (ör. "beş") ---------- */

  function metinKurut(textEl, renk, o = {}) {
    textEl.setAttribute('fill', KL.renkDeger(renk));
    return kurumaBaslat([textEl], renk, o);
  }

  /* ---------- sesler (Kit.ses.nota / parazit ile; dosya yok, melodi yok) ---------- */

  const Sx = () => Kit.ses;
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;

  // Kalem ucu kâğıtta: ıslak, alçak, kısa sürtünme. arg: { sureMs } (X darbesi ~120, O döngüsü ~180, kazanma çizgisi 300)
  function uc(c, h, t0, arg) {
    const sure = Math.max(.06, Math.min(.5, ((arg && arg.sureMs) || 120) / 1000));
    const f = 1300 * sapma(.15);
    Sx().parazit(c, h, t0, 'bandpass', f, f * .7, 1.1, sure, .22);
    Sx().parazit(c, h, t0 + .01, 'lowpass', 900, 600, .8, sure * .9, .1);
    Sx().parazit(c, h, t0 + sure * .85, 'bandpass', 2400, 1800, 2.5, .03, .06);      // uç kâğıttan kalkarken
  }
  // Kapak tıkırtısı: iki kısa metalik tık (kapak kalemin arkasına takılır)
  function kapak(c, h, t0) {
    Sx().parazit(c, h, t0, 'bandpass', 4200, 3000, 3, .02, .3);
    Sx().nota(c, h, t0, 'triangle', 2600, 2300, .05, .06);
    Sx().parazit(c, h, t0 + .07, 'bandpass', 3400, 2600, 3, .025, .36);
    Sx().nota(c, h, t0 + .07, 'sine', 1800, 1650, .08, .05);
  }
  // Sayfa çevirme: uzun, yumuşak, süpürülen kağıt hışırtısı
  function sayfa(c, h, t0) {
    Sx().parazit(c, h, t0, 'bandpass', 2600, 700, .6, .5, .16);
    Sx().parazit(c, h, t0 + .05, 'lowpass', 900, 300, .7, .42, .1);
  }
  function cizgi(c, h, t0) { uc(c, h, t0, { sureMs: 300 }); }

  /* ---------- tanım ---------- */

  Kit.malzeme.tanimla('dolmakalem', {
    cizim: { roughness: .8, bowing: .9, strokeWidth: 2, fillWeight: .9, sureMs: [120, 300], animasyon: true },
    renk: Object.assign({ ana: RENK.mavisiyah, vurgu: RENK.kirmizi, mavi: RENK.mavisiyah }, RENK),
    yazi: { aile: 'Patrick Hand', baslik: 'Marck Script', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, iz },
    silgiIzi: null,
    ses: { uc, kapak, sayfa, cizgi, kalem: uc },
    sesSeviye: .35,
    karakter: false,
  });
  Kit.dolmakalem = { RENK, MUREKKEPLER, KURUMA_MS, taze, kurut, kurumaBaslat, karala, metinKurut };
})();
