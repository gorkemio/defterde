// nonogram/kilim.js — kilim deseni üretici: tohumlu, simetrik (ayna ya da dörtlü), geometrik. Rastgele gürültü değil, kurallı
// bir dil: 1 çerçeveler (düz, dişli, zikzak) · 2 köşe basamakları · 3 eşkenar dörtgen madalyon (iç içe halkalar) ·
// 4 madalyonun uçlarında çengel çiftleri · 5 zemin motifleri (küçük dörtgenler) · 6 seyrek dolgu.
// Simetrik desenler sık sık çok çözümlü çıkar: önce az sayıda simetri kırıcı kare değişikliği, olmazsa en az başlangıç karesi.
// DOM yok. Motiflere anlam yüklenmez; adı "Kilim No. 214".
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('./model.js') : window.KK.model;
  const S = node ? require('./solver.js') : window.KK.solver;
  const D = node ? require('./difficulty.js') : window.KK.difficulty;

  // Kit.kalem ile aynı karma (FNV-1a) ve mulberry32
  function karma(...p) { let h = 2166136261; const s = p.join('|'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rastgele(...p) { let a = karma(...p); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const tam = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const sec = (r, d) => d[Math.floor(r() * d.length)];

  const KATMAN = { cerceve: 1, ic: 2, kose: 3, madalyon: 4, cekirdek: 5, cengel: 6, motif: 7, dolgu: 8 };
  const PALET = { kirmizi: '#a8322d', lacivert: '#23395d', hardal: '#c9a227', kahve: '#6b4423', krem: '#f3e8d0' };

  // Bir desen: n×n; simetri 'dortlu' (iki eksen) ya da 'ayna' (yalnız dikey eksen: üst ve alt farklı)
  function desen(tohum, n) {
    const r = rastgele('kilim', tohum, n), g = new Uint8Array(n * n), c = (n - 1) / 2;
    const sim = r() < .74 ? 'dortlu' : 'ayna';
    const yaz = (y, x, k) => { if (y >= 0 && x >= 0 && y < n && x < n) g[y * n + x] = k; };
    const koy = (y, x, k) => {                      // simetriye göre aynalanır
      yaz(y, x, k); yaz(y, n - 1 - x, k);
      if (sim === 'dortlu') { yaz(n - 1 - y, x, k); yaz(n - 1 - y, n - 1 - x, k); }
    };
    const bos = (y, x) => y >= 0 && x >= 0 && y < n && x < n && !g[y * n + x];
    const halka = (y, x) => Math.min(y, x, n - 1 - y, n - 1 - x);
    const konum = (y, x, h) => (y === h || y === n - 1 - h ? x : y);
    const her = (f) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) f(y, x, halka(y, x)); };

    // 1 kenar: çerçeve + süs (dişli, ikinci çerçeve, zikzak)
    const turler = n >= 19 ? ['duz', 'disli', 'cift', 'zikzak', 'zikzak'] : n >= 15 ? ['duz', 'disli', 'disli', 'cift'] : ['duz', 'disli'];
    const tur = sec(r, turler), dis = n >= 19 ? tam(r, 0, 1) : 0;
    let alan = dis + 2;
    her((y, x, h) => { if (h === dis) yaz(y, x, KATMAN.cerceve); });
    if (tur === 'disli') { her((y, x, h) => { if (h === dis + 1 && konum(y, x, h) % 2 === dis % 2) yaz(y, x, KATMAN.cerceve); }); alan = dis + 3; }
    if (tur === 'cift') { her((y, x, h) => { if (h === dis + 2) yaz(y, x, KATMAN.ic); }); alan = dis + 4; }
    if (tur === 'zikzak') {
      her((y, x, h) => { const k = konum(y, x, h); if ((h === dis + 2 && k % 2 === 0) || (h === dis + 3 && k % 2 === 1)) yaz(y, x, KATMAN.ic); });
      alan = dis + 5;
    }
    const A = c - alan;                             // alanın yarı boyu (halka alan … merkez)

    // 2 madalyon
    const cengelVar = A >= 4 && r() < .8;
    const R = Math.max(2, A - (cengelVar ? 2 : 0));
    const tip = A >= 4 ? sec(r, ['elmas', 'elmas', 'yildiz']) : 'elmas';
    const adim = sec(r, [2, 2, 3]), cek = tam(r, 0, 1);
    her((y, x) => {
      const dy = Math.abs(y - c), dx = Math.abs(x - c), d = dy + dx, m = Math.max(dy, dx);
      if (tip === 'elmas') {
        if (d <= R && (R - d) % adim === 0) yaz(y, x, KATMAN.madalyon);
      } else {
        const a = Math.max(2, Math.round(R * .62));
        if ((m === a && d <= R) || (d === R && m <= a)) yaz(y, x, KATMAN.madalyon);
        else if (d <= R - 3 && (R - 3 - d) % 2 === 0) yaz(y, x, KATMAN.madalyon);
      }
      if (d <= cek) yaz(y, x, KATMAN.cekirdek);
    });

    // 3 çengeller: madalyonun uçlarından dışa; ucu iki yana açılıp geri kıvrılır (koçboynuzu)
    const cengel = (ty, tx, uy, ux) => {
      const py = ux, px = uy;
      const hucre = [[ty + uy, tx + ux], [ty + 2 * uy, tx + 2 * ux]];
      for (const sg of [1, -1]) hucre.push([ty + 2 * uy + py * sg, tx + 2 * ux + px * sg], [ty + 2 * uy + 2 * py * sg, tx + 2 * ux + 2 * px * sg], [ty + uy + 2 * py * sg, tx + ux + 2 * px * sg]);
      for (const [y, x] of hucre) if (bos(y, x) && halka(y, x) >= alan) koy(y, x, KATMAN.cengel);
    };
    if (cengelVar) {
      cengel(c - R, c, -1, 0);
      if (sim === 'dortlu') cengel(c, c - R, 0, -1);
    }

    // 4 köşe basamakları (alanın köşelerinde)
    const s = Math.max(0, Math.min(4, 2 * A - R - 3));
    const koseOlsun = s >= 2 && r() < .85;
    if (koseOlsun) for (let i = 0; i < s; i++) for (let j = 0; j < s - i; j++) {
      if (s >= 3 && i && j && i + j < s - 1) continue;      // büyükse basamaklı kenar
      koy(alan + i, alan + j, KATMAN.kose);
    }
    // ayna simetride alt köşeler farklı: küçük kare motif
    if (sim === 'ayna' && koseOlsun) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) koy(n - 1 - alan - i, alan + j, KATMAN.kose);

    // 5 köşegen motifleri: küçük içi boş dörtgen ya da artı
    const p = Math.floor((R + 3 + 2 * (A - (koseOlsun ? s : 0) - 1)) / 4);
    if (A >= 4 && r() < .85) {
      const artı = r() < .4;
      const m = (y0, x0) => {
        for (const [a, b] of artı ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (bos(y0 + a, x0 + b)) koy(y0 + a, x0 + b, KATMAN.motif);
      };
      if (c - p - 1 >= alan && 2 * p - 1 > R + 1) m(c - p, c - p);
      if (sim === 'ayna' && cengelVar && bos(c + R + 2, c)) m(c + R + 2, c);    // altta çengel yerine motif
    }

    // 6 seyrek dolgu: geniş boş yerlere, hiçbir şeye 8-komşu olmayan tek kareler
    if (r() < .55) {
      const ar = sec(r, [3, 4]), faz = tam(r, 0, ar - 1);
      for (let y = alan; y < n - alan; y++) for (let x = alan; x <= c; x++) {
        if ((y + x + faz) % ar || (y - x + 64) % 2) continue;
        let yakin = false;
        for (let a = -1; a <= 1 && !yakin; a++) for (let b2 = -1; b2 <= 1; b2++) if ((a || b2) && !bos(y + a, x + b2)) { yakin = true; break; }
        if (!yakin && bos(y, x) && halka(y, x) > alan) koy(y, x, KATMAN.dolgu);
      }
    }
    return { katman: g, sim };
  }

  function kabul(g, n) {
    let dolu = 0;
    for (const v of g) if (v) dolu++;
    const oran = dolu / (n * n);
    if (oran < .28 || oran > .62) return false;
    for (let i = 0; i < n; i++) {
      let s = 0, u = 0;
      for (let j = 0; j < n; j++) { if (g[i * n + j]) s++; if (g[j * n + i]) u++; }
      if (s === 0 || u === 0) return false;
    }
    return true;
  }

  // Tekillik düzeltmesi: simetri kırıcı kare değişiklikleri (en çok 6), olmazsa en az başlangıç karesi
  function duzelt(b, katman, hedefBant, butceNs) {
    const n = b.en;
    let t = S.tekillik(b, { dugumButcesi: butceNs });
    if (t.sonuc === 'tek') {
      const dr = D.derece(b, { sinir: hedefBant });
      if (dr.bant !== 'tahmin') return { b, katman, tur: 'yok', degisiklik: 0, derece: dr };
    }
    let kb = b, kk = katman, degisiklik = 0;
    for (let adim = 0; adim < 6 && t.sonuc === 'cok'; adim++) {
      const fark = [];
      for (let i = 0; i < n * n; i++) if (t.cozumler[0][i] !== t.cozumler[1][i]) fark.push(i);
      // tasarıma en az zarar: dolu kareyi boşaltmak yerine bir öğeye bitişik boş kareyi doldurmak; çeyreğin dışına taşmayan
      const puan = (i) => {
        const y = (i / n) | 0, x = i % n;
        let kom = 0;
        for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + a, xx = x + c; if (yy >= 0 && xx >= 0 && yy < n && xx < n && kb.cozum[yy * n + xx]) kom++; }
        return (kb.cozum[i] ? 10 : 0) + (kom === 0 ? 5 : 0) - kom;
      };
      fark.sort((a, c) => puan(a) - puan(c) || a - c);
      const i = fark[0];
      const cozum = kb.cozum.slice(); cozum[i] ^= 1;
      const yk = kk.slice(); yk[i] = cozum[i] ? KATMAN.dolgu : 0;
      kb = M.bulmacaYap({ id: b.id, en: n, boy: n, cozum }); kk = yk; degisiklik++;
      t = S.tekillik(kb, { dugumButcesi: butceNs });
    }
    if (t.sonuc === 'tek') {
      const dr = D.derece(kb, { sinir: hedefBant });
      if (dr.bant !== 'tahmin') return { b: kb, katman: kk, tur: 'kirma', degisiklik, derece: dr };
    }
    // başlangıç kareleri (asıl desen üzerinde: simetri bozulmaz)
    const o = D.baslangicOner(b, { hedefBant, dugumButcesi: butceNs, enCok: 24 });
    if (o) return { b: Object.assign({}, b, { baslangic: o.baslangic }), katman, tur: 'baslangic', degisiklik: 0, baslangicSayisi: o.baslangic.length, derece: o.derece };
    return null;
  }

  // uret(tohum, { boy, hedefBant, butceMs }) → { bulmaca, katman, sim, duzeltme, derece, tohum }
  // Bütçe içinde birkaç desen dener: önce hedef bant, sonra en az başlangıç karesi. Kolaya yaklaştırmak için başlangıç
  // karesi eklenebilir; zor bant yalnız desenin kendisinden gelir (bulunamazsa en yakını).
  const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const BUTCE = { 11: 150, 15: 260, 19: 700, 21: 900 };
  function uret(tohum, o = {}) {
    const n = o.boy || 15, hedef = o.hedefBant || 'orta', butce = o.dugumButcesi ?? 6000, BANT = D.BANTLAR;
    const t0 = simdi(), sure = o.butceMs ?? BUTCE[n] ?? 600, sinir = Math.ceil(n * n * .035);
    let enIyi = null;
    const puan = (x) => x.fark * 1000 + x.duzeltme.baslangic * 10 + x.duzeltme.degisiklik;
    for (let deneme = 0; deneme < (o.enCokDeneme || 40); deneme++) {
      const t = deneme ? `${tohum}.${deneme}` : tohum;
      const { katman, sim } = desen(t, n);
      if (!kabul(katman, n)) continue;
      const cozum = Uint8Array.from(katman, v => (v ? 1 : 0));
      const b = M.bulmacaYap({ id: `kilim-${n}-${tohum}`, en: n, boy: n, cozum });
      const d = duzelt(b, katman, hedef, butce);
      if (d) {
        const fark = Math.abs(BANT.indexOf(hedef) - BANT.indexOf(d.derece.bant));
        const x = { bulmaca: d.b, katman: d.katman, sim, duzeltme: { tur: d.tur, degisiklik: d.degisiklik, baslangic: d.b.baslangic.length }, derece: d.derece, deneme, tohum, fark };
        if (!enIyi || puan(x) < puan(enIyi)) enIyi = x;
        if (x.fark === 0 && x.duzeltme.baslangic <= sinir) break;
      }
      if (enIyi && simdi() - t0 > sure) break;
    }
    if (!enIyi && hedef !== 'orta') return uret(tohum, Object.assign({}, o, { hedefBant: 'orta' }));
    return enIyi;
  }
  // Tarayıcıda: arayüz bir kare çizebilsin diye bir sonraki görev döngüsünde üretir
  const uretAsync = (tohum, o) => new Promise((coz) => setTimeout(() => coz(uret(tohum, o)), 16));

  function ad(tohum) { return `Kilim No. ${100 + karma('kilim-no', tohum) % 900}`; }

  // Renkler: katman → kilim paleti (tohumla dağıtılır); boş kareler krem
  function renkler(katman, tohum) {
    const r = rastgele('kilim-renk', tohum);
    const ana = r() < .5 ? ['kirmizi', 'lacivert'] : ['lacivert', 'kirmizi'];
    const harita = {
      [KATMAN.cerceve]: ana[1], [KATMAN.ic]: ana[0], [KATMAN.kose]: r() < .5 ? 'hardal' : ana[1],
      [KATMAN.madalyon]: ana[0], [KATMAN.cekirdek]: 'hardal', [KATMAN.cengel]: r() < .6 ? 'kahve' : ana[1],
      [KATMAN.motif]: r() < .5 ? 'hardal' : ana[1], [KATMAN.dolgu]: 'kahve',
    };
    return Array.from(katman, v => (v ? PALET[harita[v]] : null));
  }

  // Oyunun resim biçimi
  function resim(tohum, o = {}) {
    const n = o.boy || 15, u = uret(tohum, o);
    const b = u.bulmaca, renk = renkler(u.katman, tohum);
    // madalyon halkaları sırayla iki renk: içten dışa
    const c = Math.floor(n / 2), ana = renk.find((h, i) => u.katman[i] === KATMAN.madalyon);
    if (ana) {
      const ikinci = ana === PALET.kirmizi ? PALET.hardal : PALET.kirmizi;
      for (let i = 0; i < n * n; i++) if (u.katman[i] === KATMAN.madalyon) { const d = Math.abs(((i / n) | 0) - c) + Math.abs(i % n - c); if (Math.floor(d / 2) % 2) renk[i] = ikinci; }
    }
    for (let i = 0; i < n * n; i++) if (b.cozum[i] && !renk[i]) renk[i] = PALET.kahve;
    return {
      id: `kilim-${n}-${tohum}`, ad: ad(tohum), tur: 'kilim', defter: 'kilim', tohum, en: n, boy: n, cozum: b.cozum,
      renk: Array.from(b.cozum, (v, i) => (v ? renk[i] : null)), zemin: Array.from(b.cozum, v => (v ? null : PALET.krem)),
      baslangic: b.baslangic, bant: u.derece.bant, puan: u.derece.puan, duzeltme: u.duzeltme, sim: u.sim,
    };
  }

  const K = { uret, uretAsync, resim, desen, kabul, ad, renkler, karma, rastgele, KATMAN, PALET };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).kilim = K;
  if (node) module.exports = K;
})();
