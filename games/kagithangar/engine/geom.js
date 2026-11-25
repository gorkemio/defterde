// Düzlem geometrisi: dışbükey poligonlar, doğruyla kırpma, afin izometriler. DOM'suz.
// Afin dönüşüm T = [a, b, c, d, e, f]: x' = a·x + b·y + e, y' = c·x + d·y + f.

export const EPS = 1e-9;          // köşe "çizgi üstünde" eşiği
export const ALAN_EPS = 1e-6;     // bundan küçük parça kıymıktır (aday sayılmaz, kesilmez)

export const fark = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const capraz = (a, b) => a[0] * b[1] - a[1] * b[0];
export const ic = (a, b) => a[0] * b[0] + a[1] * b[1];
export const uzaklik = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// İşaretli alan (matematik yönünde pozitif = saat yönünün tersi).
export function alan(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    s += a[0] * b[1] - a[1] * b[0];
  }
  return s / 2;
}
export const ccw = (P) => (alan(P) < 0 ? P.slice().reverse() : P);
export const merkez = (P) => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);

// Tekrarlanan ve doğrusal ara köşeleri at: komşuluk ve alan eşikleri gürültüsüz kalsın.
export function temizle(P) {
  let Q = [];
  for (const p of P) if (!Q.length || uzaklik(p, Q[Q.length - 1]) > EPS) Q.push(p);
  if (Q.length > 1 && uzaklik(Q[0], Q[Q.length - 1]) <= EPS) Q.pop();
  let degisti = true;
  while (degisti && Q.length >= 3) {
    degisti = false;
    for (let i = 0; i < Q.length; i++) {
      const a = Q[(i + Q.length - 1) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
      if (Math.abs(capraz(fark(b, a), fark(c, b))) < 1e-12) { Q.splice(i, 1); degisti = true; break; }
    }
  }
  return Q.length >= 3 ? Q : [];
}

// Doğruya işaretli uzaklık (cizgi = [a, b]); sol taraf pozitif.
export function taraf([a, b], p) {
  const d = fark(b, a);
  return capraz(d, fark(p, a)) / Math.hypot(d[0], d[1]);
}

// Dışbükey poligonun işaret·taraf ≥ 0 olan yarısı. Çizgi üstündeki köşeler iki yarıda da kalır.
export function kes(P, cizgi, isaret) {
  const cikti = [];
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const A = P[i], B = P[(i + 1) % n];
    const da = isaret * taraf(cizgi, A), db = isaret * taraf(cizgi, B);
    if (da >= -EPS) cikti.push(da <= EPS ? cizgiyeOturt(A, cizgi) : A);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db);
      cikti.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
    }
  }
  return temizle(cikti);
}

// Çizgiye EPS kadar yakın köşeyi tam üstüne çek (yuvarlama birikmesin).
function cizgiyeOturt(p, [a, b]) {
  const d = fark(b, a);
  const t = ic(fark(p, a), d) / ic(d, d);
  return [a[0] + d[0] * t, a[1] + d[1] * t];
}

// Kapalı içerme (dışbükey, ccw).
export function icinde(P, p, eps = 1e-6) {
  for (let i = 0; i < P.length; i++) if (taraf([P[i], P[(i + 1) % P.length]], p) < -eps) return false;
  return true;
}

export function yansimaT([a, b]) {
  const d = fark(b, a), L = Math.hypot(d[0], d[1]);
  const ux = d[0] / L, uy = d[1] / L;
  const m00 = 2 * ux * ux - 1, m01 = 2 * ux * uy, m11 = 2 * uy * uy - 1;
  return [m00, m01, m01, m11, a[0] - (m00 * a[0] + m01 * a[1]), a[1] - (m01 * a[0] + m11 * a[1])];
}
export const BIRIM = [1, 0, 0, 1, 0, 0];
export const donustur = (T, p) => [T[0] * p[0] + T[1] * p[1] + T[4], T[2] * p[0] + T[3] * p[1] + T[5]];
// (A ∘ B)(p) = A(B(p))
export const birlestir = (A, B) => [
  A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3],
  A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3],
  A[0] * B[4] + A[1] * B[5] + A[4], A[2] * B[4] + A[3] * B[5] + A[5],
];
export const detT = (T) => T[0] * T[3] - T[1] * T[2];
export function tersT(T) {
  const D = detT(T);
  const a = T[3] / D, b = -T[1] / D, c = -T[2] / D, d = T[0] / D;
  return [a, b, c, d, -(a * T[4] + b * T[5]), -(c * T[4] + d * T[5])];
}
export const yansit = (cizgi, p) => donustur(yansimaT(cizgi), p);

// p'yi q'ya götüren katın çizgisi: orta dikme.
export function ortaDikme(p, q) {
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const dik = [-(q[1] - p[1]), q[0] - p[0]];
  return [[m[0] - dik[0], m[1] - dik[1]], [m[0] + dik[0], m[1] + dik[1]]];
}

// İki poligon (ya da bir parça) eşdoğrusal ve pozitif uzunlukta örtüşen bir kenar paylaşıyor mu?
export function kenarPaylasir(A, B, eps = 1e-6, enAz = 1e-4) {
  for (let i = 0; i < A.length; i++) {
    const a1 = A[i], a2 = A[(i + 1) % A.length];
    const d = fark(a2, a1), L = Math.hypot(d[0], d[1]);
    if (L < EPS) continue;
    for (let j = 0; j < B.length; j++) {
      const b1 = B[j], b2 = B[(j + 1) % B.length];
      if (Math.abs(capraz(d, fark(b1, a1))) / L > eps || Math.abs(capraz(d, fark(b2, a1))) / L > eps) continue;
      const t1 = ic(fark(b1, a1), d) / (L * L), t2 = ic(fark(b2, a1), d) / (L * L);
      const lo = Math.max(0, Math.min(t1, t2)), hi = Math.min(1, Math.max(t1, t2));
      if ((hi - lo) * L > enAz) return true;
    }
  }
  return false;
}

// İki dışbükey poligonun kesişim alanı.
export function kesisimAlani(A, B) {
  let P = A;
  const Bc = ccw(B);
  for (let i = 0; i < Bc.length && P.length >= 3; i++) P = kes(P, [Bc[i], Bc[(i + 1) % Bc.length]], 1);
  return P.length >= 3 ? Math.abs(alan(P)) : 0;
}

// Doğru parçasını dışbükey poligona kırp; [p, q] ya da null.
export function parcaKirp([p, q], P) {
  let t0 = 0, t1 = 1;
  const d = fark(q, p);
  for (let i = 0; i < P.length; i++) {
    const kenar = [P[i], P[(i + 1) % P.length]];
    const fp = taraf(kenar, p), fq = taraf(kenar, q);
    if (fp < -1e-9 && fq < -1e-9) return null;
    if (fp < -1e-9 || fq < -1e-9) {
      const t = fp / (fp - fq);
      if (fp < -1e-9) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
  }
  if (t1 - t0 < 1e-9) return null;
  return [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1]];
}

// Menteşe (kat yeri) gölgesi: kenarın ortasından parçanın içine doğru, genislik uzunluğunda gradyan doğrusu.
// Dönüş [x1, y1, x2, y2] (ekran koordinatı).
export function menteseGradyani([a, b], noktalar, genislik) {
  const ort = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m = merkez(noktalar);
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const L = Math.hypot(nx, ny) || 1;
  nx /= L; ny /= L;
  if ((m[0] - ort[0]) * nx + (m[1] - ort[1]) * ny < 0) { nx = -nx; ny = -ny; }
  return [ort[0], ort[1], ort[0] + nx * genislik, ort[1] + ny * genislik];
}
