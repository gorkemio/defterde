// render/uv.js — görünmez mürekkep: duvarlar yalnız kalem ucundaki mor UV ışığının altında soluk camgöbeği-beyaz görünür.
// Işık geçtikten sonra duvarlar %15 opaklıkla hafızada kalır (ayar: "kalır" ya da "tamamen kaybolur").
// Katmanlar (render/sahne.js): uv-cam (camgöbeği kopya, gizli kaynak), uv-hafiza (birikimli maske, gizli),
// uv-gorunen (kopya ∩ hafıza, görünür), uv-etiket (giriş/çıkış: gümüş mürekkep görünmez değildir).
// Hafıza yalnız ışığın çevresindeki dikdörtgende güncellenir; o anki ışık her karede küçük bir ara canvas'ta kesilir.
(function () {
  'use strict';
  const LB = (window.LB = window.LB || {});
  const UV = () => window.Kit.uv, S = () => LB.sahne;

  const U = { acik: false, hafiza: true, lab: null, y: null, r: 0, noktalar: [], son: null, ara: null };
  const KATMAN = ['uv-cam', 'uv-hafiza', 'uv-gorunen', 'uv-etiket'];

  function katmanlar() { return KATMAN.map(a => S().katmanlar.get(a)); }

  function kur(lab, y, o) {
    Object.assign(U, { lab, y, acik: !!o.acik, hafiza: o.hafiza !== false, noktalar: [], son: null, r: 3 * y.birim * (lab.grid.adim || 1) });
    S().katman('uv-cam', (ctx) => LB.maze.duvarCiz(ctx, LB.topology.duvarlar(lab), y, { renk: UV().CAMGOBEGI, tohum: lab.kod }), 0).gizli = true;
    S().katman('uv-hafiza', (ctx) => { for (const [x, yy] of U.noktalar) UV().hafiza(ctx, x, yy, U.r, .15); }, 0).gizli = true;
    S().katman('uv-gorunen', gorunenTam, 0);
    S().katman('uv-etiket', (ctx) => LB.maze.etiketler(ctx, lab, y), 0);
    goster();
  }

  // Görünürlük: UV açıkken olağan labirent katmanı gizlenir
  function goster() {
    const [, , gor, et] = katmanlar(), lab = S().katmanlar.get('labirent');
    if (lab) lab.gizli = U.acik;
    if (gor) gor.gizli = !U.acik || !U.hafiza;
    if (et) et.gizli = !U.acik;
    S().kirli();
  }
  function ayarla(acik, hafiza) { U.acik = acik; U.hafiza = hafiza; goster(); }
  function sifirla() { U.noktalar = []; U.son = null; const [, h, g] = katmanlar(); if (h) S().temizle(h); if (g) S().temizle(g); S().kirli(); }

  function gorunenTam(ctx) {
    const [cam, haf] = katmanlar();
    if (!cam || !haf) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const t = araCanvas(cam.cv.width, cam.cv.height), a = t.getContext('2d');
    a.globalCompositeOperation = 'copy'; a.drawImage(cam.cv, 0, 0);
    a.globalCompositeOperation = 'destination-in'; a.drawImage(haf.cv, 0, 0);
    a.globalCompositeOperation = 'source-over';
    ctx.drawImage(t, 0, 0);
    ctx.restore();
  }
  function araCanvas(w, h) {
    if (!U.ara) U.ara = document.createElement('canvas');
    if (U.ara.width < w || U.ara.height < h) { U.ara.width = Math.max(U.ara.width, w); U.ara.height = Math.max(U.ara.height, h); }
    const a = U.ara.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, w, h);
    return U.ara;
  }

  // Dünya dikdörtgeni → katman pikseli
  function kare(x, y) {
    const o = S().dpr * S().sr, r = U.r;
    const x0 = Math.max(0, Math.floor((x - r) * o)), y0 = Math.max(0, Math.floor((y - r) * o));
    return { x0, y0, w: Math.ceil(2 * r * o) + 2, h: Math.ceil(2 * r * o) + 2, o };
  }

  // Kalem ucu ilerledikçe: hafızaya ışık bırak, görünen katmanı yalnız o çevrede yenile
  function guncelle(p) {
    if (!U.acik || !U.hafiza || !p) return;
    if (U.son && Math.hypot(p[0] - U.son[0], p[1] - U.son[1]) < U.r * .25) return;
    U.son = p; U.noktalar.push(p);
    const [cam, haf, gor] = katmanlar();
    UV().hafiza(haf.ctx, p[0], p[1], U.r, .15);
    const k = kare(p[0], p[1]), w = Math.min(k.w, cam.cv.width - k.x0), h = Math.min(k.h, cam.cv.height - k.y0);
    if (w <= 0 || h <= 0) return;
    const t = araCanvas(w, h), a = t.getContext('2d');
    a.globalCompositeOperation = 'copy'; a.drawImage(cam.cv, k.x0, k.y0, w, h, 0, 0, w, h);
    a.globalCompositeOperation = 'destination-in'; a.drawImage(haf.cv, k.x0, k.y0, w, h, 0, 0, w, h);
    a.globalCompositeOperation = 'source-over';
    const g = gor.ctx;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(k.x0, k.y0, w, h); g.drawImage(t, 0, 0, w, h, k.x0, k.y0, w, h); g.restore();
    S().kirli();
  }

  // Her kare: ucun altındaki duvarlar (camgöbeği × radyal ışık) ve mor ışığın kendisi
  function isikCiz(ctx, p) {
    if (!U.acik || !p) return;
    const [cam] = katmanlar();
    const k = kare(p[0], p[1]), w = Math.min(k.w, cam.cv.width - k.x0), h = Math.min(k.h, cam.cv.height - k.y0);
    if (w > 0 && h > 0) {
      const t = araCanvas(w, h), a = t.getContext('2d');
      a.globalCompositeOperation = 'copy'; a.drawImage(cam.cv, k.x0, k.y0, w, h, 0, 0, w, h);
      a.globalCompositeOperation = 'destination-in';
      a.setTransform(k.o, 0, 0, k.o, -k.x0, -k.y0);
      UV().maske(a, p[0], p[1], U.r);
      a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over';
      ctx.drawImage(t, 0, 0, w, h, k.x0 / k.o, k.y0 / k.o, w / k.o, h / k.o);
    }
    UV().isik(ctx, p[0], p[1], U.r * 1.1);
  }

  LB.uv = { U, kur, ayarla, sifirla, guncelle, isikCiz, goster };
})();
