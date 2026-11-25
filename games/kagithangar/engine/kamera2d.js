// Uçuş sahnesinin kamerası: hız yönünde ileri bakar, yükseldikçe ve hızlandıkça hafifçe uzaklaşır, çarpmada
// sarsılır, pencereden kaçışta ağır çekime geçer. DOM'suz; çizim uc.js'te.
const sinir = (v, a, b) => Math.min(b, Math.max(a, v));

// Kameranın hedefi (ekranın sol-alt köşesinin dünya konumu). s: { x, y, vx, vy }; gorunur: görünen genişlik/yükseklik (m).
export function hedef(s, gorunur, gorunurY) {
  return {
    x: s.x + sinir(0.18 * (s.vx || 0), -0.5, 1.2) - 0.38 * gorunur,
    y: s.y + sinir(0.12 * (s.vy || 0), -0.6, 0.6) - 0.45 * gorunurY,
  };
}

// Yakınlaştırma (1 = normal, küçüğü uzak): zeminden 2 m'den yüksek ve 8 m/s'den hızlıyken biraz geri çekil.
export function yakinlastirma(yukseklik, hiz, enAz = 0.78) {
  return sinir(1 - 0.06 * Math.max(0, yukseklik - 2) - 0.015 * Math.max(0, hiz - 8), enAz, 1);
}

// Kare hızından bağımsız yumuşak takip: oran 1/s.
export const yumusat = (k, h, dt, oran) => k + (h - k) * (1 - Math.exp(-oran * dt));

// Çarpma sarsıntısı (piksel): sönen, iki frekanslı titreşim. t: çarpmadan beri geçen s.
export function sarsinti(t, guc = 6) {
  if (!(t >= 0) || t > 0.45) return [0, 0];
  const s = guc * Math.exp(-8 * t);
  return [s * Math.sin(t * 83), s * 0.6 * Math.sin(t * 61 + 1.3)];
}

// Oynatma hızı: pencereden kaçış anının çevresinde ağır çekim (0.35), yumuşak geçişle.
export function zamanOlcegi(t, olayT) {
  if (olayT == null) return 1;
  const u = t - olayT;
  if (u < -0.25 || u > 0.7) return 1;
  const icinde = u < 0 ? 1 - (-u / 0.25) : u > 0.45 ? 1 - (u - 0.45) / 0.25 : 1;
  return 1 - 0.65 * sinir(icinde, 0, 1);
}

// Örnek dizisinden t anındaki konum ve hız (doğrusal ara değer).
export function ornekAl(ornekler, t) {
  const o = ornekler;
  if (t <= o[0].t) return { ...o[0], vx: 0, vy: 0 };
  const son = o[o.length - 1];
  if (t >= son.t) return { ...son, vx: 0, vy: 0 };
  let lo = 0, hi = o.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (o[m].t <= t) lo = m; else hi = m; }
  const a = o[lo], b = o[hi], dt = Math.max(1e-6, b.t - a.t), u = (t - a.t) / dt;
  const l = (k) => a[k] + (b[k] - a[k]) * u;
  return { t, x: l('x'), y: l('y'), th: l('th'), ro: l('ro'), z: l('z'), v: a.v != null ? l('v') : 0, vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}
