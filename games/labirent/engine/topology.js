// engine/topology.js — labirent ızgaraları. Hepsi aynı arayüzü verir; algoritmalar, çözücü ve çizim yalnız buna bakar.
// DOM'a dokunmaz. Birim: dikdörtgende kare kenarı, dairede halka kalınlığı, altıgende köşe yarıçapı = 1.
//
//   grid = { tur, n, adim (komşu merkezler arası), komsu[i] = [{ j, yon, k }], kenar[k] = [i, j], sinir[i] = [{ yon, geo }],
//            merkez(i) → [x, y], kenarGeo(k) → geo, kutu: { x0, y0, x1, y1 }, ... }
//   geo  = { tip: 'd', a: [x, y], b: [x, y] }                    doğru parçası
//        | { tip: 'y', m: [x, y], r, t0, t1 }                   yay (t0 < t1, radyan, y aşağı)
//   lab  = { grid, acik: Uint8Array(kenar sayısı), giris: { hucre, kenar }, cikis: { hucre, kenar | null }, kod }
// yon: dikdörtgen K D G B; altıgen D KD KB B GB GD; daire ic dis saat ters. Sınır kenarının yon'u dışarı bakan yöndür.
(function () {
  'use strict';

  // Komşuluk listesinden kenar tablosu kurar: her komşu çifti bir kez (i < j), iki uçta aynı k.
  function kenarKur(n, ciftler) {
    const komsu = Array.from({ length: n }, () => []), kenar = [], geo = [];
    for (const [i, j, yi, yj, g] of ciftler) {
      const k = kenar.length;
      kenar.push(i < j ? [i, j] : [j, i]);
      geo.push(g);
      komsu[i].push({ j, yon: yi, k });
      komsu[j].push({ j: i, yon: yj, k });
    }
    return { komsu, kenar, geo };
  }

  /* ---------- dikdörtgen: W × H kare ---------- */

  function dik(W, H) {
    const n = W * H, ciftler = [], sinir = Array.from({ length: n }, () => []);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (c + 1 < W) ciftler.push([i, i + 1, 'D', 'B', { tip: 'd', a: [c + 1, r], b: [c + 1, r + 1] }]);
      if (r + 1 < H) ciftler.push([i, i + W, 'G', 'K', { tip: 'd', a: [c, r + 1], b: [c + 1, r + 1] }]);
      if (r === 0) sinir[i].push({ yon: 'K', geo: { tip: 'd', a: [c, 0], b: [c + 1, 0] } });
      if (c === W - 1) sinir[i].push({ yon: 'D', geo: { tip: 'd', a: [W, r], b: [W, r + 1] } });
      if (r === H - 1) sinir[i].push({ yon: 'G', geo: { tip: 'd', a: [c, H], b: [c + 1, H] } });
      if (c === 0) sinir[i].push({ yon: 'B', geo: { tip: 'd', a: [0, r], b: [0, r + 1] } });
    }
    const { komsu, kenar, geo } = kenarKur(n, ciftler);
    return {
      tur: 'dik', n, W, H, adim: 1, komsu, kenar, sinir,
      merkez: (i) => [i % W + .5, Math.floor(i / W) + .5],
      kenarGeo: (k) => geo[k],
      kutu: { x0: 0, y0: 0, x1: W, y1: H },
    };
  }

  /* ---------- daire (theta): iç içe halkalar, merkez tek hücre ---------- */

  // Halka hücre sayıları: halka 1 altı hücre; sonra hücre yayı halka kalınlığının ~2 katını geçince ikiye katlanır.
  function halkaSayilari(R) {
    const s = [1];
    for (let a = 1; a < R; a++) {
      const onceki = s[a - 1], oran = a === 1 ? 6 : Math.max(1, Math.min(2, Math.round(2 * Math.PI * a / onceki)));
      s.push(onceki * oran);
    }
    return s;
  }

  function daire(R) {
    const sayi = halkaSayilari(R), bas = [0];
    for (let a = 1; a < R; a++) bas.push(bas[a - 1] + sayi[a - 1]);
    const n = bas[R - 1] + sayi[R - 1];
    const halka = new Int32Array(n), sira = new Int32Array(n);
    for (let a = 0; a < R; a++) for (let k = 0; k < sayi[a]; k++) { halka[bas[a] + k] = a; sira[bas[a] + k] = k; }
    const aci = (a, k) => -Math.PI / 2 + 2 * Math.PI * k / sayi[a];          // 0. hücre tepeden başlar
    const ciftler = [], sinir = Array.from({ length: n }, () => []);
    for (let a = 1; a < R; a++) {
      const m = sayi[a];
      for (let k = 0; k < m; k++) {
        const i = bas[a] + k, t0 = aci(a, k), t1 = aci(a, k + 1);
        // aynı halkada saat yönündeki komşu: aralarında ışınsal duvar (t1 açısında, a → a+1)
        const j = bas[a] + (k + 1) % m;
        ciftler.push([i, j, 'saat', 'ters', { tip: 'd', a: [a * Math.cos(t1), a * Math.sin(t1)], b: [(a + 1) * Math.cos(t1), (a + 1) * Math.sin(t1)] }]);
        // içteki ebeveyn: aralarında a yarıçaplı yay (bu hücrenin açı aralığı kadar)
        const ust = a === 1 ? 0 : bas[a - 1] + Math.floor(k * sayi[a - 1] / m);
        ciftler.push([i, ust, 'ic', 'dis', { tip: 'y', m: [0, 0], r: a, t0, t1 }]);
        if (a === R - 1) sinir[i].push({ yon: 'dis', geo: { tip: 'y', m: [0, 0], r: R, t0, t1 } });
      }
    }
    const { komsu, kenar, geo } = kenarKur(n, ciftler);
    return {
      tur: 'daire', n, R, adim: 1, sayi, bas, halka, sira, komsu, kenar, sinir,
      merkez: (i) => {
        const a = halka[i];
        if (a === 0) return [0, 0];
        const t = aci(a, sira[i] + .5);
        return [(a + .5) * Math.cos(t), (a + .5) * Math.sin(t)];
      },
      kenarGeo: (k) => geo[k],
      aci,
      kutu: { x0: -R, y0: -R, x1: R, y1: R },
    };
  }

  /* ---------- altıgen: sivri tepeli altıgen hücreler; alan altıgen (yarıçap R) ya da dikdörtgen (W × H) ---------- */

  const S3 = Math.sqrt(3);
  // Yönler: eksenel (q, r) farkı ve kenarın iki köşesi (köşe c: açı 60c − 30°, y aşağı)
  const ALTI = [
    { yon: 'D', dq: 1, dr: 0, k: [0, 1], ters: 'B' },
    { yon: 'GD', dq: 0, dr: 1, k: [1, 2], ters: 'KB' },
    { yon: 'GB', dq: -1, dr: 1, k: [2, 3], ters: 'KD' },
    { yon: 'B', dq: -1, dr: 0, k: [3, 4], ters: 'D' },
    { yon: 'KB', dq: 0, dr: -1, k: [4, 5], ters: 'GD' },
    { yon: 'KD', dq: 1, dr: -1, k: [5, 0], ters: 'GB' },
  ];
  const kose = (x, y, c) => { const t = (60 * c - 30) * Math.PI / 180; return [x + Math.cos(t), y + Math.sin(t)]; };

  // o: { alan: 'altigen', R } ya da { alan: 'dik', W, H }
  function altigen(o) {
    const hucre = [];
    if (o.alan === 'dik') {
      for (let r = 0; r < o.H; r++) for (let c = 0; c < o.W; c++) hucre.push([c - (r - (r & 1)) / 2, r]);
    } else {
      const R = o.R;
      for (let r = -R; r <= R; r++) for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) hucre.push([q, r]);
    }
    const n = hucre.length, yer = new Map(hucre.map(([q, r], i) => [q + ',' + r, i]));
    const mx = new Float64Array(n), my = new Float64Array(n);
    hucre.forEach(([q, r], i) => { mx[i] = S3 * (q + r / 2); my[i] = 1.5 * r; });
    const ciftler = [], sinir = Array.from({ length: n }, () => []);
    hucre.forEach(([q, r], i) => {
      for (const d of ALTI) {
        const j = yer.get((q + d.dq) + ',' + (r + d.dr));
        const g = { tip: 'd', a: kose(mx[i], my[i], d.k[0]), b: kose(mx[i], my[i], d.k[1]) };
        if (j === undefined) sinir[i].push({ yon: d.yon, geo: g });
        else if (i < j) ciftler.push([i, j, d.yon, d.ters, g]);
      }
    });
    const { komsu, kenar, geo } = kenarKur(n, ciftler);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, mx[i] - S3 / 2); x1 = Math.max(x1, mx[i] + S3 / 2); y0 = Math.min(y0, my[i] - 1); y1 = Math.max(y1, my[i] + 1); }
    // dikdörtgen alanın merkezi (giriş bölgesi ona göre)
    const ox = (x0 + x1) / 2, oy = (y0 + y1) / 2;
    return {
      tur: 'altigen', alan: o.alan === 'dik' ? 'dik' : 'altigen', n, adim: S3, hucre, yer, komsu, kenar, sinir,
      merkez: (i) => [mx[i], my[i]],
      kenarGeo: (k) => geo[k],
      orta: [ox, oy],
      kutu: { x0, y0, x1, y1 },
    };
  }

  /* ---------- dokuma: dikdörtgen + köprüler (alt geçitler) ---------- */

  // Bazı iç hücreler köprü olur: üstten bir koridor düz geçer (yatay ya da dikey), ona dik koridor altından geçer.
  // Alttaki geçit ayrı bir "alt hücre"dir (n'in sonuna eklenir); merkezi köprüyle aynı yerde. Köprünün üst koridoruna ait
  // iki geçit ve alt geçidin iki geçidi zorunlu açıktır (grid.zorla); algoritmalar kalan kenarlarla ağacı tamamlar.
  // Çizim: köprünün iki yan kenarı (korkuluk) her zaman duvardır; alt koridorun yan duvarları korkuluğa değmeden kesilir.
  //   r: rastgele (0–1), oran: iç hücrelerin köprü olma olasılığı
  const KOPRU_BOSLUK = .14;
  function dokuma(W, H, r, oran = .07) {
    const taban = dik(W, H), n0 = W * H;
    // köprü yerleri: sınırda değil, iki köprü arasında Chebyshev uzaklığı ≥ 2
    const kopru = [];
    const dolu = new Uint8Array(n0);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (dolu[i] || r() >= oran) continue;
      kopru.push({ c: i, yatay: r() < .5 });
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dolu[(y + dy) * W + x + dx] = 1;
    }
    const n = n0 + kopru.length, alt = new Int32Array(n0).fill(-1), ust = new Int32Array(n).fill(-1);
    kopru.forEach((k, m) => { alt[k.c] = n0 + m; ust[n0 + m] = k.c; });
    // kenarlar: tabanın kenarları; köprünün alt yöndeki iki kenarı alt hücreye taşınır
    const ciftler = [], zorlaCift = [], ek = [];
    const yonler = (yatay) => yatay ? { ustYon: ['D', 'B'], altYon: ['K', 'G'] } : { ustYon: ['K', 'G'], altYon: ['D', 'B'] };
    const kopruBul = new Map(kopru.map(k => [k.c, k]));
    taban.kenar.forEach(([i, j], k) => {
      const g = taban.kenarGeo(k), yi = taban.komsu[i].find(e => e.j === j).yon, yj = taban.komsu[j].find(e => e.j === i).yon;
      let a = i, b = j;
      const ki = kopruBul.get(i), kj = kopruBul.get(j);
      if (ki && yonler(ki.yatay).altYon.includes(yi)) a = alt[i];
      if (kj && yonler(kj.yatay).altYon.includes(yj)) b = alt[j];
      ciftler.push([a, b, yi, yj, Object.assign({}, g, { a: g.a.slice(), b: g.b.slice() })]);
      if ((ki && a !== i) || (kj && b !== j) || (ki && yonler(ki.yatay).ustYon.includes(yi)) || (kj && yonler(kj.yatay).ustYon.includes(yj))) zorlaCift.push(ciftler.length - 1);
    });
    // alt koridorun yan duvarlarını korkuluğa değmeden kes; korkuluklar
    for (const k of kopru) {
      const x = k.c % W, y = Math.floor(k.c / W);
      if (k.yatay) {
        ek.push({ tip: 'd', a: [x, y], b: [x + 1, y] }, { tip: 'd', a: [x, y + 1], b: [x + 1, y + 1] });
        for (const [kx, uc] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) kes(kx, uc, 'dikey');
      } else {
        ek.push({ tip: 'd', a: [x, y], b: [x, y + 1] }, { tip: 'd', a: [x + 1, y], b: [x + 1, y + 1] });
        for (const [kx, uc] of [[x, y], [x, y + 1], [x + 1, y], [x + 1, y + 1]]) kes(kx, uc, 'yatay');
      }
    }
    // (px, py) köşesine dokunan, köprünün dışındaki 'yon' doğrultusundaki duvarın o ucunu içeri çek
    function kes(px, py, yon) {
      for (const cf of ciftler) {
        const g = cf[4], dikey = g.a[0] === g.b[0];
        if ((yon === 'dikey') !== dikey) continue;
        for (const uc of ['a', 'b']) {
          if (g[uc][0] !== px || g[uc][1] !== py) continue;
          const o = uc === 'a' ? 'b' : 'a', d = dikey ? Math.sign(g[o][1] - g[uc][1]) : Math.sign(g[o][0] - g[uc][0]);
          // köprü hücresinin içine giren duvar yoktur (o kenarlar açık); dışarı uzanan duvarın ucu kısalır
          if (dikey) g[uc] = [px, py + d * KOPRU_BOSLUK]; else g[uc] = [px + d * KOPRU_BOSLUK, py];
        }
      }
    }
    const { komsu, kenar, geo } = kenarKur(n, ciftler);
    return {
      tur: 'dokuma', n, W, H, adim: 1, komsu, kenar, sinir: taban.sinir.concat(Array.from({ length: kopru.length }, () => [])),
      kopru, alt, ust, korkuluk: ek, zorla: zorlaCift,
      taban: (i) => (i >= n0 ? ust[i] : i),
      merkez: (i) => taban.merkez(i >= n0 ? ust[i] : i),
      kenarGeo: (k) => geo[k],
      kutu: taban.kutu,
    };
  }

  /* ---------- labirent üzerinde yardımcılar ---------- */

  const kenarNo = (g, i, j) => { for (const e of g.komsu[i]) if (e.j === j) return e.k; return -1; };
  const acikMi = (lab, i, j) => { const k = kenarNo(lab.grid, i, j); return k >= 0 && lab.acik[k] === 1; };
  const acikKomsular = (lab, i) => lab.grid.komsu[i].filter(e => lab.acik[e.k]);
  const derece = (lab, i) => { let d = 0; for (const e of lab.grid.komsu[i]) d += lab.acik[e.k]; return d; };

  // Kaynaktan açık geçitlerle BFS. Döndürür: { uz: Int32Array (−1 ulaşılmaz), eb: Int32Array (ebeveyn) }
  function bfs(lab, kaynak) {
    const n = lab.grid.n, uz = new Int32Array(n).fill(-1), eb = new Int32Array(n).fill(-1), q = new Int32Array(n);
    let bas = 0, son = 0;
    uz[kaynak] = 0; q[son++] = kaynak;
    while (bas < son) {
      const i = q[bas++];
      for (const e of lab.grid.komsu[i]) if (lab.acik[e.k] && uz[e.j] < 0) { uz[e.j] = uz[i] + 1; eb[e.j] = i; q[son++] = e.j; }
    }
    return { uz, eb };
  }

  // Çizilecek duvarlar: kapalı iç kenarlar + sınır (giriş ve çıkış ağızları hariç). Döndürür: geo listesi.
  function duvarlar(lab) {
    const g = lab.grid, liste = [];
    for (let k = 0; k < g.kenar.length; k++) if (!lab.acik[k]) liste.push(g.kenarGeo(k));
    const agiz = (a) => a && a.kenar ? a.hucre + ':' + a.kenar : '';
    const bos = new Set([agiz(lab.giris), agiz(lab.cikis)]);
    for (let i = 0; i < g.n; i++) for (const s of g.sinir[i]) if (!bos.has(i + ':' + s.yon)) liste.push(s.geo);
    if (g.korkuluk) liste.push(...g.korkuluk);
    return liste;
  }

  /* ---------- geometri yardımcıları ---------- */

  // Geo'nun orta noktası (doğru: orta; yay: orta açıdaki nokta)
  function geoOrta(e) {
    if (e.tip === 'd') return [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
    const t = (e.t0 + e.t1) / 2;
    return [e.m[0] + e.r * Math.cos(t), e.m[1] + e.r * Math.sin(t)];
  }
  // Geo'nun uçları
  const geoUclar = (e) => e.tip === 'd' ? [e.a, e.b] : [[e.m[0] + e.r * Math.cos(e.t0), e.m[1] + e.r * Math.sin(e.t0)], [e.m[0] + e.r * Math.cos(e.t1), e.m[1] + e.r * Math.sin(e.t1)]];
  // Noktanın geo'ya uzaklığı
  function geoUzaklik(e, [x, y]) {
    if (e.tip === 'd') {
      const [ax, ay] = e.a, [bx, by] = e.b, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    }
    const vx = x - e.m[0], vy = y - e.m[1];
    let t = Math.atan2(vy, vx);
    while (t < e.t0 - Math.PI) t += 2 * Math.PI;
    while (t > e.t0 + Math.PI) t -= 2 * Math.PI;
    if (t < e.t0) t += 2 * Math.PI;
    if (t <= e.t1) return Math.abs(Math.hypot(vx, vy) - e.r);
    return Math.min(...geoUclar(e).map(([px, py]) => Math.hypot(x - px, y - py)));
  }
  // Hücreyi çevreleyen duvarlar (kapalı iç kenarlar + sınır, ağızlar hariç)
  function hucreDuvarlari(lab, i) {
    const g = lab.grid, liste = [];
    for (const e of g.komsu[i]) if (!lab.acik[e.k]) liste.push(g.kenarGeo(e.k));
    for (const s of g.sinir[i]) {
      const agiz = (lab.giris && lab.giris.hucre === i && lab.giris.kenar === s.yon) || (lab.cikis && lab.cikis.hucre === i && lab.cikis.kenar === s.yon);
      if (!agiz) liste.push(s.geo);
    }
    return liste;
  }

  const M = { dik, daire, halkaSayilari, altigen, dokuma, KOPRU_BOSLUK, ALTI, kenarNo, acikMi, acikKomsular, derece, bfs, duvarlar, geoOrta, geoUclar, geoUzaklik, hucreDuvarlari };
  if (typeof window !== 'undefined') (window.LB = window.LB || {}).topology = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})();
