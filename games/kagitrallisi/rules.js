// rules.js — Kağıt Rallisi kural motoru (DOM'a dokunmaz). Durum değişmezdir: her hamle yeni nesne döndürür.
// Hamle: v' = v + a, a ∈ {−1,0,1}²; P' = P + v'. Yasallık hücre tabanlıdır: parça asfalt olmayan bir hücrenin
// İÇİNDEN geçerse çarpma; kenar boyunca gitmek ve köşeye değmek serbest.
// Çizgi geçişi: s(P) = (P − a)·yon; s0 < 0 ≤ s1 ileri, s0 ≥ 0 > s1 ters (bitişte ters = duvar).
(function () {
  'use strict';

  const R = {};

  function ebob(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

  // Çapraz ilkel parça (|sx|, |sy| aralarında asal) için ızgara çizgisi kesişim anları, 1/(A·B) biriminde.
  const anlarBellek = new Map();
  function anlar(A, B) {
    const k = A * 64 + B;
    let t = anlarBellek.get(k);
    if (!t) {
      t = [0];
      for (let i = 1; i < A; i++) t.push(i * B);
      for (let j = 1; j < B; j++) t.push(j * A);
      t.push(A * B);
      t.sort((a, b) => a - b);
      anlarBellek.set(k, t);
    }
    return t;
  }

  // P1 → P2 parçası yasal mı? { yasal, carpmaT } — carpmaT: ilk asfalt dışı hücreye giriş anı (0–1).
  function parcaYasal(p, x1, y1, x2, y2) {
    if (!p.yasal(x1, y1)) return { yasal: false, carpmaT: 0 };
    const dx = x2 - x1, dy = y2 - y1, g = ebob(dx, dy);
    if (!g) return { yasal: true, carpmaT: null };
    const sx = dx / g, sy = dy / g, A = Math.abs(sx), B = Math.abs(sy);
    for (let k = 0; k < g; k++) {
      const x = x1 + sx * k, y = y1 + sy * k;
      if (sy === 0) {
        const c = Math.min(x, x + sx);
        if (!p.asfalt(c, y - 1) && !p.asfalt(c, y)) return { yasal: false, carpmaT: k / g };
      } else if (sx === 0) {
        const r = Math.min(y, y + sy);
        if (!p.asfalt(x - 1, r) && !p.asfalt(x, r)) return { yasal: false, carpmaT: k / g };
      } else {
        const t = anlar(A, B), AB2 = 2 * A * B;
        for (let j = 0; j < t.length - 1; j++) {
          const m2 = t[j] + t[j + 1];
          const c = x + Math.floor(sx * m2 / AB2), r = y + Math.floor(sy * m2 / AB2);
          if (!p.asfalt(c, r)) return { yasal: false, carpmaT: (k + t[j] / (A * B)) / g };
        }
      }
    }
    return { yasal: true, carpmaT: null };
  }

  // Parçanın geçtiği çizgiler, t sırasıyla: [{ cizgi (0 bitiş, 1..N kontrol), ileri, t, s1 }]
  function gecisler(p, x1, y1, x2, y2) {
    const l = [];
    for (let k = 0; k < p.cizgiler.length; k++) {
      const z = p.cizgiler[k];
      const s0 = (x1 - z.a[0]) * z.yon[0] + (y1 - z.a[1]) * z.yon[1];
      const s1 = (x2 - z.a[0]) * z.yon[0] + (y2 - z.a[1]) * z.yon[1];
      let ileri;
      if (s0 < 0 && s1 >= 0) ileri = true;
      else if (s0 >= 0 && s1 < 0) ileri = false;
      else continue;
      const t = s0 / (s0 - s1);
      const u = z.dikey ? y1 + (y2 - y1) * t : x1 + (x2 - x1) * t;
      const [lo, hi] = z.dikey ? [z.a[1], z.b[1]] : [z.a[0], z.b[0]];
      if (u < lo - 1e-9 || u > hi + 1e-9) continue;
      l.push({ cizgi: k, ileri, t, s1 });
    }
    return l.sort((a, b) => a.t - b.t);
  }

  // Kontrol noktası sayacı ve tur ilerlemesi. hedefTur: yarışın tur sayısı.
  function ilerleme(N, hedefTur, sayac, tur, gec) {
    for (const g of gec) {
      if (!g.ileri) continue;
      if (g.cizgi === 0) {
        if (sayac === N) {
          tur++; sayac = 0;
          if (tur >= hedefTur) return { sayac, tur, bitti: true, asim: g.s1 };
        }
      } else if (sayac === g.cizgi - 1) sayac = g.cizgi;
    }
    return { sayac, tur, bitti: false, asim: 0 };
  }

  function kesisir(a, b) {
    const yon = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    const ustunde = (p, q, r) => Math.min(p[0], r[0]) <= q[0] && q[0] <= Math.max(p[0], r[0]) && Math.min(p[1], r[1]) <= q[1] && q[1] <= Math.max(p[1], r[1]);
    const p1 = [a.x1, a.y1], q1 = [a.x2, a.y2], p2 = [b.x1, b.y1], q2 = [b.x2, b.y2];
    const o1 = yon(p1, q1, p2), o2 = yon(p1, q1, q2), o3 = yon(p2, q2, p1), o4 = yon(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    return (!o1 && ustunde(p1, p2, q1)) || (!o2 && ustunde(p1, q2, q1)) || (!o3 && ustunde(p2, p1, q2)) || (!o4 && ustunde(p2, q1, q2));
  }

  /* ---------- yarış ---------- */

  const AYAR = { tur: 1, carpma: 'okul', kesisme: true, yerindeDurma: 'zorunlu' };

  // oyuncular: [{ ad, renk, ... }]; o.sira: hamle sırası (oyuncu indeksleri), varsayılan 0..n-1.
  // sira[k]. araba baslangic[k] noktasından çıkar.
  function yeniYaris(p, ayar, oyuncular, o = {}) {
    ayar = Object.assign({}, AYAR, ayar);
    const sira = o.sira ? o.sira.slice() : oyuncular.map((_, i) => i);
    const arabalar = oyuncular.map((oy) => ({
      ad: oy.ad, renk: oy.renk, x: 0, y: 0, vx: 0, vy: 0, sayac: 0, tur: 0, durum: 'yarisiyor',
      hamle: 0, bekle: 0, carpma: 0, iz: [], carpmalar: [], son: null, bitisTur: 0, asim: 0, elenmeTur: 0,
    }));
    sira.forEach((i, k) => {
      const [x, y] = p.baslangic.length ? p.baslangic[k % p.baslangic.length] : p.noktalar[k % p.NP];
      Object.assign(arabalar[i], { x, y, iz: [[x, y]] });
    });
    return { pist: p, ayar, arabalar, sira, siradaki: 0, turNo: 1, bitti: false, siralama: null, turParcalari: [], olaylar: [] };
  }

  const siradakiAraba = (d) => (d.bitti ? -1 : d.sira[d.siradaki]);

  // Dokuz aday, a = (ax, ay): satır satır ay = −1, 0, 1; her satırda ax = −1, 0, 1.
  function adaylar(d, i) {
    const p = d.pist, a = d.arabalar[i], l = [];
    const dolu = new Set();
    d.arabalar.forEach((b, j) => { if (j !== i && b.durum === 'yarisiyor') dolu.add(b.x + ',' + b.y); });
    for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
      const vx = a.vx + ax, vy = a.vy + ay, x = a.x + vx, y = a.y + vy;
      const c = { ax, ay, vx, vy, x, y, yasal: false, neden: null, carpmaT: null, gecisler: [], ilerleme: null };
      if (!vx && !vy) { c.neden = 'yerinde'; l.push(c); continue; }
      const pr = parcaYasal(p, a.x, a.y, x, y);
      if (!pr.yasal) { c.neden = 'duvar'; c.carpmaT = pr.carpmaT; l.push(c); continue; }
      c.gecisler = gecisler(p, a.x, a.y, x, y);
      const ters = c.gecisler.find(g => g.cizgi === 0 && !g.ileri);
      if (ters) { c.neden = 'ters'; c.carpmaT = ters.t; l.push(c); continue; }
      if (dolu.has(x + ',' + y)) { c.neden = 'dolu'; l.push(c); continue; }
      if (!d.ayar.kesisme && d.turParcalari.some(s => s.i !== i && kesisir(s, { x1: a.x, y1: a.y, x2: x, y2: y }))) { c.neden = 'kesisme'; l.push(c); continue; }
      c.yasal = true;
      l.push(c);
    }
    const yer = l.find(c => c.neden === 'yerinde');
    if (yer && (d.ayar.yerindeDurma === 'serbest' || !l.some(c => c.yasal))) { yer.yasal = true; yer.neden = null; }
    for (const c of l) if (c.yasal) c.ilerleme = ilerleme(p.N, d.ayar.tur, a.sayac, a.tur, c.gecisler);
    return l;
  }

  function kopya(d) {
    return Object.assign({}, d, {
      arabalar: d.arabalar.map(a => Object.assign({}, a, { iz: a.iz.slice(), carpmalar: a.carpmalar.slice() })),
      turParcalari: d.turParcalari.slice(), olaylar: [],
    });
  }

  // k: aday indeksi (0–8). Yasal aday yokken k = null ile çağrılır: çarpma.
  function hamleYap(d0, i, k) {
    if (d0.bitti) throw new Error('yarış bitti');
    if (siradakiAraba(d0) !== i) throw new Error('sıra bu arabada değil');
    const l = adaylar(d0, i), yasalVar = l.some(c => c.yasal);
    const d = kopya(d0), a = d.arabalar[i];
    if (k == null || !l[k] || !l[k].yasal) {
      if (yasalVar) throw new Error('yasal aday varken çarpılamaz');
      // çarpma noktası: hızla düz gitseydi duvara değeceği yer
      const ornek = [l[4], ...l].find(c => c && (c.neden === 'duvar' || c.neden === 'ters'));
      const t = ornek ? ornek.carpmaT : 0;
      const cx = ornek ? a.x + (ornek.x - a.x) * t : a.x, cy = ornek ? a.y + (ornek.y - a.y) * t : a.y;
      a.hamle++; a.carpma++;
      a.carpmalar.push([a.x, a.y, cx, cy]);
      a.son = { x1: a.x, y1: a.y, x2: a.x, y2: a.y, carpti: true, cx, cy, vx: a.vx, vy: a.vy };
      a.vx = 0; a.vy = 0;
      if (d.ayar.carpma === 'sert') { a.durum = 'elendi'; a.elenmeTur = d.turNo; d.olaylar.push({ tip: 'elendi', i }); }
      else { a.bekle = 1; d.olaylar.push({ tip: 'carpti', i }); }
    } else {
      const c = l[k];
      a.son = { x1: a.x, y1: a.y, x2: c.x, y2: c.y, carpti: false };
      d.turParcalari.push({ i, x1: a.x, y1: a.y, x2: c.x, y2: c.y });
      Object.assign(a, { x: c.x, y: c.y, vx: c.vx, vy: c.vy, sayac: c.ilerleme.sayac, tur: c.ilerleme.tur });
      a.iz.push([c.x, c.y]);
      a.hamle++;
      d.olaylar.push({ tip: 'hamle', i, k });
      if (c.gecisler.some(g => g.ileri && g.cizgi > 0 && g.cizgi === c.ilerleme.sayac)) d.olaylar.push({ tip: 'kontrol', i, no: c.ilerleme.sayac });
      if (c.ilerleme.bitti) {
        a.durum = 'bitirdi'; a.bitisTur = d.turNo; a.asim = c.ilerleme.asim;
        d.olaylar.push({ tip: 'bitirdi', i });
      } else if (c.ilerleme.tur > d0.arabalar[i].tur) d.olaylar.push({ tip: 'tur', i, tur: c.ilerleme.tur });
    }
    siraIlerlet(d);
    return d;
  }

  function siraIlerlet(d) {
    for (let guvenlik = 0; guvenlik < 1000; guvenlik++) {
      d.siradaki++;
      if (d.siradaki >= d.sira.length) {
        const bitiren = d.arabalar.some(a => a.durum === 'bitirdi' && a.bitisTur === d.turNo);
        const kalan = d.arabalar.some(a => a.durum === 'yarisiyor');
        if (bitiren || !kalan) { d.bitti = true; d.siralama = siralama(d); d.olaylar.push({ tip: 'yarisBitti' }); return; }
        d.turNo++; d.siradaki = 0; d.turParcalari = [];
      }
      const j = d.sira[d.siradaki], a = d.arabalar[j];
      if (a.durum !== 'yarisiyor') continue;
      if (a.bekle > 0) { a.bekle--; a.hamle++; d.olaylar.push({ tip: 'bekledi', i: j }); continue; }
      return;
    }
  }

  /* ---------- potansiyel: hızsız en az birim adım (sıralama, kolay bilgisayar) ---------- */

  function potansiyel(p) {
    if (p._pot) return p._pot;
    const S = p.N + 1, NS = p.NP * S, ters = Array.from({ length: NS }, () => []);
    const pot = new Int16Array(NS).fill(32767), kuyruk = [];
    for (let i = 0; i < p.NP; i++) {
      const [x, y] = p.noktalar[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = p.ni(x + dx, y + dy);
        if (j < 0 || !parcaYasal(p, x, y, x + dx, y + dy).yasal) continue;
        const g = gecisler(p, x, y, x + dx, y + dy);
        if (g.some(z => z.cizgi === 0 && !z.ileri)) continue;
        for (let s = 0; s < S; s++) {
          const il = ilerleme(p.N, 1, s, 0, g);
          if (il.bitti) { if (pot[i * S + s] > 1) { pot[i * S + s] = 1; kuyruk.push(i * S + s); } }
          else ters[j * S + il.sayac].push(i * S + s);
        }
      }
    }
    for (let k = 0; k < kuyruk.length; k++) {
      const u = kuyruk[k];
      for (const v of ters[u]) if (pot[v] > pot[u] + 1) { pot[v] = pot[u] + 1; kuyruk.push(v); }
    }
    Object.defineProperty(p, '_pot', { value: pot, enumerable: false });
    return pot;
  }
  const potDeger = (p, x, y, sayac) => { const i = p.ni(x, y); return i < 0 ? 32767 : potansiyel(p)[i * (p.N + 1) + sayac]; };

  /* ---------- sıralama, seri ---------- */

  function siralama(d) {
    const p = d.pist;
    const anahtar = (a) => {
      if (a.durum === 'bitirdi') return [0, a.bitisTur, -a.asim];
      if (a.durum === 'yarisiyor') return [1, -a.tur, -a.sayac, potDeger(p, a.x, a.y, a.sayac)];
      return [2, -a.elenmeTur];
    };
    const l = d.arabalar.map((a, i) => ({ i, k: anahtar(a), durum: a.durum === 'yarisiyor' ? 'bitiremedi' : a.durum }));
    const kars = (u, v) => { for (let j = 0; j < Math.max(u.length, v.length); j++) { const f = (u[j] ?? 0) - (v[j] ?? 0); if (f) return f; } return 0; };
    l.sort((u, v) => kars(u.k, v.k) || u.i - v.i);
    let yer = 0;
    l.forEach((e, j) => { if (!j || kars(l[j - 1].k, e.k)) yer = j + 1; e.yer = yer; });
    l.forEach(e => delete e.k);
    return l;
  }

  const seriPuani = (yer) => [0, 3, 2, 1][yer] || 0;

  /* ---------- fren izi ---------- */

  // Her turda hız bileşenleri sıfıra doğru 1 azalırsa gidilecek yol. carpma: duvara değen parça indeksi (yoksa −1).
  function frenIzi(d, i) {
    const p = d.pist, a = d.arabalar[i];
    let x = a.x, y = a.y, vx = a.vx, vy = a.vy;
    const noktalar = [[x, y]];
    const azalt = (v) => v - Math.sign(v);
    while (vx || vy) {
      vx = azalt(vx); vy = azalt(vy);
      if (!vx && !vy) break;
      const pr = parcaYasal(p, x, y, x + vx, y + vy);
      const ters = pr.yasal && gecisler(p, x, y, x + vx, y + vy).some(g => g.cizgi === 0 && !g.ileri);
      if (!pr.yasal || ters) {
        const t = pr.yasal ? 1 : pr.carpmaT;
        noktalar.push([x + vx * t, y + vy * t]);
        return { noktalar, carpma: noktalar.length - 2 };
      }
      x += vx; y += vy;
      noktalar.push([x, y]);
    }
    return { noktalar, carpma: -1 };
  }

  Object.assign(R, {
    AYAR, ebob, parcaYasal, gecisler, ilerleme, kesisir,
    yeniYaris, siradakiAraba, adaylar, hamleYap, siralama, seriPuani, frenIzi, potansiyel, potDeger,
    prog: (p, a) => a.tur * (p.N + 1) + a.sayac,
  });

  if (typeof window !== 'undefined') (window.KR = window.KR || {}).rules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})();
