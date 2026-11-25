// engine/generate.js — labirent üretimi: dört algoritma, giriş/çıkış, labirent kodu. Hepsi tohumlu ve deterministik;
// hepsi "mükemmel" labirent verir (her hücreye tek yol: açık geçit = hücre − 1). DOM'a dokunmaz.
//   G.uret('D-O-W-7KQ9') ya da G.uret({ tur: 'D', boy: 'O', alg: 'W', tohum: 123456 }) → lab
// Algoritmalar (grid, r) → acik: yalnız grid.komsu'ya bakar, her topolojide (dokuma dahil) çalışır.
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const R = node ? require('./rng.js') : window.LB.rng;
  const T = node ? require('./topology.js') : window.LB.topology;
  const C = node ? require('../config.js') : window.LB.config;

  /* ---------- algoritmalar ---------- */

  // Büyüyen ağaç: etkin listeden p olasılıkla en yeni, yoksa rastgele hücre; ona bitişik ziyaretsiz bir komşu açılır.
  // p = 1 geri izlemedir (uzun kıvrımlı koridor), p küçüldükçe Prim'e yaklaşır.
  function buyuyenAgac(g, r, p) {
    const acik = new Uint8Array(g.kenar.length), gor = new Uint8Array(g.n), etkin = [R.tamsayi(r, g.n)];
    gor[etkin[0]] = 1;
    while (etkin.length) {
      const idx = r() < p ? etkin.length - 1 : R.tamsayi(r, etkin.length), c = etkin[idx];
      const aday = g.komsu[c].filter(e => !gor[e.j]);
      if (!aday.length) { etkin.splice(idx, 1); continue; }
      const e = R.sec(r, aday);
      acik[e.k] = 1; gor[e.j] = 1; etkin.push(e.j);
    }
    return acik;
  }

  // Derinlik öncelikli geri izleme: hep en son hücreden devam; çıkmaz azdır, koridor uzun.
  const geriIzleme = (g, r) => buyuyenAgac(g, r, 1);

  // Basit Prim: sınırdaki rastgele bir hücre, ağaçtaki rastgele bir komşusuna bağlanır. Çok sayıda kısa çıkmaz.
  function prim(g, r) {
    const acik = new Uint8Array(g.kenar.length), gor = new Uint8Array(g.n), sinirda = new Uint8Array(g.n), sinir = [];
    const ekle = (c) => { for (const e of g.komsu[c]) if (!gor[e.j] && !sinirda[e.j]) { sinirda[e.j] = 1; sinir.push(e.j); } };
    const s = R.tamsayi(r, g.n);
    gor[s] = 1; ekle(s);
    while (sinir.length) {
      const idx = R.tamsayi(r, sinir.length), f = sinir[idx];
      sinir[idx] = sinir[sinir.length - 1]; sinir.pop();
      const e = R.sec(r, g.komsu[f].filter(x => gor[x.j]));
      acik[e.k] = 1; gor[f] = 1; ekle(f);
    }
    return acik;
  }

  // Wilson: döngüsü silinmiş rastgele yürüyüşler. Bütün yayılan ağaçlar eşit olasılıklı (yanlılıksız).
  function wilson(g, r) {
    const acik = new Uint8Array(g.kenar.length), agacta = new Uint8Array(g.n), sonraki = new Int32Array(g.n), yol = new Int32Array(g.n);
    agacta[R.tamsayi(r, g.n)] = 1;
    for (let s = 0; s < g.n; s++) {
      if (agacta[s]) continue;
      let c = s;
      while (!agacta[c]) { const e = R.sec(r, g.komsu[c]); sonraki[c] = e.j; yol[c] = e.k; c = e.j; }   // döngüler kendiliğinden silinir
      for (c = s; !agacta[c]; c = sonraki[c]) { agacta[c] = 1; acik[yol[c]] = 1; }
    }
    return acik;
  }

  const ALG = { G: geriIzleme, P: prim, W: wilson, K: (g, r) => buyuyenAgac(g, r, C.karisim) };

  // Zorunlu açık kenarlar varsa (dokuma): onların birleştirdiği hücre grupları tek düğüm sayılır, algoritma bu bölüm
  // grafiğinde ağaç kurar, sonuç asıl kenarlara geri taşınır. Grup içi zorunlu olmayan kenar açılmaz (döngü olurdu).
  function zorunluIle(g, r, alg) {
    const ata = Array.from({ length: g.n }, (_, i) => i), kok = (x) => { while (ata[x] !== x) x = ata[x] = ata[ata[x]]; return x; };
    const acik = new Uint8Array(g.kenar.length);
    for (const k of g.zorla) { const [i, j] = g.kenar[k], a = kok(i), b = kok(j); if (a === b) throw new Error('zorunlu kenarlar döngü kuruyor'); ata[a] = b; acik[k] = 1; }
    const no = new Map(), komsu = [], kenar = [], asil = [];
    const dugum = (i) => { const k = kok(i); if (!no.has(k)) { no.set(k, komsu.length); komsu.push([]); } return no.get(k); };
    for (let i = 0; i < g.n; i++) dugum(i);
    g.kenar.forEach(([i, j], k) => {
      if (acik[k]) return;
      const a = dugum(i), b = dugum(j);
      if (a === b) return;
      const q = kenar.length;
      kenar.push([a, b]); asil.push(k);
      komsu[a].push({ j: b, k: q }); komsu[b].push({ j: a, k: q });
    });
    const bolum = alg({ n: komsu.length, komsu, kenar }, r);
    bolum.forEach((v, q) => { if (v) acik[asil[q]] = 1; });
    return acik;
  }

  /* ---------- ızgara, giriş ve çıkış ---------- */

  // ozel: { W, H } yalnız dikdörtgende; ölçüm ve deneme içindir (kodu yoktur)
  function izgara(tur, boy, ozel, r) {
    if (ozel && tur === 'D') return T.dik(ozel.W, ozel.H);
    const b = C.boy[boy];
    if (!b) throw new Error('Bilinmeyen boy: ' + boy);
    if (tur === 'D') return T.dik(b.dik[0], b.dik[1]);
    if (tur === 'T') return T.dokuma(b.dik[0], b.dik[1], r);
    if (tur === 'H') return T.daire(b.daire);
    if (tur === 'A') return T.altigen({ R: b.altigen });
    throw new Error('Bilinmeyen tür: ' + tur);
  }

  // Giriş üst-sol bölgedeki bir dış kenarda; çıkış girişe en uzak dış hücrelerin ilk %20'sinden. Daire: dıştan merkeze.
  function girisCikis(lab, r) {
    const g = lab.grid;
    if (g.tur === 'daire') {
      const { uz } = T.bfs(lab, 0), dis = [];
      for (let i = g.bas[g.R - 1]; i < g.n; i++) dis.push(i);
      const en = Math.max(...dis.map(i => uz[i])), aday = dis.filter(i => uz[i] === en);
      lab.giris = { hucre: R.sec(r, aday), kenar: 'dis' };
      lab.cikis = { hucre: 0, kenar: null };
      return;
    }
    const aday = [];
    if (g.tur === 'dik' || g.tur === 'dokuma') {
      for (let c = 0; c < g.W / 3; c++) aday.push({ hucre: c, kenar: 'K' });
      for (let rr = 0; rr < g.H / 3; rr++) aday.push({ hucre: rr * g.W, kenar: 'B' });
    } else {
      const [ox, oy] = g.orta;
      for (let i = 0; i < g.n; i++) {
        const [x, y] = g.merkez(i);
        if (x < ox && y < oy) for (const s of g.sinir[i]) aday.push({ hucre: i, kenar: s.yon });
      }
    }
    lab.giris = R.sec(r, aday);
    const { uz } = T.bfs(lab, lab.giris.hucre);
    const dis = [];
    for (let i = 0; i < g.n; i++) if (g.sinir[i].length && i !== lab.giris.hucre) dis.push(i);
    dis.sort((a, b) => uz[b] - uz[a] || a - b);
    const ilk = dis.slice(0, Math.max(1, Math.ceil(dis.length * C.cikisPayi)));
    const c = R.sec(r, ilk);
    lab.cikis = { hucre: c, kenar: R.sec(r, g.sinir[c]).yon };
  }

  /* ---------- kod ---------- */

  const KOD = /^([DHAT])-([KOBV])-([GPWK])-([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})$/;
  const kodYaz = (s) => `${s.tur}-${s.boy}-${s.alg}-${R.tohumYaz(s.tohum)}`;
  function kodOku(kod) {
    const m = typeof kod === 'string' && kod.trim().toUpperCase().match(KOD);
    if (!m) return null;
    return { tur: m[1], boy: m[2], alg: m[3], tohum: R.tohumOku(m[4]) };
  }

  // Elle kurulmuş labirent (testler ve sabit örnekler için): açık geçitler [i, j] çiftleriyle verilir.
  function elle(grid, ciftler, giris, cikis) {
    const lab = { grid, acik: new Uint8Array(grid.kenar.length), giris, cikis, kod: null };
    for (const [i, j] of ciftler) { const k = T.kenarNo(grid, i, j); if (k < 0) throw new Error(`komşu değil: ${i}-${j}`); lab.acik[k] = 1; }
    return lab;
  }

  function uret(x) {
    const s = typeof x === 'string' ? kodOku(x) : x;
    if (!s || !ALG[s.alg]) throw new Error('Geçersiz labirent: ' + JSON.stringify(x));
    const ozel = s.W && s.H ? { W: s.W, H: s.H } : null;
    const r = R.rng(R.karma('labirent', s.tur, ozel ? s.W + 'x' + s.H : s.boy, s.alg, s.tohum));
    const grid = izgara(s.tur, s.boy, ozel, r);
    const acik = grid.zorla ? zorunluIle(grid, r, ALG[s.alg]) : ALG[s.alg](grid, r);
    const lab = { grid, acik, giris: null, cikis: null, tur: s.tur, boy: s.boy, alg: s.alg, tohum: s.tohum };
    girisCikis(lab, r);
    lab.kod = ozel ? `${s.tur}-${s.W}x${s.H}-${s.alg}-${R.tohumYaz(s.tohum)}` : kodYaz(s);
    return lab;
  }

  const M = { geriIzleme, prim, wilson, buyuyenAgac, zorunluIle, ALG, izgara, girisCikis, kodYaz, kodOku, elle, uret };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).generate = M;
  if (node) module.exports = M;
})();
