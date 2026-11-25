// ui/giris.js — dokunma, fare ve klavye. Tek parmak (ya da fare) çizer; iki parmak yakınlaştırır ve kaydırır; ikinci
// parmak değince çizim bırakılır ve iki parmak da kalkana kadar yeni çizim başlamaz. Fare tekerleği yakınlaştırır,
// boşluk tuşuyla sürükleme kaydırır. Oklar yolu hücre hücre yürütür.
// Sayfa CSS ile eğik durur: istemci noktası defterin dönüşümünün tersiyle canvas'ın yerel noktasına çevrilir.
//   LB.giris.kur({ cv, defter, basla(p), surukle(p), birak(), ok([dx, dy]) })   p: dünya pikseli
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});

  let cv, defter, geri, aci = 0, kutu = null, kaydirma = null;
  const parmak = new Map();
  let cizen = null, kilit = false, cimdik = null, bosluk = false;

  // Defterin dönmeden önceki kutusu ve canvas'ın defter içindeki yeri (offset zinciri)
  function olc() {
    const m = new DOMMatrix(getComputedStyle(defter).transform);
    aci = Math.atan2(m.b, m.a);
    kutu = { sol: defter.offsetLeft, ust: defter.offsetTop, w: defter.offsetWidth, h: defter.offsetHeight };
    let x = 0, y = 0;
    for (let e = cv; e && e !== defter; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    kaydirma = [x, y];
  }
  const yerel = (e) => {
    if (!kutu) olc();
    const [x, y] = LB.path.yerelNokta([e.clientX, e.clientY], kutu, aci);
    return [x - kaydirma[0], y - kaydirma[1]];
  };
  const dunya = (e) => LB.sahne.dunyaya(yerel(e));

  function cimdikBasla() {
    const [a, b] = [...parmak.values()];
    cimdik = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: LB.sahne.kam.s };
  }
  function cimdikSur() {
    const [a, b] = [...parmak.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    LB.sahne.kaydir(m[0] - cimdik.m[0], m[1] - cimdik.m[1]);
    LB.sahne.yakinlas(cimdik.s * d / cimdik.d, m);
    cimdik.m = m;
  }

  function asagi(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
    olc();
    parmak.set(e.pointerId, yerel(e));
    if (parmak.size === 1) {
      if (kilit) return;
      if (bosluk && e.pointerType === 'mouse') { cizen = null; return; }
      cizen = geri.basla(dunya(e)) ? e.pointerId : null;
    } else if (parmak.size === 2) {
      if (cizen !== null) { geri.birak(); cizen = null; }
      kilit = true;
      cimdikBasla();
    }
  }
  function hareket(e) {
    if (!parmak.has(e.pointerId)) return;
    const onceki = parmak.get(e.pointerId);
    parmak.set(e.pointerId, yerel(e));
    if (cizen === e.pointerId) {
      const liste = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (liste.length) for (const c of liste) geri.surukle(dunya(c)); else geri.surukle(dunya(e));
    } else if (parmak.size === 2 && cimdik) cimdikSur();
    else if (parmak.size === 1 && bosluk && e.pointerType === 'mouse') { const p = parmak.get(e.pointerId); LB.sahne.kaydir(p[0] - onceki[0], p[1] - onceki[1]); }
  }
  function yukari(e) {
    if (!parmak.has(e.pointerId)) return;
    parmak.delete(e.pointerId);
    try { cv.releasePointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
    if (cizen === e.pointerId) { geri.birak(); cizen = null; }
    if (parmak.size < 2) cimdik = null;
    if (parmak.size === 0) kilit = false;
  }

  const OKLAR = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  function kur(o) {
    cv = o.cv; defter = o.defter; geri = o;
    cv.addEventListener('pointerdown', asagi);
    cv.addEventListener('pointermove', hareket);
    cv.addEventListener('pointerup', yukari);
    cv.addEventListener('pointercancel', yukari);
    cv.addEventListener('lostpointercapture', yukari);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      olc();
      LB.sahne.yakinlas(LB.sahne.kam.s * Math.exp(-e.deltaY * .0016), yerel(e));
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (e.code === 'Space') { bosluk = true; if (e.target === document.body || e.target === cv) e.preventDefault(); return; }
      if (OKLAR[e.key] && !e.target.closest('.not')) { e.preventDefault(); o.ok(OKLAR[e.key]); }
    });
    addEventListener('keyup', (e) => { if (e.code === 'Space') bosluk = false; });
    addEventListener('resize', () => { kutu = null; });
  }

  LB.giris = { kur, olc };
})();
