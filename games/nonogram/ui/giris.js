// ui/giris.js — dokunma, fare ve klavye. Tek parmak/fare kareleri işler; iki parmak yakınlaştırır ve kaydırır (ikinci
// parmak değince işlem bırakılır, iki parmak da kalkana kadar yeni işlem başlamaz). Sürükleme ilk hareket yönünde tek satıra
// ya da sütuna kilitlenir. Dokunmatikte uzun basış çarpı koyar, basılı tutarken büyüteç açılır. Fare: sol araç, sağ çarpı,
// orta tuş ya da Alt+sürükle kaydırır, tekerlek yakınlaştırır. Sayfa CSS ile eğik: istemci noktası defterin dönüşümünün tersiyle
// canvas'ın yerel noktasına çevrilir (labirent giris.js kalıbı).
(function () {
  'use strict';
  const KK = window.KK;

  let cv, defter, aci = 0, kutu = null, kaydirma = [0, 0];
  const parmak = new Map();
  let is = null, kilit = false, cimdik = null, fareKaydir = null;

  function yerelNokta([cx, cy], k, a) {
    const ox = k.sol + k.w / 2, oy = k.ust + k.h / 2, c = Math.cos(-a), s = Math.sin(-a), x = cx - ox, y = cy - oy;
    return [x * c - y * s + k.w / 2, x * s + y * c + k.h / 2];
  }
  function olc() {
    const m = new DOMMatrix(getComputedStyle(defter).transform);
    aci = Math.atan2(m.b, m.a);
    const r = defter.getBoundingClientRect();
    // dönmeden önceki kutu: merkez aynı, boyut offset ölçüleri
    kutu = { sol: r.left + r.width / 2 - defter.offsetWidth / 2, ust: r.top + r.height / 2 - defter.offsetHeight / 2, w: defter.offsetWidth, h: defter.offsetHeight };
    let x = 0, y = 0;
    for (let e = cv; e && e !== defter; e = e.offsetParent) { x += e.offsetLeft + (e.clientLeft || 0); y += e.offsetTop + (e.clientTop || 0); }
    kaydirma = [x, y];
  }
  const yerel = (e) => { if (!kutu) olc(); const [x, y] = yerelNokta([e.clientX, e.clientY], kutu, aci); return [x - kaydirma[0], y - kaydirma[1]]; };

  function cimdikBasla() {
    const [a, b] = [...parmak.values()];
    cimdik = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: KK.tahta.kam.s };
  }
  function cimdikSur() {
    const [a, b] = [...parmak.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    KK.tahta.kaydir(m[0] - cimdik.m[0], m[1] - cimdik.m[1]);
    KK.tahta.yakinlas(cimdik.s * d / cimdik.d, m);
    cimdik.m = m;
  }

  function basla() {
    const h = KK.oyun.surukleBasla(is.r0, is.c0, { sag: is.sag, carpi: is.uzun });
    if (h == null) { temizle(); return false; }
    is.tip = 'surukle';
    return true;
  }
  function uzunBasma() {
    if (!is || is.tip !== 'bekle') return;
    is.uzun = true;
    if (basla() && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(12); } catch (e) { /* yoksay */ }
  }
  function temizle() {
    if (is && is.zaman) clearTimeout(is.zaman);
    is = null;
    KK.ust.sayac = null; KK.ust.buyutec = null;
    KK.tahta.kirli();
  }
  function buyutecGoster(p, r, c) {
    if (!is || is.tur === 'mouse' || !KK.oyun.ayar.buyutec) return;
    KK.ust.buyutec = { x: p[0], y: p[1], hedef: { r, c } };
  }

  function asagi(e) {
    if (e.pointerType === 'mouse' && (e.button === 1 || (e.button === 0 && e.altKey))) {
      e.preventDefault(); olc(); fareKaydir = { id: e.pointerId, p: yerel(e) };
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
      return;
    }
    if (e.pointerType === 'mouse' && e.button > 2) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
    olc();
    const p = yerel(e);
    parmak.set(e.pointerId, p);
    if (parmak.size === 1) {
      if (kilit) return;
      if (KK.ust.haritadaMi(p)) { KK.ust.haritaOdak(p); return; }
      const h = KK.tahta.hucreBul(p);
      if (!h) return;
      if (h.tur !== 'izgara') { KK.oyun.baslikDokun(h); return; }
      if (!KK.oyun.oynanabilir()) return;
      KK.oyun.imlecGizle();
      is = { tip: 'bekle', id: e.pointerId, r0: h.r, c0: h.c, son: { r: h.r, c: h.c }, sag: e.pointerType === 'mouse' && e.button === 2, tur: e.pointerType, t0: performance.now(), p0: p, eksen: null };
      if (e.pointerType === 'mouse') basla();
      else { buyutecGoster(p, h.r, h.c); is.zaman = setTimeout(uzunBasma, KK.config.uzunBasmaMs); }
      KK.tahta.kirli();
    } else if (parmak.size === 2) {
      if (is) {
        if (is.tip === 'surukle') { if (performance.now() - is.t0 < 300) KK.oyun.surukleIptal(); else KK.oyun.surukleBitir(); }
        temizle();
      }
      kilit = true;
      cimdikBasla();
    }
  }

  function nokta(p) {
    const G = KK.tahta.G, [rf, cf] = KK.tahta.kareKoordinat(p), b = G.b * KK.tahta.kam.s;
    if (is.tip === 'bekle') {
      const d = Math.hypot(p[0] - is.p0[0], p[1] - is.p0[1]) / b;
      buyutecGoster(p, is.r0, is.c0);
      if (d < KK.config.kilitEsik) { KK.tahta.kirli(); return; }
      clearTimeout(is.zaman);
      if (!basla()) return;
    }
    if (!is.eksen) {
      const dr = rf - (is.r0 + .5), dc = cf - (is.c0 + .5);
      if (Math.max(Math.abs(dr), Math.abs(dc)) < .5 + KK.config.kilitEsik * .5) { buyutecGoster(p, is.r0, is.c0); KK.tahta.kirli(); return; }
      is.eksen = Math.abs(dc) >= Math.abs(dr) ? 'satir' : 'sutun';
    }
    let r = is.r0, c = is.c0;
    if (is.eksen === 'satir') c = Math.max(0, Math.min(G.en - 1, Math.floor(cf)));
    else r = Math.max(0, Math.min(G.boy - 1, Math.floor(rf)));
    if (r !== is.son.r || c !== is.son.c) { is.son = { r, c }; KK.oyun.surukleGuncelle(r, c); }
    const n = Math.abs(r - is.r0) + Math.abs(c - is.c0) + 1;
    const sag = p[0] < KK.tahta.w - 100;
    KK.ust.sayac = is.tur === 'mouse' ? { n, x: p[0] + 22, y: p[1] - 14 } : { n, x: p[0] + (sag ? 74 : -74), y: p[1] - 22 };
    buyutecGoster(p, r, c);
    KK.tahta.kirli();
  }

  function hareket(e) {
    if (fareKaydir && fareKaydir.id === e.pointerId) { const p = yerel(e); KK.tahta.kaydir(p[0] - fareKaydir.p[0], p[1] - fareKaydir.p[1]); fareKaydir.p = p; return; }
    if (!parmak.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !is) { if (!kutu) olc(); KK.oyun.uzerinde(KK.tahta.hucreBul(yerel(e))); }
      return;
    }
    parmak.set(e.pointerId, yerel(e));
    if (is && is.id === e.pointerId) {
      const liste = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (liste.length) for (const c of liste) { nokta(yerel(c)); if (!is) break; } else nokta(yerel(e));
    } else if (parmak.size === 2 && cimdik) cimdikSur();
  }

  function yukari(e) {
    if (fareKaydir && fareKaydir.id === e.pointerId) { fareKaydir = null; return; }
    if (!parmak.has(e.pointerId)) return;
    parmak.delete(e.pointerId);
    try { cv.releasePointerCapture(e.pointerId); } catch (x) { /* yoksay */ }
    if (is && is.id === e.pointerId) {
      clearTimeout(is.zaman);
      const tamam = is.tip === 'surukle' || (e.type === 'pointerup' && basla());
      if (tamam && is) KK.oyun.surukleBitir();
      temizle();
    }
    if (parmak.size < 2) cimdik = null;
    if (parmak.size === 0) kilit = false;
  }

  const OKLAR = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  function tus(e) {
    if (e.target.closest && e.target.closest('input, textarea, select, .not, button, .defterde-donus')) return;
    if (!KK.oyun.ekranda()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) KK.oyun.yinele(); else KK.oyun.geriAl(); return; }
    if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); KK.oyun.yinele(); return; }
    if (ctrl) return;
    if (OKLAR[e.key]) { e.preventDefault(); KK.oyun.imlecHareket(...OKLAR[e.key], e.shiftKey); return; }
    if (e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const m = { Home: [0, -5], End: [0, 5], PageUp: [-5, 0], PageDown: [5, 0] }[e.key];
      KK.oyun.imlecHareket(m[0], m[1], false); return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); KK.oyun.tusIsle('dolu'); return; }
    if (e.key === 'x' || e.key === 'X') { e.preventDefault(); KK.oyun.tusIsle('carpi'); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); KK.oyun.tusIsle('sil'); return; }
    if (e.key === '+' || e.key === '=') { KK.tahta.yakinlas(KK.tahta.kam.s * 1.25, [KK.tahta.w / 2, KK.tahta.h / 2]); return; }
    if (e.key === '-') { KK.tahta.yakinlas(KK.tahta.kam.s / 1.25, [KK.tahta.w / 2, KK.tahta.h / 2]); }
  }

  function kur(o) {
    cv = o.cv; defter = o.defter;
    cv.addEventListener('pointerdown', asagi);
    cv.addEventListener('pointermove', hareket);
    cv.addEventListener('pointerup', yukari);
    cv.addEventListener('pointercancel', yukari);
    cv.addEventListener('lostpointercapture', yukari);
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !is) KK.oyun.uzerinde(null); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      olc();
      if (e.shiftKey && !e.ctrlKey) { KK.tahta.kaydir(-e.deltaY, -e.deltaX); return; }
      KK.tahta.yakinlas(KK.tahta.kam.s * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), yerel(e));
    }, { passive: false });
    addEventListener('keydown', tus);
    addEventListener('resize', () => { kutu = null; });
    addEventListener('scroll', () => { kutu = null; }, { passive: true });
  }

  KK.giris = { kur, olc: () => { kutu = null; } };
})();
