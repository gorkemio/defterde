// track.js — pist modeli (DOM'a dokunmaz). ASCII hücre haritası → kafes noktaları, çizgiler, kenar çokgenleri.
// Koordinatlar: hücre (c, r), kafes noktası (x, y) = hücre köşesi; x sağa, y aşağı, sol üst (0, 0).
// Yasal nokta: en az bir asfalt hücrenin köşesi. Arabalar yalnız yasal noktalarda durur.
// Pist dosyaları KR_PIST({...}) ile kendini kaydeder (tarayıcıda window, node'da global).
(function () {
  'use strict';

  const ENCOK_W = 44, ENCOK_H = 28;
  const kayit = [];

  function KR_PIST(tanim) {
    const i = kayit.findIndex(t => t.kimlik === tanim.kimlik);
    if (i >= 0) kayit[i] = tanim; else kayit.push(tanim);
    return tanim;
  }

  /* ---------- ayrıştırma ---------- */

  function haritaSatirlari(harita) {
    let s = String(harita).replace(/\r/g, '').split('\n').map(x => x.replace(/\s+$/, ''));
    while (s.length && !s[0].trim()) s.shift();
    while (s.length && !s[s.length - 1].trim()) s.pop();
    s = s.map(x => x.replace(/^\s+/, m => '.'.repeat(m.length)));
    const W = Math.max(0, ...s.map(x => x.length));
    return s.map(x => x.padEnd(W, '.'));
  }

  // Çizgi: a, b aynı eksende iki kafes noktası; yon geçiş yönü (eksen birim vektörü). a→b küçükten büyüğe sıralanır.
  function cizgiNormal(c) {
    let a = [c.a[0], c.a[1]], b = [c.b[0], c.b[1]];
    if (a[0] > b[0] || a[1] > b[1]) [a, b] = [b, a];
    const yon = [Math.sign(c.yon[0]), Math.sign(c.yon[1])];
    return { a, b, yon, dikey: a[0] === b[0] };
  }

  function ayristir(tanim) {
    const satir = haritaSatirlari(tanim.harita);
    const H = satir.length, W = H ? satir[0].length : 0;
    const hucre = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) hucre[r * W + c] = satir[r][c] === '#' ? 1 : 0;
    const asfalt = (c, r) => c >= 0 && r >= 0 && c < W && r < H && hucre[r * W + c] === 1;
    const PW = W + 1, PH = H + 1;
    const nokta = new Int32Array(PW * PH).fill(-1);
    const noktalar = [];
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      if (asfalt(x - 1, y - 1) || asfalt(x, y - 1) || asfalt(x - 1, y) || asfalt(x, y)) {
        nokta[y * PW + x] = noktalar.length;
        noktalar.push([x, y]);
      }
    }
    const ni = (x, y) => (x >= 0 && y >= 0 && x < PW && y < PH ? nokta[y * PW + x] : -1);
    const bitis = cizgiNormal(tanim.bitis);
    const kontrol = (tanim.kontrol || []).map(cizgiNormal);
    return {
      kimlik: tanim.kimlik, ad: tanim.ad, tur: tanim.tur || 1, par: tanim.par || 0,
      W, H, PW, PH, hucre, asfalt, nokta, noktalar, NP: noktalar.length, ni,
      yasal: (x, y) => ni(x, y) >= 0,
      bitis, kontrol, cizgiler: [bitis, ...kontrol], N: kontrol.length,
      baslangic: (tanim.baslangic || []).map(p => [p[0], p[1]]),
      harita: satir.join('\n'), tanim,
    };
  }

  /* ---------- doğrulama (lint) ---------- */

  function dogrula(p) {
    const h = [];
    if (!p.W || !p.H) return ['boş harita'];
    if (p.W > ENCOK_W || p.H > ENCOK_H) h.push(`boyut ${p.W}×${p.H} > ${ENCOK_W}×${ENCOK_H}`);
    // tek parça asfalt (4-komşuluk)
    let ilk = -1, toplam = 0;
    for (let i = 0; i < p.hucre.length; i++) if (p.hucre[i]) { toplam++; if (ilk < 0) ilk = i; }
    if (!toplam) return h.concat('asfalt yok');
    const gor = new Uint8Array(p.hucre.length), kuyruk = [ilk];
    gor[ilk] = 1;
    let say = 0;
    while (kuyruk.length) {
      const i = kuyruk.pop(); say++;
      const c = i % p.W, r = (i - c) / p.W;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (p.asfalt(c + dc, r + dr)) { const j = (r + dr) * p.W + c + dc; if (!gor[j]) { gor[j] = 1; kuyruk.push(j); } }
      }
    }
    if (say !== toplam) h.push(`asfalt ${toplam - say} hücre kopuk`);
    // ince çim: dört köşesi de yasal olan çim hücresi
    for (let r = 0; r < p.H; r++) for (let c = 0; c < p.W; c++) {
      if (!p.asfalt(c, r) && p.yasal(c, r) && p.yasal(c + 1, r) && p.yasal(c, r + 1) && p.yasal(c + 1, r + 1)) h.push(`ince çim (${c},${r})`);
    }
    p.cizgiler.forEach((z, k) => h.push(...cizgiDogrula(p, z, k ? `kontrol ${k}` : 'bitiş')));
    if (p.N > 3) h.push('en çok 3 kontrol noktası');
    const bs = p.baslangic;
    if (bs.length !== 4) h.push('4 başlangıç noktası gerekli');
    const anahtar = new Set(bs.map(q => q.join(',')));
    if (anahtar.size !== bs.length) h.push('başlangıç noktaları aynı');
    for (const q of bs) {
      if (!p.yasal(q[0], q[1])) h.push(`başlangıç (${q}) yasal değil`);
      else if (!cizgiUstunde(p.bitis, q[0], q[1])) h.push(`başlangıç (${q}) bitiş çizgisinde değil`);
    }
    return h;
  }

  function cizgiUstunde(z, x, y) {
    return z.dikey ? x === z.a[0] && y >= z.a[1] && y <= z.b[1] : y === z.a[1] && x >= z.a[0] && x <= z.b[0];
  }

  // Çizgi boyunca her birim kenarın en az bir yanı asfalt; iki ucun ötesindeki kenarların iki yanı da çim.
  function cizgiDogrula(p, z, ad) {
    const h = [];
    const [ax, ay] = z.a, [bx, by] = z.b;
    if (ax !== bx && ay !== by) return [`${ad}: eksene paralel değil`];
    if (ax === bx && ay === by) return [`${ad}: uzunluk 0`];
    if (z.dikey ? (z.yon[1] !== 0 || z.yon[0] === 0) : (z.yon[0] !== 0 || z.yon[1] === 0)) h.push(`${ad}: yön çizgiye dik değil`);
    if (!p.yasal(ax, ay) || !p.yasal(bx, by)) h.push(`${ad}: uçlar yasal değil`);
    const yanlar = (k) => (z.dikey ? [p.asfalt(ax - 1, k), p.asfalt(ax, k)] : [p.asfalt(k, ay - 1), p.asfalt(k, ay)]);
    const [k0, k1] = z.dikey ? [ay, by] : [ax, bx];
    for (let k = k0; k < k1; k++) { const [s1, s2] = yanlar(k); if (!s1 && !s2) h.push(`${ad}: ${k} kenarı çimde`); }
    for (const k of [k0 - 1, k1]) { const [s1, s2] = yanlar(k); if (s1 || s2) h.push(`${ad}: pisti tam kesmiyor (${k})`); }
    return h;
  }

  /* ---------- kenar çokgenleri: marching squares + Chaikin + sadeleştirme ---------- */

  function kenarCokgenleri(p, o = {}) {
    const f = (x, y) => (p.yasal(x, y) ? 1 : 0);
    const kom = new Map();                               // kenar orta noktası anahtarı → komşular
    const orta = new Map();                              // anahtar → [x, y]
    const bagla = (a, b) => {
      if (!kom.has(a)) kom.set(a, []);
      if (!kom.has(b)) kom.set(b, []);
      kom.get(a).push(b); kom.get(b).push(a);
    };
    const anahtar = (t, x, y) => {
      const k = t + x + ',' + y;
      if (!orta.has(k)) orta.set(k, t === 'h' ? [x + .5, y] : [x, y + .5]);
      return k;
    };
    for (let y = -1; y <= p.H; y++) for (let x = -1; x <= p.W; x++) {
      const tl = f(x, y), tr = f(x + 1, y), br = f(x + 1, y + 1), bl = f(x, y + 1);
      const s = tl + tr + br + bl;
      if (s === 0 || s === 4) continue;
      const ust = () => anahtar('h', x, y), sag = () => anahtar('v', x + 1, y);
      const alt = () => anahtar('h', x, y + 1), sol = () => anahtar('v', x, y);
      if (s === 2 && tl === br) {                        // eyer: köşeler ayrık
        if (tl) { bagla(ust(), sol()); bagla(sag(), alt()); } else { bagla(ust(), sag()); bagla(alt(), sol()); }
        continue;
      }
      const e = [];
      if (tl !== tr) e.push(ust());
      if (tr !== br) e.push(sag());
      if (br !== bl) e.push(alt());
      if (bl !== tl) e.push(sol());
      bagla(e[0], e[1]);
    }
    const halkalar = [], gez = new Set();
    for (const bas of kom.keys()) {
      if (gez.has(bas)) continue;
      const h = [];
      let onceki = null, su = bas;
      while (su && !gez.has(su)) {
        gez.add(su); h.push(orta.get(su));
        const [a, b] = kom.get(su);
        const sonraki = a !== onceki && !gez.has(a) ? a : (!gez.has(b) ? b : null);
        onceki = su; su = sonraki;
      }
      if (h.length >= 3) halkalar.push(h);
    }
    const tekrar = o.chaikin ?? 2, eps = o.eps ?? 0.06;
    return halkalar
      .map(h => { for (let i = 0; i < tekrar; i++) h = chaikin(h); return sadelestir(h, eps); })
      .sort((a, b) => Math.abs(alanHesap(b)) - Math.abs(alanHesap(a)));
  }

  function chaikin(h) {
    const n = h.length, y = [];
    for (let i = 0; i < n; i++) {
      const [x0, y0] = h[i], [x1, y1] = h[(i + 1) % n];
      y.push([.75 * x0 + .25 * x1, .75 * y0 + .25 * y1], [.25 * x0 + .75 * x1, .25 * y0 + .75 * y1]);
    }
    return y;
  }

  function alanHesap(h) {
    let s = 0;
    for (let i = 0; i < h.length; i++) { const [a, b] = h[i], [c, d] = h[(i + 1) % h.length]; s += a * d - b * c; }
    return s / 2;
  }

  // Douglas–Peucker, kapalı halka: en uzak iki noktadan ikiye bölünür.
  function sadelestir(h, eps) {
    if (h.length < 8 || !eps) return h;
    const uzak = (i) => { let m = 0, j = 0; for (let k = 0; k < h.length; k++) { const d = (h[k][0] - h[i][0]) ** 2 + (h[k][1] - h[i][1]) ** 2; if (d > m) { m = d; j = k; } } return j; };
    const j = uzak(0);
    const dp = (pts) => {
      if (pts.length < 3) return pts;
      const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
      const L = Math.hypot(bx - ax, by - ay) || 1e-9;
      let m = -1, mi = 0;
      for (let k = 1; k < pts.length - 1; k++) {
        const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L;
        if (d > m) { m = d; mi = k; }
      }
      if (m <= eps) return [pts[0], pts[pts.length - 1]];
      const s1 = dp(pts.slice(0, mi + 1)), s2 = dp(pts.slice(mi));
      return s1.slice(0, -1).concat(s2);
    };
    const a = dp(h.slice(0, j + 1)), b = dp(h.slice(j).concat([h[0]]));
    return a.slice(0, -1).concat(b.slice(0, -1));
  }

  // Kapalı halkadan yumuşak SVG yolu: kenar orta noktalarından geçen ikinci derece B-spline (köşeler kontrol noktası).
  // Catmull-Rom düzensiz aralıklı noktalarda taşıp kanca yapıyordu; bu eğri çokgenin dışına taşmaz. donustur: (x, y) → [X, Y].
  function egriYolu(h, donustur) {
    const P = h.map(q => donustur(q[0], q[1])), n = P.length, f = (v) => v.toFixed(1);
    const orta = (i) => { const a = P[i % n], b = P[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    let m = orta(0), d = `M ${f(m[0])} ${f(m[1])}`;
    for (let i = 1; i <= n; i++) {
      const k = P[i % n]; m = orta(i);
      d += ` Q ${f(k[0])} ${f(k[1])}, ${f(m[0])} ${f(m[1])}`;
    }
    return d + ' Z';
  }

  // Halkanın işaretli alanı > 0 ise (ekran koordinatında) saat yönünde: iç normal, teğetin −90° döndürülmüşüdür.
  // Yay uzunluğu adımıyla örnek: [{ x, y, tx, ty, nx, ny, s }] — n normal: ic=true halkanın içine, false dışına; s yay uzunluğu.
  // Asfalta doğru normal: dış halkada ic=true, deliklerde ic=false.
  function yayOrnekle(h, adim, ic = true) {
    const n = h.length, isaret = alanHesap(h) > 0 ? 1 : -1;
    const L = [];
    let toplam = 0;
    for (let i = 0; i < n; i++) { const a = h[i], b = h[(i + 1) % n]; L.push(Math.hypot(b[0] - a[0], b[1] - a[1])); toplam += L[i]; }
    const sonuc = [];
    let hedef = 0, i = 0, bas = 0;
    while (hedef < toplam && i < n) {
      if (hedef > bas + L[i]) { bas += L[i]; i++; continue; }
      const a = h[i], b = h[(i + 1) % n], t = L[i] ? (hedef - bas) / L[i] : 0;
      const tx = L[i] ? (b[0] - a[0]) / L[i] : 1, ty = L[i] ? (b[1] - a[1]) / L[i] : 0;
      // ekran koordinatında (y aşağı) saat yönü halkada iç taraf sağdadır → normal (−ty, tx); ters halkada (ty, −tx)
      const d = (ic ? 1 : -1) * isaret;
      sonuc.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty, nx: -ty * d, ny: tx * d, s: hedef });
      hedef += adim;
    }
    return sonuc;
  }

  // Viraj bölgeleri: yay örnekleri üzerinde pencere içindeki toplam dönüş açısı eşiği aşan aralıklar (yay uzunluğu).
  // Döner: [{ bas, bit }] (s cinsinden), en çok `enCok` tane, en uzundan kısaya; her biri enAz–enCok uzunlukta.
  function bordurAdaylari(h, o = {}) {
    const adim = o.adim ?? .25, pencere = o.pencere ?? 2.5, esik = (o.esik ?? 35) * Math.PI / 180;
    const enAz = o.enAz ?? 3, enUzun = o.enUzun ?? 7, enCok = o.enCok ?? 4;
    const orn = yayOrnekle(h, adim), n = orn.length;
    if (n < 8) return [];
    const donus = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = orn[i], b = orn[(i + 1) % n];
      donus[i] = Math.abs(Math.atan2(a.tx * b.ty - a.ty * b.tx, a.tx * b.tx + a.ty * b.ty));
    }
    const k = Math.max(1, Math.round(pencere / adim));
    const egri = new Float64Array(n);
    for (let i = 0; i < n; i++) { let t = 0; for (let j = -k; j <= k; j++) t += donus[(i + j + n) % n]; egri[i] = t; }
    const sicak = Array.from(egri, v => v > esik);
    // ardışık sıcak aralıklar (halka sarmalı)
    const bolgeler = [];
    let bas0 = sicak.findIndex(v => !v);
    if (bas0 < 0) return [];
    let i = bas0, say = 0;
    while (say < n) {
      if (sicak[i]) {
        const b = i; let uz = 0;
        while (sicak[(b + uz) % n] && uz < n) uz++;
        const toplamS = uz * adim;
        if (toplamS >= enAz) {
          const merkez = (b + uz / 2) * adim, yari = Math.min(enUzun, toplamS) / 2;
          bolgeler.push({ bas: merkez - yari, bit: merkez + yari, guc: egri[(b + Math.floor(uz / 2)) % n] });
        }
        i = (i + uz) % n; say += uz;
      } else { i = (i + 1) % n; say++; }
    }
    bolgeler.sort((a, b) => b.guc - a.guc);
    return bolgeler.slice(0, enCok).map(({ bas, bit }) => ({ bas, bit }));
  }

  // Bütün halkaları tek yolda birleştirir (asfalt bölgesi; fill-rule: evenodd ile delikler boş kalır).
  function bolgeYolu(halkalar, donustur) {
    return halkalar.map(h => egriYolu(h, donustur)).join(' ');
  }

  // Yasal nokta alanının çift doğrusal değeri (çizim: ≥ .5 pist içi). Çim taraması dışarıda kalsın diye.
  function alanDegeri(p, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const v = (a, b) => (p.yasal(a, b) ? 1 : 0);
    return v(x0, y0) * (1 - fx) * (1 - fy) + v(x0 + 1, y0) * fx * (1 - fy) + v(x0, y0 + 1) * (1 - fx) * fy + v(x0 + 1, y0 + 1) * fx * fy;
  }

  // Çim hücrelerinin asfalta 4-komşuluk uzaklığı (0 = asfalt, tavan 9).
  function cimMesafesi(p) {
    const d = new Uint8Array(p.W * p.H).fill(9), kuyruk = [];
    for (let i = 0; i < d.length; i++) if (p.hucre[i]) { d[i] = 0; kuyruk.push(i); }
    for (let k = 0; k < kuyruk.length; k++) {
      const i = kuyruk[k], c = i % p.W, r = (i - c) / p.W;
      if (d[i] >= 9) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= p.W || rr >= p.H) continue;
        const j = rr * p.W + cc;
        if (d[j] > d[i] + 1) { d[j] = d[i] + 1; kuyruk.push(j); }
      }
    }
    return d;
  }

  // Eksene paralel tam kesit: (x, y) tohum noktasından iki yöne, kenarın en az bir yanı asfalt oldukça uzar.
  // dikey: x sabit çizgi. yon: geçiş yönü. Üretici ve tasarım için.
  function kesitBul(p, dikey, x, y, yon) {
    if (dikey) {
      const ok = (k) => p.asfalt(x - 1, k) || p.asfalt(x, k);
      if (!ok(y)) return null;
      let y0 = y, y1 = y;
      while (ok(y0 - 1)) y0--;
      while (ok(y1)) y1++;
      return { a: [x, y0], b: [x, y1], yon };
    }
    const ok = (k) => p.asfalt(k, y - 1) || p.asfalt(k, y);
    if (!ok(x)) return null;
    let x0 = x, x1 = x;
    while (ok(x0 - 1)) x0--;
    while (ok(x1)) x1++;
    return { a: [x0, y], b: [x1, y], yon };
  }

  const T = {
    ENCOK_W, ENCOK_H, KR_PIST, kayit, pistler: kayit,
    bul: (kimlik) => kayit.find(t => t.kimlik === kimlik),
    haritaSatirlari, ayristir, dogrula, kesitBul, cizgiDogrula, cizgiUstunde, cizgiNormal,
    kenarCokgenleri, chaikin, sadelestir, alanHesap, egriYolu, bolgeYolu, yayOrnekle, bordurAdaylari, alanDegeri, cimMesafesi,
  };

  if (typeof window !== 'undefined') { (window.KR = window.KR || {}).track = T; window.KR_PIST = KR_PIST; }
  if (typeof global !== 'undefined' && typeof window === 'undefined') global.KR_PIST = KR_PIST;
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})();
