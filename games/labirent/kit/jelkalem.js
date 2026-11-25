// kit/jelkalem.js — "jel kalem" malzemesi. Hangi oyun olduğunu bilmez. Koyu sayfa (kit/siyahsayfa.css) için.
// İki yüzü var:
//  1. Malzeme (SVG/DOM: marj, altı çizgiler, simgeler): Kit.malzeme.sec('jelkalem'). Jel tek geçişte kayar: rough.js çift
//     çizgisi kapalı, uçlar sabit; mürekkep gümüş. Font Mynerve (kit/jelkalem.css).
//  2. Canvas çizimi (labirent, yol): Kit.jel. Titreme rough.js'ten gelir (generator → nokta listesi), mürekkep buradan:
//     çizgi boyunca ±%15 kalınlık, kesişimde küçük birikme, kesintisiz iz; simli renklerde çizgiye gömülü sabit sim.
//
//   const nok = Kit.jel.roughYol([[x1, y1], [x2, y2], …], { tohum: ['duvar', 3] })   // köşeler aynen korunur
//   Kit.jel.cizgi(ctx, nok, { renk: Kit.jel.RENK.beyaz, kalinlik: 2.2, tohum: ['duvar', 3] })
//   Kit.jel.birikim(ctx, x, y, 2.2)
//   Kit.jel.yol(ctx, nok, { renk: Kit.jel.SIMLI.turkuaz, kalinlik: 11, tohum: ['yol'], s0 })      // simli kalem
//   Kit.jel.yazi(ctx, 'giriş', x, y, { boy: 18, renk: Kit.jel.RENK.gumus, metal: true })
// Yükleme: rough.js → kit/kalem.js → kit/ses.js → kit/malzeme.js → kit/jelkalem.js; CSS: kit/siyahsayfa.css, kit/jelkalem.css
(function () {
  'use strict';

  const Kit = window.Kit;
  const KL = Kit.kalem;
  const { rastgele, aralik, tohum } = KL;

  const RENK = { beyaz: '#f1eee6', gumus: '#c9c9c4', gumusKoyu: '#8f8e8a' };
  // Simli renkler: tonları ve açıklıkları farklı; sırası ayar notundaki sıra.
  const SIMLI = { turkuaz: '#3fd6c8', pembe: '#ff7fb6', altin: '#e8c25a', yesil: '#8be36b', mor: '#b48cff' };
  const SIMLI_AD = { turkuaz: 'turkuaz', pembe: 'pembe', altin: 'altın', yesil: 'yeşil', mor: 'mor' };

  /* ---------- renk ---------- */

  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function karis(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const acik = (h, t) => karis(h, '#ffffff', t);
  const koyu = (h, t) => karis(h, '#000000', t);

  /* ---------- gürültü ve örnekleme ---------- */

  // Pürüzsüz 1B değer gürültüsü (−1…1): her `adim` birimde bir rastgele düğüm, arası kosinüsle. Tohumlu.
  function gurultu(r, adim) {
    const d = [];
    return (s) => {
      const k = Math.max(0, s) / adim, i = Math.floor(k), f = k - i;
      while (d.length <= i + 1) d.push(r() * 2 - 1);
      const u = (1 - Math.cos(f * Math.PI)) / 2;
      return d[i] * (1 - u) + d[i + 1] * u;
    };
  }

  // Elle çizilmiş ızgara düz durmaz: bütün çizime uygulanan pürüzsüz 2B büküm alanı. Aynı nokta hep aynı yere kayar;
  // bu yüzden kesişen iki çizgi birlikte kayar ve düğümler kopmaz. genlik px, dalga px (tepe arası).
  //   const b = Kit.jel.bukum(['labirent', kod], 1.4, 90); const [x2, y2] = b(x, y)
  function bukum(an, genlik, dalga) {
    if (!genlik) return (x, y) => [x, y];
    const r = rastgele('bukum', ...an), N = 64, ax = new Float32Array(N * N), ay = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { ax[i] = r() * 2 - 1; ay[i] = r() * 2 - 1; }
    const yum = (t) => t * t * (3 - 2 * t);
    const alan = (a, x, y) => {
      const gx = x / dalga + 7.3, gy = y / dalga + 3.1, i = Math.floor(gx), j = Math.floor(gy), fx = yum(gx - i), fy = yum(gy - j);
      const v = (p, q) => a[((q % N + N) % N) * N + ((p % N + N) % N)];
      return (v(i, j) * (1 - fx) + v(i + 1, j) * fx) * (1 - fy) + (v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx) * fy;
    };
    return (x, y) => [x + genlik * alan(ax, x, y), y + genlik * alan(ay, x, y)];
  }

  // rough.js işlem listesi (move / lineTo / bcurveTo) → sık nokta listesi [[x, y], …] (yaklaşık her `adim` px'te bir)
  function opsNokta(ops, adim = 2) {
    const pts = [];
    let x = 0, y = 0;
    const koy = (px, py) => {
      const s = pts[pts.length - 1];
      if (!s || Math.abs(s[0] - px) > .01 || Math.abs(s[1] - py) > .01) pts.push([px, py]);
    };
    for (const o of ops) {
      const d = o.data;
      if (o.op === 'move') { x = d[0]; y = d[1]; koy(x, y); }
      else if (o.op === 'lineTo') { x = d[0]; y = d[1]; koy(x, y); }
      else if (o.op === 'bcurveTo') {
        const [ax, ay, bx, by, ex, ey] = d;
        const n = Math.max(2, Math.ceil(Math.hypot(ex - x, ey - y) / adim));
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          koy(u * u * u * x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * ex,
              u * u * u * y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * ey);
        }
        x = ex; y = ey;
      }
    }
    return pts;
  }

  let uretec = null;
  const gen = () => uretec || (uretec = rough.generator());

  // Köşe noktalarından elle çizilmiş gibi titrek yol. preserveVertices: köşeler kımıldamaz → kesişimler hep kapanır.
  // o: { tohum: [...], roughness, bowing, adim, kapali }
  function roughYol(noktalar, o = {}) {
    const p = o.kapali ? noktalar.concat([noktalar[0]]) : noktalar;
    if (p.length < 2) return p.map(q => [q[0], q[1]]);
    const d = gen().linearPath(p, {
      roughness: o.roughness ?? .6, bowing: o.bowing ?? .6, maxRandomnessOffset: o.sapma ?? 1,
      disableMultiStroke: true, preserveVertices: true, strokeWidth: 1, seed: tohum(...(o.tohum || ['jel'])),
    });
    return opsNokta(d.sets[0].ops, o.adim || 2);
  }

  /* ---------- mürekkep ---------- */

  // Jel kalem izi: yuvarlak uçlu, 8–12 px'lik bindirmeli parçalar; her parçanın kalınlığı çizgi boyunca pürüzsüzce
  // ±oyna (varsayılan %15) değişir. Parçalar örtüştüğü ve mürekkep opak olduğu için iz hiç kesilmez.
  // o: { renk, kalinlik, tohum, oyna, alfa, kesik: [çizgi, boşluk] (kesikli: tek geçiş, sabit kalınlık), s0 }
  // Döndürür: izin uzunluğu (px).
  function cizgi(ctx, nok, o = {}) {
    const k0 = o.kalinlik || 2;
    ctx.save();
    ctx.strokeStyle = o.renk || RENK.beyaz;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (o.alfa !== undefined) ctx.globalAlpha *= o.alfa;
    let s = 0;
    if (nok.length === 1) {
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(nok[0][0], nok[0][1], k0 / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return 0;
    }
    if (o.kesik) {
      ctx.lineWidth = k0;
      ctx.setLineDash(o.kesik);
      ctx.lineDashOffset = -(o.s0 || 0);
      ctx.beginPath(); ctx.moveTo(nok[0][0], nok[0][1]);
      for (let i = 1; i < nok.length; i++) { ctx.lineTo(nok[i][0], nok[i][1]); s += Math.hypot(nok[i][0] - nok[i - 1][0], nok[i][1] - nok[i - 1][1]); }
      ctx.stroke();
      ctx.restore();
      return s;
    }
    const r = rastgele('jel', ...(o.tohum || ['cizgi']));
    const g = gurultu(r, o.dalga || 34);
    const oyna = o.oyna ?? .15, s0 = o.s0 || 0;
    let bas = 0, hedef = aralik(r, 8, 12);
    ctx.beginPath(); ctx.moveTo(nok[0][0], nok[0][1]);
    for (let i = 1; i < nok.length; i++) {
      const [x, y] = nok[i], [px, py] = nok[i - 1];
      s += Math.hypot(x - px, y - py);
      ctx.lineTo(x, y);
      if (s - bas >= hedef || i === nok.length - 1) {
        ctx.lineWidth = k0 * (1 + oyna * g(s0 + (bas + s) / 2));
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y);
        bas = s; hedef = aralik(r, 8, 12);
      }
    }
    ctx.restore();
    return s;
  }

  // Kalemin durduğu, döndüğü ya da iki çizginin buluştuğu yerde biraz fazla mürekkep: kalınlıktan azıcık büyük, daha açık.
  function birikim(ctx, x, y, kalinlik, o = {}) {
    const renk = o.renk || RENK.beyaz, r = kalinlik * (o.oran || .62);
    ctx.save();
    if (o.alfa !== undefined) ctx.globalAlpha *= o.alfa;
    ctx.fillStyle = renk;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha *= .55;
    ctx.fillStyle = acik(renk, .5);
    ctx.beginPath(); ctx.arc(x - r * .15, y - r * .15, r * .45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Sim: mürekkebe gömülü, çizgiden açık 1–1.5 px'lik parıltılar. Konumları yalnız yay uzunluğundan ve tohumdan türer:
  // aynı çizginin bir parçası sonradan eklense de (s0) aynı simler aynı yerde çıkar; çizerken kıpırdamazlar.
  // o: { renk, kalinlik, tohum, s0, aralik: işaretler arası px (3), olasilik (.55), parla: 0–1 (bitişte bir kez) }
  function sim(ctx, nok, o = {}) {
    const k = o.kalinlik || 8, yari = Math.max(0, k / 2 - 1.1), ara = o.aralik || 3, p = o.olasilik ?? .55;
    const renk = o.renk || SIMLI.turkuaz, an = o.tohum || ['sim'];
    const cok = acik(renk, .7), az = acik(renk, .42), parla = o.parla || 0;
    let s = o.s0 || 0;
    ctx.save();
    for (let i = 1; i < nok.length; i++) {
      const [ax, ay] = nok[i - 1], [bx, by] = nok[i];
      const L = Math.hypot(bx - ax, by - ay);
      if (!L) continue;
      const ux = (bx - ax) / L, uy = (by - ay) / L;
      for (let m = Math.ceil(s / ara); m * ara < s + L; m++) {
        const r = rastgele('sim', ...an, m);
        if (r() > p) continue;
        const t = m * ara - s, d = (r() * 2 - 1) * yari, cap = aralik(r, .5, .75);
        const c = r();
        ctx.fillStyle = c < .14 ? '#ffffff' : c < .3 ? az : cok;
        ctx.globalAlpha = Math.min(1, aralik(r, .75, 1) + parla);
        ctx.beginPath();
        ctx.arc(ax + ux * t - uy * d, ay + uy * t + ux * d, cap * (1 + parla * .5), 0, Math.PI * 2);
        ctx.fill();
      }
      s += L;
    }
    ctx.restore();
  }

  // Simli jel kalem izi: mürekkep, üstten ışık alan ince parlak öz (jel kabarık durur) ve sim. Döndürür: uzunluk.
  // o: { renk, kalinlik, tohum, s0, parla }
  function yol(ctx, nok, o = {}) {
    const renk = o.renk || SIMLI.turkuaz, k = o.kalinlik || 8, an = o.tohum || ['yol'];
    const L = cizgi(ctx, nok, { renk, kalinlik: k, tohum: [...an, 'murekkep'], oyna: .08, dalga: 60, s0: o.s0 });
    ctx.save();
    ctx.translate(-k * .1, -k * .12);
    // öz saydam değil, önceden karıştırılmış renk: iz parça parça eklenince birleşme yerlerinde parlak benek olmaz
    cizgi(ctx, nok, { renk: karis(renk, acik(renk, .5), .3), kalinlik: k * .34, tohum: [...an, 'oz'], oyna: .2, s0: o.s0 });
    ctx.restore();
    sim(ctx, nok, { renk, kalinlik: k, tohum: an, s0: o.s0, parla: o.parla });
    return L;
  }

  // SVG kalem izine sim: yol boyunca tohumlu, çizgiden açık küçük noktalar (bitişte süreyi saran çember için)
  function simSvg(yolEl, renk, tohum, kalinlik = 2) {
    const r = rastgele('simsvg', ...tohum), L = yolEl.getTotalLength(), g = KL.svgEl('g', { class: 'sim', 'pointer-events': 'none' });
    yolEl.parentNode.appendChild(g);
    for (let s = r() * 3; s < L; s += 2.4) {
      if (r() > .55) continue;
      const p = yolEl.getPointAtLength(s), c = r();
      KL.svgEl('circle', {
        cx: (p.x + (r() - .5) * kalinlik * .6).toFixed(2), cy: (p.y + (r() - .5) * kalinlik * .6).toFixed(2),
        r: aralik(r, .45, .7).toFixed(2), fill: c < .15 ? '#ffffff' : acik(renk, .65),
      }, g);
    }
    return g;
  }

  /* ---------- yazı ---------- */

  // Canvas'a el yazısı: harf harf, hafif dönmüş ve kaymış (Kit.kalem.metinSvg görünümü). metal: gümüş parıltı.
  // o: { boy, renk, tohum, hiza: 'sol' | 'orta' | 'sag', metal, aci, zemin: kâğıt rengi (çizgilerin üstünde okunsun) }
  function yazi(ctx, metin, x, y, o = {}) {
    const boy = o.boy || 16, r = rastgele('jelyazi', ...(o.tohum || [metin]));
    ctx.save();
    ctx.font = `${boy}px Mynerve, 'Segoe Print', 'Bradley Hand', cursive`;
    ctx.textBaseline = 'alphabetic';
    const harfler = [...metin], toplam = ctx.measureText(metin).width;
    const x0 = o.hiza === 'orta' ? x - toplam / 2 : o.hiza === 'sag' ? x - toplam : x;
    let dolgu = o.renk || RENK.gumus;
    if (o.metal) {
      const g = ctx.createLinearGradient(0, y - boy * .8, 0, y + boy * .15);
      g.addColorStop(0, '#ecebe6'); g.addColorStop(.42, '#c3c2bd'); g.addColorStop(.58, '#9d9c97'); g.addColorStop(1, '#d4d3cd');
      dolgu = g;
    }
    ctx.fillStyle = dolgu;
    if (o.aci) { ctx.translate(x, y); ctx.rotate(o.aci); ctx.translate(-x, -y); }
    let onceki = '';
    for (const h of harfler) {
      const hx = x0 + ctx.measureText(onceki).width;
      onceki += h;
      if (h === ' ') continue;
      ctx.save();
      ctx.translate(hx, y + (r() - .5) * boy * .07);
      ctx.rotate((r() - .5) * .1);
      ctx.globalAlpha *= .9 + r() * .1;
      if (o.zemin) { ctx.save(); ctx.strokeStyle = o.zemin; ctx.lineWidth = boy * .32; ctx.lineJoin = 'round'; ctx.strokeText(h, 0, 0); ctx.restore(); }
      ctx.fillText(h, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    return toplam;
  }

  /* ---------- sesler: Web Audio sentezi (dosya yok). Müzik, jingle, kronometre tiki yok. ---------- */

  const SS = () => Kit.ses;
  // Tanecikli gürültü (kâğıt, kauçuk): genlik küçük adımlarla oynar; filtre f0 → f1 süpürülür
  function tanecik(c, h, t0, o) {
    const sure = o.sure, uz = Math.ceil(c.sampleRate * (sure + .05)), b = c.createBuffer(1, uz, c.sampleRate), v = b.getChannelData(0);
    let g = .6;
    const adim = Math.max(1, Math.floor(c.sampleRate * (o.tanecik || .006)));
    for (let i = 0; i < uz; i++) { if (i % adim === 0) g = .35 + Math.random() * .65; v[i] = (Math.random() * 2 - 1) * g; }
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = o.tip; f.Q.value = o.q;
    f.frequency.setValueAtTime(o.f0, t0); f.frequency.linearRampToValueAtTime(o.f1, t0 + sure);
    const z = c.createGain();
    z.gain.setValueAtTime(.0001, t0); z.gain.linearRampToValueAtTime(o.tepe, t0 + Math.min(.03, sure * .25));
    z.gain.setValueAtTime(o.tepe * .85, t0 + sure * .7); z.gain.exponentialRampToValueAtTime(.0001, t0 + sure);
    s.connect(f); f.connect(z); z.connect(h); s.start(t0); s.stop(t0 + sure + .05);
  }
  const sapma = (a) => 1 + (Math.random() * 2 - 1) * a;

  // Sürekli kayış: döngülü gürültü → bant süzgeci (gıcırtı için hafif titreşimli) → kazanç. Kit.ses.cal('kayisKur') ile
  // kurulur (böylece sessiz ayarına ve ana çıkışa uyar); sonra hiz() ile perde ve şiddet, dur() ile susar.
  let K = null;
  const SESLER = {
    kayisKur(c, h, t0) {
      if (K) { try { K.src.stop(); K.lfo.stop(); } catch (e) { /* yoksay */ } }
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), v = b.getChannelData(0);
      let g = .6;
      for (let i = 0; i < v.length; i++) { if (i % 180 === 0) g = .4 + Math.random() * .6; v[i] = (Math.random() * 2 - 1) * g; }
      const src = c.createBufferSource(); src.buffer = b; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.4; f.frequency.value = 1200;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 11; lg.gain.value = 0;
      lfo.connect(lg); lg.connect(f.frequency);
      const z = c.createGain(); z.gain.value = 0;
      src.connect(f); f.connect(z); z.connect(h);
      src.start(t0); lfo.start(t0);
      K = { c, src, f, z, lfo, lg };
    },
    // duvara takılma: çok kısa, yumuşak tık
    tik(c, h, t0) {
      const p = sapma(.06);
      SS().parazit(c, h, t0, 'bandpass', 1900 * p, 1300 * p, 2.6, .028, .16);
      SS().nota(c, h, t0, 'sine', 720 * p, 480 * p, .035, .07);
    },
    // kalem kapağının kapanması: iki plastik tık (ikincisi kısık)
    kapak(c, h, t0) {
      SS().parazit(c, h, t0, 'bandpass', 3600, 2400, 1.6, .02, .18);
      SS().nota(c, h, t0, 'sine', 240, 150, .055, .14);
      SS().parazit(c, h, t0 + .075, 'bandpass', 4200, 3000, 2, .016, .14);
      SS().nota(c, h, t0 + .075, 'triangle', 900, 700, .03, .05);
    },
    // kalın kâğıt sayfa çevirme
    sayfa(c, h, t0) {
      tanecik(c, h, t0, { sure: .5, tip: 'bandpass', f0: 2200, f1: 600, q: .6, tepe: .14, tanecik: .02 });
      tanecik(c, h, t0 + .06, { sure: .38, tip: 'lowpass', f0: 800, f1: 220, q: .7, tepe: .12, tanecik: .03 });
    },
    // silgi: kauçuk sürtünmesi (kısa, tok, tanecikli)
    silgi(c, h, t0) { tanecik(c, h, t0, { sure: .09 * sapma(.2), tip: 'lowpass', f0: 650 * sapma(.15), f1: 360, q: .9, tepe: .45, tanecik: .011 }); },
    // UV ışığı açılırken küçük düğme tıkı
    uv(c, h, t0) {
      SS().nota(c, h, t0, 'square', 2600, 1300, .012, .08);
      SS().parazit(c, h, t0, 'bandpass', 4200, 3200, 2.2, .015, .1);
    },
  };
  const kayis = {
    kur() { if (SS() && !SS().sessiz) SS().cal('kayisKur'); },
    // v: çizim hızı (hücre/s), geri: geri sarıyor (daha kısık ve pes)
    hiz(v, geri) {
      if (!K) return;
      const s = Math.max(0, Math.min(1, v / 9)), t = K.c.currentTime;
      K.f.frequency.setTargetAtTime((900 + 1300 * s) * (geri ? .68 : 1), t, .04);
      K.lg.gain.setTargetAtTime(70 * s, t, .06);
      K.z.gain.setTargetAtTime((s > .02 ? .05 + .09 * Math.pow(s, .7) : 0) * (geri ? .5 : 1), t, .035);
    },
    dur() { if (K) K.z.gain.setTargetAtTime(0, K.c.currentTime, .05); },
  };

  /* ---------- malzeme (SVG/DOM tarafı) ---------- */

  // Jel tek geçişte kayar: ikinci çizgi yok, uçlar yerinde, titreme az.
  function secenek(s, anahtar, ek) {
    if (ek.disableMultiStroke === undefined) s.disableMultiStroke = true;
    if (ek.disableMultiStrokeFill === undefined) s.disableMultiStrokeFill = true;
    if (ek.preserveVertices === undefined) s.preserveVertices = true;
    if (ek.maxRandomnessOffset === undefined) s.maxRandomnessOffset = 1.4;
    return s;
  }
  // Jel mürekkebi çoğu yerde tam örter; iz başına çok az opaklık farkı.
  function bitir(g, anahtar, o) {
    const r = rastgele('jelbaski', ...(anahtar || []));
    for (const p of g.querySelectorAll('path')) {
      const st = p.getAttribute('stroke');
      if (!st || st === 'none') continue;
      p.setAttribute('stroke-opacity', aralik(r, .86, 1).toFixed(2));
    }
  }

  Kit.malzeme.tanimla('jelkalem', {
    cizim: { roughness: .6, bowing: .6, strokeWidth: 1.5, fillWeight: .6, sureMs: [180, 320], animasyon: true },
    renk: { ana: RENK.gumus, vurgu: SIMLI.turkuaz, kursun: RENK.gumusKoyu, mavi: RENK.gumus, kirmizi: SIMLI.pembe, beyaz: RENK.beyaz, kagit: '#1c1b1a' },
    yazi: { aile: 'Mynerve', ornek: 'AİŞĞÇÖÜıüöç0123456789' },
    isle: { secenek, bitir },
    silgiIzi: null,
    ses: SESLER,
    sesSeviye: .3,
    karakter: false,
  });

  Kit.jel = { kayis, RENK, SIMLI, SIMLI_AD, rgb, karis, acik, koyu, gurultu, bukum, opsNokta, roughYol, cizgi, birikim, sim, yol, simSvg, yazi };
})();
