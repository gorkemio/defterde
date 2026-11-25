// ai.js — BFS ile pist ölçümü, par, ideal çizgi ve bilgisayar sürücüler (DOM'a dokunmaz).
// Durum uzayı: (nokta, vx, vy, prog), |vx|,|vy| ≤ VM; prog = tamamlanan tur · (N+1) + kontrol sayacı.
// kalan[durum] = bitişe en az hamle (255: bilinmiyor / ulaşılamaz). Bitişten geriye BFS; hesap üreteçle dilimlenir.
(function () {
  'use strict';

  const R = typeof module !== 'undefined' && module.exports ? require('./rules.js') : window.KR.rules;
  const BITTI = -1, BILINMIYOR = 255;

  function fnv(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function onbellekAnahtari(p, tur = 1, VM = 9) {
    const icerik = [p.harita, JSON.stringify(p.cizgiler.map(z => [z.a, z.b, z.yon])), JSON.stringify(p.baslangic), tur, VM].join('|');
    return 'kr-olcu-v1-' + fnv(icerik).toString(36) + '-' + icerik.length.toString(36);
  }

  // Geçiş kodu (5 tabanı, t sırasıyla): 1 bitiş, k+1 kontrol k. prog'a uygulanır.
  function progIlerle(kod, prog, N, tur) {
    let tamam = Math.floor(prog / (N + 1)), s = prog % (N + 1);
    while (kod) {
      const d = kod % 5; kod = (kod - d) / 5;
      if (d === 1) { if (s === N) { tamam++; s = 0; if (tamam >= tur) return BITTI; } }
      else if (s === d - 2) s = d - 1;
    }
    return tamam * (N + 1) + s;
  }

  function* olcAdimli(p, o = {}) {
    const tur = o.tur || 1, VM = o.hiz || 9, D = 2 * VM + 1, NV = D * D, N = p.N, PC = tur * (N + 1), NP = p.NP;
    const parca = new Uint8Array(NP * NV), kod = new Uint16Array(NP * NV), kodlar = new Set();
    for (let i = 0; i < NP; i++) {
      const [x, y] = p.noktalar[i];
      for (let vx = -VM; vx <= VM; vx++) for (let vy = -VM; vy <= VM; vy++) {
        if (!vx && !vy) continue;
        const qx = x - vx, qy = y - vy;
        if (!p.yasal(qx, qy) || !R.parcaYasal(p, qx, qy, x, y).yasal) continue;
        const g = R.gecisler(p, qx, qy, x, y);
        if (g.some(z => z.cizgi === 0 && !z.ileri)) continue;
        let k = 0, c = 1;
        for (const z of g) if (z.ileri) { k += (z.cizgi === 0 ? 1 : z.cizgi + 1) * c; c *= 5; }
        const j = i * NV + (vx + VM) * D + vy + VM;
        parca[j] = 1; kod[j] = k; kodlar.add(k);
      }
      if (i % 40 === 39) yield .5 * i / NP;
    }
    const onceki = new Map(), bitis = new Map();
    for (const k of kodlar) for (let s = 0; s < PC; s++) {
      const r = progIlerle(k, s, N, tur);
      const anahtar = r === BITTI ? k : k * PC + r, m = r === BITTI ? bitis : onceki;
      if (!m.has(anahtar)) m.set(anahtar, []);
      m.get(anahtar).push(s);
    }
    const NS = NP * NV * PC, kalan = new Uint8Array(NS).fill(BILINMIYOR), q = new Int32Array(NS);
    let qb = 0, qs = 0;
    const oncullerEkle = (i, vi, progs, d) => {
      const vx = Math.floor(vi / D) - VM, vy = vi % D - VM, [x, y] = p.noktalar[i];
      const qi = p.ni(x - vx, y - vy);
      for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) {
        const ux = vx - ax, uy = vy - ay;
        if (ux < -VM || ux > VM || uy < -VM || uy > VM) continue;
        const taban = (qi * NV + (ux + VM) * D + uy + VM) * PC;
        for (const s0 of progs) { const s = taban + s0; if (kalan[s] === BILINMIYOR) { kalan[s] = d; q[qs++] = s; } }
      }
    };
    for (let j = 0; j < NP * NV; j++) {
      if (!parca[j]) continue;
      const l = bitis.get(kod[j]);
      if (l) oncullerEkle(Math.floor(j / NV), j % NV, l, 1);
    }
    let adim = 0;
    while (qb < qs) {
      const s = q[qb++], d = kalan[s];
      if (d >= 254) continue;
      const prog = s % PC, t = (s - prog) / PC, j = t;
      if (!parca[j]) continue;
      const l = onceki.get(kod[j] * PC + prog);
      if (l) oncullerEkle(Math.floor(j / NV), j % NV, l, d + 1);
      if (++adim % 40000 === 0) yield .5 + .5 * qb / qs;
    }
    const h = { kalan, VM, D, NV, PC, N, tur, NP, anahtar: onbellekAnahtari(p, tur, VM) };
    h.par = par(h, p);
    return h;
  }

  function olc(p, o) {
    const g = olcAdimli(p, o);
    for (;;) { const r = g.next(); if (r.done) return r.value; }
  }

  // Tarayıcı için dilimli ölçüm: her dilimde en çok dilimMs çalışır, setTimeout ile kontrolü bırakır.
  function olcAsync(p, o = {}, s = {}) {
    const g = olcAdimli(p, o), dilim = s.dilimMs || 12;
    return new Promise((coz, red) => {
      const tur = () => {
        if (s.iptal && s.iptal()) return red(new Error('iptal'));
        const t0 = Date.now();
        try {
          for (;;) {
            const r = g.next();
            if (r.done) return coz(r.value);
            if (s.ilerleme) s.ilerleme(r.value);
            if (Date.now() - t0 > dilim) break;
          }
        } catch (e) { return red(e); }
        setTimeout(tur, 0);
      };
      setTimeout(tur, 0);
    });
  }

  function kalanAl(h, p, x, y, vx, vy, prog) {
    const i = p.ni(x, y);
    if (i < 0 || Math.abs(vx) > h.VM || Math.abs(vy) > h.VM || prog >= h.PC) return BILINMIYOR;
    return h.kalan[(i * h.NV + (vx + h.VM) * h.D + vy + h.VM) * h.PC + prog];
  }

  function par(h, p) {
    let m = BILINMIYOR;
    for (const [x, y] of p.baslangic) m = Math.min(m, kalanAl(h, p, x, y, 0, 0, 0));
    return m;
  }

  // Başlangıçtan en kısa yol: her adımda kalan'ı en küçük ardıl (eşitlikte hızlı olan).
  function idealYol(h, p, bas) {
    if (!bas) {
      let m = BILINMIYOR;
      for (const b of p.baslangic) { const v = kalanAl(h, p, b[0], b[1], 0, 0, 0); if (v < m) { m = v; bas = b; } }
      if (!bas) return [];
    }
    let [x, y] = bas, vx = 0, vy = 0, sayac = 0, tur = 0;
    const yol = [[x, y]];
    for (let adim = 0; adim < 400; adim++) {
      let en = null;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        const nvx = vx + ax, nvy = vy + ay;
        if (!nvx && !nvy) continue;
        const nx = x + nvx, ny = y + nvy;
        if (!p.yasal(nx, ny) || !R.parcaYasal(p, x, y, nx, ny).yasal) continue;
        const g = R.gecisler(p, x, y, nx, ny);
        if (g.some(z => z.cizgi === 0 && !z.ileri)) continue;
        const il = R.ilerleme(p.N, h.tur, sayac, tur, g);
        const v = il.bitti ? 0 : kalanAl(h, p, nx, ny, nvx, nvy, il.tur * (p.N + 1) + il.sayac);
        if (v >= BILINMIYOR) continue;
        const hiz = nvx * nvx + nvy * nvy;
        if (!en || v < en.v || (v === en.v && hiz > en.hiz)) en = { v, hiz, nx, ny, nvx, nvy, il };
      }
      if (!en) break;
      x = en.nx; y = en.ny; vx = en.nvx; vy = en.nvy; sayac = en.il.sayac; tur = en.il.tur;
      yol.push([x, y]);
      if (en.il.bitti) break;
    }
    return yol;
  }

  /* ---------- önbellek: RLE + base64 ---------- */

  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64(u) {
    let s = '';
    for (let i = 0; i < u.length; i += 3) {
      const a = u[i], b = u[i + 1] ?? 0, c = u[i + 2] ?? 0, n = (a << 16) | (b << 8) | c;
      s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < u.length ? B64[n >> 6 & 63] : '=') + (i + 2 < u.length ? B64[n & 63] : '=');
    }
    return s;
  }
  function b64coz(s) {
    const l = s.replace(/=+$/, ''), u = new Uint8Array(Math.floor(l.length * 3 / 4));
    let k = 0;
    for (let i = 0; i < l.length; i += 4) {
      const n = (B64.indexOf(l[i]) << 18) | (B64.indexOf(l[i + 1]) << 12) | ((B64.indexOf(l[i + 2]) & 63) << 6) | (B64.indexOf(l[i + 3]) & 63);
      if (k < u.length) u[k++] = n >> 16 & 255;
      if (k < u.length) u[k++] = n >> 8 & 255;
      if (k < u.length) u[k++] = n & 255;
    }
    return u;
  }
  function paketle(h) {
    const k = h.kalan, l = [];
    for (let i = 0; i < k.length;) {
      let j = i;
      while (j < k.length && k[j] === k[i] && j - i < 255) j++;
      l.push(k[i], j - i); i = j;
    }
    return JSON.stringify({ VM: h.VM, PC: h.PC, N: h.N, tur: h.tur, NP: h.NP, par: h.par, uz: k.length, veri: b64(Uint8Array.from(l)) });
  }
  function ac(metin) {
    const o = JSON.parse(metin), r = b64coz(o.veri), kalan = new Uint8Array(o.uz);
    let k = 0;
    for (let i = 0; i < r.length; i += 2) { kalan.fill(r[i], k, k + r[i + 1]); k += r[i + 1]; }
    const D = 2 * o.VM + 1;
    return { kalan, VM: o.VM, D, NV: D * D, PC: o.PC, N: o.N, tur: o.tur, NP: o.NP, par: o.par };
  }

  /* ---------- sürücüler ---------- */

  // Yalnız yasal adaylar arasından seçer; yasal aday yoksa null (motor çarpmayı uygular).
  // o: { zorluk: kolay | orta | zor | gosteri, harita, rng }
  function sec(d, i, o = {}) {
    const p = d.pist, l = R.adaylar(d, i), rng = o.rng || Math.random;
    const yasal = l.map((c, k) => k).filter(k => l[k].yasal);
    if (!yasal.length) return null;
    if (yasal.length === 1) return yasal[0];
    let z = o.zorluk || 'orta';
    if (z === 'gosteri' && d.arabalar[i].carpma > 0) z = 'zor';
    if (z === 'gosteri') return gosteri(d, i, l, yasal);
    const h = o.harita;
    if ((z === 'zor' || z === 'orta') && h) {
      const puan = yasal.map(k => {
        const c = l[k];
        const v = c.ilerleme.bitti ? -1 - c.ilerleme.asim / 100 : kalanAl(h, p, c.x, c.y, c.vx, c.vy, c.ilerleme.tur * (p.N + 1) + c.ilerleme.sayac);
        return { k, v, hiz: c.vx * c.vx + c.vy * c.vy };
      }).sort((a, b) => a.v - b.v || b.hiz - a.hiz || a.k - b.k);
      if (puan[0].v < BILINMIYOR) {
        if (z === 'orta' && puan.length > 1 && puan[1].v < BILINMIYOR && rng() < .25) return puan[1].k;
        return puan[0].k;
      }
    }
    return kolay(d, i, l, yasal, rng);
  }

  // Kolay: BFS yok. İki hamle ileri bakar; ilerlemeyi ve hızı sever, fren mesafesini görmez.
  function kolay(d, i, l, yasal, rng) {
    const p = d.pist, a = d.arabalar[i], hedef = d.ayar.tur, N = p.N;
    const L = Math.min(...p.baslangic.map(([x, y]) => R.potDeger(p, x, y, 0)).filter(v => v < 32767), 999);
    const kalanYol = (x, y, sayac, tur) => (hedef - 1 - tur) * L + Math.min(R.potDeger(p, x, y, sayac), 200);
    const r0 = kalanYol(a.x, a.y, a.sayac, a.tur);
    let en = null;
    for (const k of yasal) {
      const c = l[k];
      if (c.ilerleme.bitti) return k;
      const r1 = kalanYol(c.x, c.y, c.ilerleme.sayac, c.ilerleme.tur);
      let say = 0, iyi = -99;
      for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
        const vx = c.vx + ax, vy = c.vy + ay;
        if (!vx && !vy) continue;
        const x2 = c.x + vx, y2 = c.y + vy;
        if (!R.parcaYasal(p, c.x, c.y, x2, y2).yasal) continue;
        const g = R.gecisler(p, c.x, c.y, x2, y2);
        if (g.some(z => z.cizgi === 0 && !z.ileri)) continue;
        say++;
        const il = R.ilerleme(N, hedef, c.ilerleme.sayac, c.ilerleme.tur, g);
        iyi = Math.max(iyi, il.bitti ? r1 + 5 : r1 - kalanYol(x2, y2, il.sayac, il.tur));
      }
      const puan = (r0 - r1) + .5 * iyi + .3 * say + .4 * Math.hypot(c.vx, c.vy) - (say ? 0 : 20) + rng() * .4;
      if (!en || puan > en.puan) en = { k, puan };
    }
    return en.k;
  }

  // Gösteri ("nasıl oynanır"): ilerleyen adaylar arasında hep en hızlısı; ilk çarpmadan sonra 'zor' olur.
  function gosteri(d, i, l, yasal) {
    const p = d.pist, a = d.arabalar[i];
    const p0 = R.potDeger(p, a.x, a.y, a.sayac);
    let en = null;
    for (const k of yasal) {
      const c = l[k], ilerle = p0 - R.potDeger(p, c.x, c.y, c.ilerleme.sayac);
      const puan = (ilerle > 0 ? 100 : 0) + c.vx * c.vx + c.vy * c.vy + ilerle * .01;
      if (!en || puan > en.puan) en = { k, puan };
    }
    return en.k;
  }

  const A = { BITTI, BILINMIYOR, fnv, onbellekAnahtari, progIlerle, olcAdimli, olc, olcAsync, kalanAl, par, idealYol, paketle, ac, sec };
  if (typeof window !== 'undefined') (window.KR = window.KR || {}).ai = A;
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})();
