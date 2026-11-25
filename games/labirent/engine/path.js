// engine/path.js — oyuncunun çizdiği yol. DOM'a dokunmaz; koordinatlar ızgara biriminde (topology.js).
// İki katman:
//  • mantık: girişten başlayan hücre dizisi (hucreler). Yalnız açık geçitlerden ilerler; duvar delinmez.
//  • görüntü: parmağın gerçek izi (iz), yumuşatılmış ve o anki uç hücrenin içine sıkıştırılmış. Hücreden hücreye
//    geçerken iz geçidin ortasından geçer; iç bölge dışbükey olduğu için iz hiçbir duvara "pay"dan yakın gelmez.
//
//   const d = P.yeni(lab, { pay })           // pay: izin duvara en yakın uzaklığı (yol yarı kalınlığı + duvar + boşluk)
//   P.basla(d, [x, y]) → true | false         // uca 1.5 hücreden yakınsa çizim başlar; değilse 'uzak' olayı
//   P.surukle(d, [x, y]);  P.birak(d);  P.ok(d, [dx, dy]);  P.bastan(d)
//   d.olay: [{ tip: 'ileri' | 'geri' | 'takildi' | 'uzak' | 'bitis', … }]   (arayüz okuyup boşaltır)
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./topology.js') : window.LB.topology;

  const S3 = Math.sqrt(3), TUR = 2 * Math.PI;
  const BFS_EN = 6;               // hızlı kaydırmada en çok bu kadar hücre doldurulur
  const BASLAMA = 1.5;            // uca bu kadar hücre yakın basınca çizgi devam eder
  const YUMUSAK = .5;             // görüntü izi için üstel ortalama katsayısı

  /* ---------- geometri ---------- */

  // Noktanın içinde olduğu hücre (yoksa −1)
  // uc verilirse (dokuma): köprü karesinde, uçtan alt geçide gidiliyorsa alt hücre
  function hucreBul(g, [x, y], uc) {
    if (g.tur === 'dokuma') {
      const c = Math.floor(x), r = Math.floor(y);
      if (c < 0 || r < 0 || c >= g.W || r >= g.H) return -1;
      const i = r * g.W + c, u = g.alt[i];
      if (u >= 0 && uc !== undefined && (uc === u || (!komsuMu(g, uc, i) && uc !== i && komsuMu(g, uc, u)))) return u;
      return i;
    }
    if (g.tur === 'dik') {
      const c = Math.floor(x), r = Math.floor(y);
      return c >= 0 && r >= 0 && c < g.W && r < g.H ? r * g.W + c : -1;
    }
    if (g.tur === 'altigen') {
      const qf = S3 / 3 * x - y / 3, rf = 2 / 3 * y, sf = -qf - rf;
      let q = Math.round(qf), r = Math.round(rf);
      const s = Math.round(sf), dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
      if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
      const i = g.yer.get(q + ',' + r);
      return i === undefined ? -1 : i;
    }
    const rad = Math.hypot(x, y), a = Math.floor(rad);
    if (a >= g.R) return -1;
    if (a === 0) return 0;
    const t = ((Math.atan2(y, x) + Math.PI / 2) % TUR + TUR) % TUR;
    return g.bas[a] + Math.min(g.sayi[a] - 1, Math.floor(t / (TUR / g.sayi[a])));
  }

  const komsuMu = (g, i, j) => g.komsu[i].some(e => e.j === j);
  const gecitOrta = (g, i, j) => T.geoOrta(g.kenarGeo(T.kenarNo(g, i, j)));
  const agizOrta = (g, a) => a.kenar ? T.geoOrta(g.sinir[a.hucre].find(s => s.yon === a.kenar).geo) : g.merkez(a.hucre);
  const aciFark = (a, b) => { let d = (a - b) % TUR; if (d > Math.PI) d -= TUR; if (d < -Math.PI) d += TUR; return d; };

  // Noktayı hücrenin içinden duvarlara "pay" kadar uzak bölgeye sıkıştırır
  function sikistir(g, i, [x, y], pay) {
    if (g.tur === 'dokuma') i = g.taban(i);
    if (g.tur === 'dik' || g.tur === 'dokuma') {
      const c = i % g.W, r = Math.floor(i / g.W);
      return [Math.min(c + 1 - pay, Math.max(c + pay, x)), Math.min(r + 1 - pay, Math.max(r + pay, y))];
    }
    if (g.tur === 'altigen') {
      const [mx, my] = g.merkez(i), rho = S3 / 2 - pay;
      let vx = x - mx, vy = y - my;
      for (let gec = 0; gec < 3; gec++) for (let k = 0; k < 6; k++) {
        const nx = Math.cos(k * Math.PI / 3), ny = Math.sin(k * Math.PI / 3), d = vx * nx + vy * ny;
        if (d > rho) { vx -= (d - rho) * nx; vy -= (d - rho) * ny; }
      }
      return [mx + vx, my + vy];
    }
    const a = g.halka[i];
    if (a === 0) {
      const r = Math.hypot(x, y), en = 1 - pay;
      return r <= en ? [x, y] : [x * en / r, y * en / r];
    }
    const r = Math.min(a + 1 - pay, Math.max(a + pay, Math.hypot(x, y)));
    const t0 = g.aci(a, g.sira[i]), t1 = g.aci(a, g.sira[i] + 1), orta = (t0 + t1) / 2;
    const yari = Math.max(0, (t1 - t0) / 2 - Math.asin(Math.min(1, pay / r)));   // ışınsal duvara uzaklık r·sin(dθ)
    const t = orta + Math.max(-yari, Math.min(yari, aciFark(Math.atan2(y, x), orta)));
    return [r * Math.cos(t), r * Math.sin(t)];
  }

  // Dairede iki nokta arası kutupsal ara noktalar (yay boyunca gider, kirişle iç duvara yaklaşmaz)
  function ara(g, [ax, ay], [bx, by]) {
    if (g.tur !== 'daire') return [[bx, by]];
    const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
    if (ra < .5 || rb < .5) return [[bx, by]];
    const ta = Math.atan2(ay, ax), dt = aciFark(Math.atan2(by, bx), ta);
    const n = Math.max(1, Math.ceil(Math.abs(dt) * Math.max(ra, rb) / .12));
    const p = [];
    for (let k = 1; k <= n; k++) { const f = k / n, r = ra + (rb - ra) * f, t = ta + dt * f; p.push([r * Math.cos(t), r * Math.sin(t)]); }
    return p;
  }

  // Açık geçitlerden en çok `sinir` adımlık en kısa yol (kaynak hariç), yoksa null
  function kisaYol(lab, a, b, sinir) {
    const eb = new Map([[a, -1]]);
    let katman = [a];
    for (let d = 0; d < sinir && katman.length; d++) {
      const sonraki = [];
      for (const h of katman) for (const e of T.acikKomsular(lab, h)) {
        if (eb.has(e.j)) continue;
        eb.set(e.j, h);
        if (e.j === b) { const yol = []; for (let x = b; x !== a; x = eb.get(x)) yol.unshift(x); return yol; }
        sonraki.push(e.j);
      }
      katman = sonraki;
    }
    return null;
  }

  /* ---------- durum ---------- */

  function yeni(lab, o = {}) {
    const g = lab.grid, gi = lab.giris.hucre;
    const d = {
      lab, pay: o.pay ?? .3,
      hucreler: [gi], konum: new Int32Array(g.n).fill(-1),
      iz: [agizOrta(g, lab.giris)], izBas: [0],      // ilk nokta giriş ağzı; ikinci nokta ağzın hemen içi
      aktif: false, bitti: false, takili: false, sonGeri: false,
      toplamAdim: 0, geriSayisi: 0, geriAdim: 0,
      son: null, yumusak: null, olay: [],
    };
    d.konum[gi] = 0;
    d.iz.push(sikistir(g, gi, d.iz[0], d.pay));
    return d;
  }
  const uc = (d) => d.hucreler[d.hucreler.length - 1];

  function izEkle(d, q) {
    const g = d.lab.grid, son = d.iz[d.iz.length - 1];
    if (Math.hypot(q[0] - son[0], q[1] - son[1]) < .04 * g.adim) return;
    for (const p of ara(g, son, q)) d.iz.push(p);
  }

  // Parmağın geçidi kestiği nokta (L: izin son noktası a'da, Q: hedef h'de), köşe direklerinden güvenli bantta.
  // Direğe yakın kenar ucunda komşu duvar dikse (dikdörtgen, dairede ışın) bant payı pay; altıgende duvar 120° ile
  // geldiğinden pay / sin 60°. Yay geçitte açısal pay asin(pay / r_en). Bant içindeki bir noktadan iki yandaki güvenli
  // bölgeye giden parçalar duvara pay'dan yakın gelmez (test/path.test.js 10 000 iz).
  function kesisim(g, a, h, L, Q, pay) {
    const e = g.kenarGeo(T.kenarNo(g, a, h));
    if (e.tip === 'd') {
      const [ax, ay] = e.a, [bx, by] = e.b, ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey);
      const dx = Q[0] - L[0], dy = Q[1] - L[1], pay2 = (g.tur === 'altigen' ? pay / Math.sin(Math.PI / 3) : pay) / len;
      const den = dx * ey - dy * ex;
      let u = den ? ((L[0] - ax) * dy - (L[1] - ay) * dx) / -den : .5;
      if (!isFinite(u)) u = .5;
      u = pay2 >= .5 ? .5 : Math.max(pay2, Math.min(1 - pay2, u));
      return [ax + ex * u, ay + ey * u];
    }
    const rL = Math.hypot(L[0], L[1]), rQ = Math.hypot(Q[0], Q[1]), tL = Math.atan2(L[1], L[0]);
    const f = rQ !== rL ? Math.max(0, Math.min(1, (e.r - rL) / (rQ - rL))) : .5;
    let t = tL + aciFark(Math.atan2(Q[1], Q[0]), tL) * f;
    // iz geçitten içteki hücreye inerken yarıçap küçülür: pay, içteki güvenli bandın en küçük yarıçapına göre
    const rEn = Math.max(1e-6, e.r - 1 + pay);
    const orta = (e.t0 + e.t1) / 2, yari = Math.max(0, (e.t1 - e.t0) / 2 - Math.asin(Math.min(1, pay / rEn)));
    t = orta + Math.max(-yari, Math.min(yari, aciFark(t, orta)));
    return [e.r * Math.cos(t), e.r * Math.sin(t)];
  }

  // a → h. hedef verilirse (işaretçi) iz geçidi parmağın kestiği yerden geçer; verilmezse (klavye, hızlı doldurma)
  // geçide dik yaklaşır: kapı önü (a içinde) → geçidin ortası → kapı önü (h içinde).
  function ekle(d, h, hedef) {
    const g = d.lab.grid, a = uc(d);
    if (hedef) {
      const L = d.iz[d.iz.length - 1], Q = sikistir(g, h, hedef, d.pay), k = kesisim(g, a, h, L, Q, d.pay);
      const yay = g.kenarGeo(T.kenarNo(g, a, h)).tip === 'y';
      if (yay) izEkle(d, sikistir(g, a, k, d.pay));          // yay geçide ışın boyunca gir: kardeş yayın ucuna yaklaşma
      d.izBas.push(d.iz.length);
      izEkle(d, k);
      if (yay) izEkle(d, sikistir(g, h, k, d.pay));
    } else {
      const m = gecitOrta(g, a, h);
      izEkle(d, sikistir(g, a, m, d.pay));
      d.izBas.push(d.iz.length);
      izEkle(d, m);
      izEkle(d, sikistir(g, h, m, d.pay));
    }
    d.hucreler.push(h);
    d.konum[h] = d.hucreler.length - 1;
    d.toplamAdim++;
    d.sonGeri = false; d.takili = false;
    d.olay.push({ tip: 'ileri', hucre: h });
    if (h === d.lab.cikis.hucre) {
      const cm = agizOrta(g, d.lab.cikis);
      izEkle(d, sikistir(g, h, cm, d.pay));
      izEkle(d, cm);
      d.bitti = true; d.aktif = false;
      d.olay.push({ tip: 'bitis' });
    }
  }

  // Yolu p. hücreye (dahil) kadar geri sarar
  function geriSar(d, p) {
    if (p < 0 || p >= d.hucreler.length - 1) return;
    const silinenHucre = d.hucreler.splice(p + 1);
    for (const h of silinenHucre) d.konum[h] = -1;
    const kes = d.izBas[p + 1], silinen = d.iz.slice(Math.max(0, kes - 1));
    d.iz.length = kes; d.izBas.length = p + 1;
    d.geriAdim += silinenHucre.length;
    if (!d.sonGeri) d.geriSayisi++;
    d.sonGeri = true; d.takili = false;
    d.olay.push({ tip: 'geri', silinen, adet: silinenHucre.length });
  }

  function takil(d) {
    if (d.takili) return;
    d.takili = true;
    d.olay.push({ tip: 'takildi' });
  }

  // Parmak h hücresine geçti: geri sar, ilerle, kısa yolu doldur ya da duvara takıl
  function git(d, h, hareket, hedef) {
    const lab = d.lab, g = lab.grid, a = uc(d), n = d.hucreler.length;
    if (n >= 2 && h === d.hucreler[n - 2]) return geriSar(d, n - 2);
    if (komsuMu(g, a, h)) return T.acikMi(lab, a, h) ? ekle(d, h, hedef) : takil(d);
    const rota = kisaYol(lab, a, h, Math.min(BFS_EN, Math.ceil(1.6 * hareket) + 1));
    if (!rota) return takil(d);
    for (const c of rota) {
      if (d.konum[c] >= 0) geriSar(d, d.konum[c]); else ekle(d, c);
      if (d.bitti) break;
    }
  }

  function basla(d, p) {
    if (d.bitti) return false;
    // "uç": kalemin durduğu yer (izin son noktası) ya da uç hücrenin merkezi; ikisinden birine 1.5 hücre
    const g = d.lab.grid, yakin = (q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= BASLAMA * g.adim;
    if (!yakin(d.iz[d.iz.length - 1]) && !yakin(g.merkez(uc(d)))) { d.olay.push({ tip: 'uzak' }); return false; }
    d.aktif = true; d.son = p; d.yumusak = p;
    return true;
  }

  function surukle(d, p) {
    if (!d.aktif || d.bitti) return;
    const g = d.lab.grid, h = hucreBul(g, p, uc(d));
    const hareket = Math.hypot(p[0] - d.son[0], p[1] - d.son[1]) / g.adim;
    d.son = p;
    d.yumusak = [d.yumusak[0] + (p[0] - d.yumusak[0]) * YUMUSAK, d.yumusak[1] + (p[1] - d.yumusak[1]) * YUMUSAK];
    if (h >= 0 && h !== uc(d)) git(d, h, hareket, p);
    if (d.bitti) return;
    izEkle(d, sikistir(g, uc(d), d.yumusak, d.pay));
  }

  function birak(d) { d.aktif = false; }

  // Klavye: [dx, dy] yönündeki komşu. Geri yönse geri sarar, açıksa ilerler, duvarsa takılır.
  function ok(d, [dx, dy]) {
    if (d.bitti) return;
    const lab = d.lab, g = lab.grid, a = uc(d), [ax, ay] = g.merkez(a), L = Math.hypot(dx, dy) || 1;
    let en = null, enCos = .7;
    for (const e of g.komsu[a]) {
      const [bx, by] = g.merkez(e.j), M = Math.hypot(bx - ax, by - ay) || 1;
      const cos = ((bx - ax) * dx + (by - ay) * dy) / (M * L);
      if (cos > enCos) { enCos = cos; en = e; }
    }
    if (!en) return;
    const n = d.hucreler.length;
    if (n >= 2 && en.j === d.hucreler[n - 2]) return geriSar(d, n - 2);
    if (!lab.acik[en.k]) return takil(d);
    ekle(d, en.j);
    if (!d.bitti) izEkle(d, g.merkez(en.j));
  }

  function bastan(d) {
    const t = yeni(d.lab, { pay: d.pay });
    Object.assign(d, t);
    d.olay.push({ tip: 'bastan' });
  }

  const istatistik = (d, cozumUzunlugu) => ({
    verim: cozumUzunlugu / Math.max(1, d.toplamAdim), toplamAdim: d.toplamAdim, geriSayisi: d.geriSayisi, geriAdim: d.geriAdim,
  });

  // Döndürülmüş kutuda istemci noktası → kutunun yerel noktası (kutu merkezi çevresinde aci kadar dönmüş)
  // kutu: { sol, ust, w, h } dönmeden önceki yer; aci radyan
  function yerelNokta([cx, cy], kutu, aci) {
    const ox = kutu.sol + kutu.w / 2, oy = kutu.ust + kutu.h / 2, c = Math.cos(-aci), s = Math.sin(-aci);
    const x = cx - ox, y = cy - oy;
    return [x * c - y * s + kutu.w / 2, x * s + y * c + kutu.h / 2];
  }

  const M = { hucreBul, sikistir, ara, gecitOrta, agizOrta, kisaYol, yeni, uc, basla, surukle, birak, ok, bastan, geriSar, istatistik, yerelNokta, BFS_EN };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).path = M;
  if (node) module.exports = M;
})();
