// gen.js — tohumlu pist üretici ve Günün Pisti (DOM'a dokunmaz).
// Gürültülü kutupsal kapalı eğri (kendini kesmez) → değişken genişlikli şerit → hücreler. Başlangıç çizgisi en düz,
// eksene en yakın yere; kontrol noktaları eşit aralıkla. BFS ile doğrulanır: par aralıkta değilse tohum ilerler.
(function () {
  'use strict';

  const dugum = typeof module !== 'undefined' && module.exports;
  const T = dugum ? require('./track.js') : window.KR.track;
  const R = dugum ? require('./rules.js') : window.KR.rules;
  const A = dugum ? require('./ai.js') : window.KR.ai;

  function rastgele(...p) {
    let a = A.fnv(p.join('|'));
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const M = 360;

  function egri(r, W, H) {
    const har = [];
    for (let k = 2; k <= 5; k++) har.push({ k, a: (.08 + r() * .26) / k * (k === 2 ? 1.5 : 1), f: r() * 2 * Math.PI });
    const w0 = 4 + r() * 3, psi = r() * 2 * Math.PI;
    const ham = [];
    for (let j = 0; j < M; j++) {
      const th = j / M * 2 * Math.PI;
      let rr = 1;
      for (const h of har) rr += h.a * Math.sin(h.k * th + h.f);
      ham.push({ x: Math.cos(th) * rr, y: Math.sin(th) * rr, w: Math.max(4, Math.min(7, w0 + .8 * Math.sin(th + psi))) });
    }
    // sığdır: kenarlarda en az 1 hücre + yarım genişlik pay
    const wmax = Math.max(...ham.map(q => q.w)) / 2 + 1;
    const xs = ham.map(q => q.x), ys = ham.map(q => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const sx = (W - 2 * wmax) / (x1 - x0), sy = (H - 2 * wmax) / (y1 - y0);
    return ham.map(q => ({ x: wmax + (q.x - x0) * sx, y: wmax + (q.y - y0) * sy, w: q.w }));
  }

  function rasterize(W, H, pts) {
    const g = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const px = c + .5, py = r + .5;
      for (let j = 0; j < M; j++) {
        const a = pts[j], b = pts[(j + 1) % M];
        if (Math.abs(a.x - px) > 5 && Math.abs(b.x - px) > 5) continue;
        const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
        let t = L ? ((px - a.x) * dx + (py - a.y) * dy) / L : 0;
        t = Math.max(0, Math.min(1, t));
        if (Math.hypot(px - a.x - t * dx, py - a.y - t * dy) <= (a.w + (b.w - a.w) * t) / 2) { g[r * W + c] = 1; break; }
      }
    }
    return g;
  }

  // İnce çim (dört köşesi yasal) asfalt olur; en büyük asfalt parçası kalır.
  function temizle(W, H, g) {
    const as = (c, r) => c >= 0 && r >= 0 && c < W && r < H && g[r * W + c] === 1;
    const yasal = (x, y) => as(x - 1, y - 1) || as(x, y - 1) || as(x - 1, y) || as(x, y);
    for (let tur = 0; tur < 20; tur++) {
      let deg = 0;
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++)
        if (!g[r * W + c] && yasal(c, r) && yasal(c + 1, r) && yasal(c, r + 1) && yasal(c + 1, r + 1)) { g[r * W + c] = 1; deg++; }
      if (!deg) break;
    }
    const etiket = new Int32Array(W * H).fill(-1), boy = [];
    for (let i = 0; i < W * H; i++) {
      if (!g[i] || etiket[i] >= 0) continue;
      const k = boy.length, q = [i]; etiket[i] = k; let n = 0;
      while (q.length) {
        const u = q.pop(); n++;
        const c = u % W, r = (u - c) / W;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (as(c + dc, r + dr)) { const v = (r + dr) * W + c + dc; if (etiket[v] < 0) { etiket[v] = k; q.push(v); } }
        }
      }
      boy.push(n);
    }
    const en = boy.indexOf(Math.max(...boy));
    for (let i = 0; i < W * H; i++) if (g[i] && etiket[i] !== en) g[i] = 0;
    return g;
  }

  function teget(pts, j) {
    const a = pts[(j - 2 + M) % M], b = pts[(j + 2) % M];
    return [b.x - a.x, b.y - a.y];
  }

  // j örneğinde eksene dik tam kesit; yön sürüş yönü.
  function cizgiDene(p, pts, j) {
    const [tx, ty] = teget(pts, j), q = pts[j];
    const dikey = Math.abs(tx) >= Math.abs(ty);
    const z = dikey
      ? T.kesitBul(p, true, Math.round(q.x), Math.floor(q.y), [Math.sign(tx), 0])
      : T.kesitBul(p, false, Math.floor(q.x), Math.round(q.y), [0, Math.sign(ty)]);
    if (!z) return null;
    return T.cizgiDogrula(p, T.cizgiNormal(z), 'c').length ? null : z;
  }

  function sapma(pts, j) { const [tx, ty] = teget(pts, j); return Math.atan2(Math.min(Math.abs(tx), Math.abs(ty)), Math.max(Math.abs(tx), Math.abs(ty))); }
  function egrilik(pts, j) {
    let s = 0;
    for (let k = -12; k < 12; k++) {
      const [a, b] = teget(pts, (j + k + M) % M), [c, d] = teget(pts, (j + k + 1 + M) % M);
      s += Math.abs(Math.atan2(a * d - b * c, a * c + b * d));
    }
    return s;
  }

  function haritaMetni(W, H, g) {
    const s = [];
    for (let r = 0; r < H; r++) { let t = ''; for (let c = 0; c < W; c++) t += g[r * W + c] ? '#' : '.'; s.push(t); }
    return s.join('\n');
  }

  // Tek tohumdan pist tanımı (doğrulanmamış par ile). Geçersizse { hata }.
  function uret(tohum, o = {}) {
    const W = o.W || 40, H = o.H || 26, r = rastgele(tohum);
    const pts = egri(r, W, H);
    const g = temizle(W, H, rasterize(W, H, pts));
    const tanim = { kimlik: 'gen-' + A.fnv(String(tohum)).toString(36), ad: o.ad || 'Günün Pisti', tur: 1, par: 0, harita: haritaMetni(W, H, g),
      bitis: { a: [0, 0], b: [0, 1], yon: [1, 0] }, kontrol: [], baslangic: [] };
    let p = T.ayristir(tanim);
    // başlangıç çizgisi: eksene ≤ 20°, en düz yer
    const adaylar = [];
    for (let j = 0; j < M; j += 3) if (sapma(pts, j) <= 20 * Math.PI / 180) adaylar.push({ j, e: egrilik(pts, j) + sapma(pts, j) });
    adaylar.sort((a, b) => a.e - b.e);
    let bj = -1;
    for (const a of adaylar) {
      const z = cizgiDene(p, pts, a.j);
      if (!z) continue;
      const L = z.a[0] === z.b[0] ? z.b[1] - z.a[1] : z.b[0] - z.a[0];
      if (L < 4) continue;
      tanim.bitis = z; bj = a.j; break;
    }
    if (bj < 0) return { hata: 'başlangıç çizgisi yok' };
    const z = T.cizgiNormal(tanim.bitis), L = z.dikey ? z.b[1] - z.a[1] : z.b[0] - z.a[0], m = Math.round(L / 2);
    tanim.baslangic = [m - 1, m, m + 1, m - 2].map(k => (z.dikey ? [z.a[0], z.a[1] + k] : [z.a[0] + k, z.a[1]]));
    const kontrolBul = (adet) => {
      const l = [];
      for (let n = 1; n <= adet; n++) {
        let bulundu = null;
        for (let k = 0; k < 40 && !bulundu; k++) for (const s of k ? [k, -k] : [0]) {
          const j = (bj + Math.round(n * M / (adet + 1)) + s * 2 + M * 2) % M;
          const c = cizgiDene(p, pts, j);
          if (c) { bulundu = c; break; }
        }
        if (!bulundu) return null;
        l.push(bulundu);
      }
      return l;
    };
    tanim.kontrol = kontrolBul(2);
    if (!tanim.kontrol) return { hata: 'kontrol noktası yok' };
    p = T.ayristir(tanim);
    const hata = T.dogrula(p);
    if (hata.length) return { hata: hata[0] };
    return { tanim, p };
  }

  // Doğrulama: BFS par aralıkta, noktaların ≥ %95'i bitişe ulaşabilir.
  function dogrulaUret(tohum, o = {}) {
    const u = uret(tohum, o);
    if (!u.tanim) return u;
    const h = A.olc(u.p, { tur: 1 });
    const alt = o.parAlt || 18, ust = o.parUst || 40;
    if (!(h.par >= alt && h.par <= ust)) return { hata: 'par ' + h.par };
    const pot = R.potansiyel(u.p);
    let ulasir = 0;
    for (let i = 0; i < u.p.NP; i++) if (pot[i * (u.p.N + 1)] < 32767) ulasir++;
    if (ulasir < .95 * u.p.NP) return { hata: 'ulaşılamayan bölge' };
    u.tanim.par = h.par;
    return { tanim: u.tanim, p: u.p, harita: h };
  }

  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const yerelTarih = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const tarihYazi = (tarih) => { const [, a, g] = tarih.split('-').map(Number); return `${g} ${AYLAR[a - 1]}`; };

  function gununPisti(tarih, o = {}) {
    const enCok = o.enCokDeneme || 40;
    for (let deneme = 0; deneme < enCok; deneme++) {
      const u = dogrulaUret(`gun|${tarih}|${deneme}`, o);
      if (u.tanim) {
        u.tanim.kimlik = 'gun-' + tarih;
        u.tanim.ad = 'Günün Pisti';
        return { tanim: u.tanim, p: T.ayristir(u.tanim), harita: u.harita, deneme };
      }
    }
    return null;
  }

  const paylasimMetni = (tarih, hamle, ideal) => `Kağıt Rallisi · ${tarihYazi(tarih)} · ${hamle} hamle (ideal ${ideal})`;

  const G = { rastgele, uret, dogrulaUret, gununPisti, yerelTarih, tarihYazi, paylasimMetni, AYLAR };
  if (typeof window !== 'undefined') (window.KR = window.KR || {}).gen = G;
  if (typeof module !== 'undefined' && module.exports) module.exports = G;
})();
