// Fırlatan el: tükenmez kalemle çizilmiş doodle el (rough.canvas), bir kez offscreen çizilir.
// Kavrama noktası (parmak uçları) yerel orijindir; kol omuzdan (sol alt) gelir.
import { RENK } from './renkler.js';
const MAVI = RENK.mavi;

// Yerel koordinat (m): kavrama (0, 0), y yukarı. El gerçek boyda (avuç ~15 cm); kol çerçevenin dışından gelir.
const E = 0.6;                                       // el çiziminin ölçeği
export const OMUZ = [-0.75, -0.9];                   // savurmanın döndüğü nokta (dirsek/omuz)
const SINIR = { sol: -2.0, ust: 0.2, gen: 2.25, yuk: 2.3 };

export function elKur(ppm, dpr = Math.min(window.devicePixelRatio || 1, 1.5)) {
  const { sol, ust, gen, yuk } = SINIR;
  const c = document.createElement('canvas');
  c.width = Math.ceil(gen * ppm * dpr); c.height = Math.ceil(yuk * ppm * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const rc = rough.canvas(c);
  const P = ([x, y]) => [(x - sol) * ppm, (ust - y) * ppm];
  const e = ([x, y]) => [x * E, y * E];
  let tohum = 31;
  const k = (ek = {}) => ({ stroke: MAVI, strokeWidth: 1.8, roughness: 1.0, seed: (tohum = (tohum * 48271) % 2147483647), ...ek });
  const egri = (n, ek) => rc.curve(n.map(P), k(ek));
  const elEgri = (n, ek) => egri(n.map(e), ek);
  // kol: bilekten çerçevenin dışına uzanan yen
  egri([e([-0.27, -0.27]), [-0.75, -0.75], [-1.95, -1.75]]);
  egri([e([-0.17, -0.37]), [-0.62, -0.88], [-1.75, -2.05]]);
  elEgri([[-0.31, -0.33], [-0.22, -0.4], [-0.15, -0.42]], { strokeWidth: 1.4 });
  elEgri([[-0.36, -0.42], [-0.27, -0.49], [-0.19, -0.5]], { strokeWidth: 1.4 });
  // avuç ve parmaklar (uçağı tutan çimdik)
  elEgri([[-0.27, -0.27], [-0.25, -0.12], [-0.13, -0.04], [-0.02, -0.03]]);
  elEgri([[-0.17, -0.37], [-0.06, -0.3], [0.03, -0.16], [0.02, -0.06]]);
  elEgri([[-0.13, -0.04], [-0.06, 0.03], [0.03, 0.02]], { strokeWidth: 1.5 });               // başparmak
  elEgri([[-0.02, -0.03], [0.05, -0.05], [0.04, -0.11], [-0.03, -0.1]], { strokeWidth: 1.5 });  // işaret parmağı
  elEgri([[-0.04, -0.14], [0.04, -0.17], [0.02, -0.22], [-0.06, -0.2]], { strokeWidth: 1.3 });
  elEgri([[-0.09, -0.23], [-0.01, -0.27], [-0.04, -0.31], [-0.12, -0.28]], { strokeWidth: 1.2 });
  return {
    // ctx'e çiz: kavrama noktası ekranda (gx, gy), omuz etrafında `don` radyan dönmüş (savurma).
    ciz(hedef, gx, gy, don = 0) {
      const [ox, oy] = [OMUZ[0] * ppm, -OMUZ[1] * ppm];
      hedef.save();
      hedef.translate(gx + ox, gy + oy);
      hedef.rotate(don);
      hedef.translate(-ox, -oy);
      hedef.drawImage(c, sol * ppm, -ust * ppm, gen * ppm, yuk * ppm);
      hedef.restore();
    },
  };
}

// Omuz etrafında dönmüş kavrama noktası (savurma sırasında uçak elde).
export function kavrama(gx, gy, ppm, don) {
  const ox = gx + OMUZ[0] * ppm, oy = gy - OMUZ[1] * ppm;
  const dx = gx - ox, dy = gy - oy, c = Math.cos(don), s = Math.sin(don);
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
}
