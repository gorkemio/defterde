// ui/zemin.js — sabit katmanlar: ızgaranın kağıdı ve kareleri, her 5 karede cetvel çizgisi, dış çerçeve; ipucu bantları
// (kalem rakamları; oyuncunun işaretleri bir ipucunu karşılayınca rakamın üstü hafifçe çizilir) ve köşe.
(function () {
  'use strict';
  const KK = window.KK;
  const T = Kit.tarama, RT = Kit.rakamTuval, KL = Kit.kalem;

  const S = { ustu: null, acik: true, vurgu: null };    // ustu: { satir: bool[][], sutun: bool[][] }

  const kalinlik = () => { const s = KK.tahta.o / KK.tahta.dpr; return 1 / Math.max(1, Math.sqrt(s)); };

  function izgara(ctx) {
    const G = KK.tahta.G, b = G.b, k1 = kalinlik();
    T.kagit(ctx, 0, 0, G.W, G.H);
    T.kareler(ctx, 0, 0, G.W, G.H, b, { kalinlik: k1, fazX: 0, fazY: 0 });
    const kal = Math.max(1.5, b * .075);
    for (let c = 5; c < G.en; c += 5) T.cetvel(ctx, [c * b, 1, c * b + .4, G.H - 1], { kalinlik: kal, tohum: ['dikey', c, G.boy], alfa: .78 });
    for (let r = 5; r < G.boy; r += 5) T.cetvel(ctx, [1, r * b, G.W - 1, r * b - .4], { kalinlik: kal, tohum: ['yatay', r, G.en], alfa: .78 });
    const e = kal * .55;
    T.cerceve(ctx, e, e, G.W - 2 * e, G.H - 2 * e, { kalinlik: kal * 1.15, tohum: ['cerceve', G.en, G.boy], tasma: 0, alfa: .9 });
  }

  const boyut = () => KK.config.ipucuBoyut * KK.tahta.G.b;
  const bosluk = (by) => KK.config.ipucuAralik * by;

  function ustuCiz(ctx, x1, x2, y, tohum, b) {
    T.cetvel(ctx, [x1 - b * .08, y + b * .05, x2 + b * .08, y - b * .06], { kalinlik: Math.max(1, b * .055), tohum, alfa: .62 });
  }

  function satirBant(ctx) {
    const G = KK.tahta.G, b = G.b, by = boyut(), bul = KK.oyun.bulmaca();
    T.kagit(ctx, -G.Lw, 0, G.Lw, G.H);
    T.kareler(ctx, -G.Lw, 0, G.Lw, G.H, b, { kalinlik: kalinlik(), fazX: 0, fazY: 0 });
    const kal = Math.max(1.5, b * .075);
    for (let r = 5; r < G.boy; r += 5) T.cetvel(ctx, [-G.Lw + 2, r * b, -1, r * b + .3], { kalinlik: kal, tohum: ['yatay-bant', r], alfa: .55 });
    bul.ipuclari.satir.forEach((ip, r) => {
      const ustu = (S.acik && S.ustu && S.ustu.satir[r]) || [];
      const taban = r * b + (b + by * .86) / 2;
      let x = -b * .22;
      for (let j = ip.length - 1; j >= 0; j--) {
        const m = String(ip[j]), w = RT.genislik(m, by), cizili = ustu[j];
        RT.yaz(ctx, m, x, taban, { boyut: by, hiza: 'sag', tohum: ['satir', r, j], alfa: cizili ? .42 : .95 });
        if (cizili) ustuCiz(ctx, x - w, x, taban - by * .45, ['us', r, j], b);
        x -= w + bosluk(by);
      }
    });
    if (S.vurgu && S.vurgu.tur === 'satir') { ctx.fillStyle = 'rgba(180, 56, 46, .08)'; ctx.fillRect(-G.Lw, S.vurgu.i * b, G.Lw, b); }
  }

  function sutunBant(ctx) {
    const G = KK.tahta.G, b = G.b, by = boyut(), bul = KK.oyun.bulmaca(), adim = KK.config.ipucuAdim * b;
    T.kagit(ctx, 0, -G.Lh, G.W, G.Lh);
    T.kareler(ctx, 0, -G.Lh, G.W, G.Lh, b, { kalinlik: kalinlik(), fazX: 0, fazY: 0 });
    const kal = Math.max(1.5, b * .075);
    for (let c = 5; c < G.en; c += 5) T.cetvel(ctx, [c * b, -G.Lh + 2, c * b - .3, -1], { kalinlik: kal, tohum: ['dikey-bant', c], alfa: .55 });
    bul.ipuclari.sutun.forEach((ip, c) => {
      const ustu = (S.acik && S.ustu && S.ustu.sutun[c]) || [];
      const orta = c * b + b / 2;
      let taban = -b * .2;
      for (let j = ip.length - 1; j >= 0; j--) {
        const m = String(ip[j]), w = RT.genislik(m, by), cizili = ustu[j];
        RT.yaz(ctx, m, orta, taban, { boyut: by, hiza: 'orta', tohum: ['sutun', c, j], alfa: cizili ? .42 : .95 });
        if (cizili) ustuCiz(ctx, orta - w / 2, orta + w / 2, taban - by * .45, ['uc', c, j], b);
        taban -= adim;
      }
    });
    if (S.vurgu && S.vurgu.tur === 'sutun') { ctx.fillStyle = 'rgba(180, 56, 46, .08)'; ctx.fillRect(S.vurgu.i * b, -G.Lh, b, G.Lh); }
  }

  function kose(ctx) {
    const G = KK.tahta.G;
    T.kagit(ctx, -G.Lw, -G.Lh, G.Lw, G.Lh);
    T.kareler(ctx, -G.Lw, -G.Lh, G.Lw, G.Lh, G.b, { kalinlik: kalinlik(), fazX: 0, fazY: 0 });
  }

  // Katmanları tanımla (bulmaca açılınca)
  function kur() {
    const t = KK.tahta, G = t.G;
    t.katman('zemin', { x0: 0, y0: 0, ww: G.W, wh: G.H, ciz: izgara });
    t.katman('satir', { x0: -G.Lw, y0: 0, ww: G.Lw, wh: G.H, ciz: satirBant });
    t.katman('sutun', { x0: 0, y0: -G.Lh, ww: G.W, wh: G.Lh, ciz: sutunBant });
    t.katman('kose', { x0: -G.Lw, y0: -G.Lh, ww: G.Lw, wh: G.Lh, ciz: kose });
  }

  // Üstü çizili ipuçları değişince yalnız ilgili bant yeniden çizilir
  function ustuGuncelle(yeni) {
    const eski = S.ustu;
    S.ustu = yeni;
    const fark = (a, b) => !a || !b || a.some((x, i) => x.length !== b[i].length || x.some((v, j) => v !== b[i][j]));
    if (!eski || fark(eski.satir, yeni.satir)) KK.tahta.yenidenCiz('satir');
    if (!eski || fark(eski.sutun, yeni.sutun)) KK.tahta.yenidenCiz('sutun');
  }
  function vurgula(v) {
    const eski = S.vurgu;
    S.vurgu = v;
    if (eski) KK.tahta.yenidenCiz(eski.tur);
    if (v && (!eski || eski.tur !== v.tur)) KK.tahta.yenidenCiz(v.tur);
  }

  KK.zemin = Object.assign(S, { kur, izgara, satirBant, sutunBant, ustuGuncelle, vurgula });
  void KL;
})();
