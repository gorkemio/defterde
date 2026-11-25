// Baskı şablonu: düz kağıt (dikey ya da yatay A4) üzerinde numaralı kırışık çizgileri + uçağın sahibinin mürekkebi
// doğru yerde. DOM'suz. Arka yüz: kağıdın arkasından bakış (x → en − x).
// Kırışığın düz kağıdın ÖN yüzünden görünen türü: katlanırken üstte ön yüz duruyorsa adımın kendi türü,
// arka yüz duruyorsa tersi (arkadan vadi = önden dağ).
import * as G from './geom.js';
import { anaDuzlem, kanatGeometrisi } from './poz.js';

const ters = (t) => (t === 'vadi' ? 'dag' : 'vadi');
const tersYuz = (y) => (y === 'on' ? 'arka' : 'on');
const enOf = (son) => (son.kagit && son.kagit.en) || 1;

export function kirisikDeseni(son) {
  const kirisikler = son.kirisiklar.map(k => ({
    adim: k.adim, hareket: k.hareket, p1: k.p1, p2: k.p2,
    tur: k.yuz === 'on' ? k.kat : ters(k.kat),
  }));
  // her adıma bir numara: en uzun kırışığının ortasında
  const enUzun = new Map();
  for (const k of kirisikler) {
    const L = G.uzaklik(k.p1, k.p2);
    if (!enUzun.has(k.adim) || L > enUzun.get(k.adim).L) enUzun.set(k.adim, { L, k });
  }
  const etiketler = [...enUzun.values()].map(({ k }) => ({ adim: k.adim, no: k.adim + 1, nokta: [(k.p1[0] + k.p2[0]) / 2, (k.p1[1] + k.p2[1]) / 2] }));
  return { kirisikler, etiketler };
}

// Modelde bir poligonun görünen yüzü (pozdaki yerel +z yukarı bakıyorsa üstteki yüz).
function gorunenYuz(son, model, poligonId) {
  const pol = son.poligonlar.find(p => p.id === poligonId);
  const par = model.parcalar.find(p => p.id === poligonId && !p.sanal) || model.parcalar.find(p => p.id === poligonId);
  if (!pol || !par) return 'on';
  return par.M.R[8] >= 0 ? pol.yuz : tersYuz(pol.yuz);
}

// Boya çizgileri → düz kağıtta ön ve arka yüz parçaları. Noktalar katman değiştirip kağıtta uzağa sıçrarsa çizgi bölünür.
export function boyaDeseni(son, model, cizgiler) {
  const sonuc = { on: [], arka: [] };
  const en = enOf(son);
  for (const cz of cizgiler || []) {
    if (cz.duz) {                                         // düz kağıda çizilmiş: olduğu gibi
      const n = cz.noktalar.map(([x, y]) => (cz.yuz === 'arka' ? [en - x, y] : [x, y]));
      if (n.length) sonuc[cz.yuz === 'arka' ? 'arka' : 'on'].push({ renk: cz.renk, kalinlik: cz.kalinlik ?? 1.1, firca: !!cz.firca, noktalar: n });
      continue;
    }
    let parca = null, oncekiYuz = null, onceki = null;
    for (const q of cz.noktalar) {
      if (q.length < 5) continue;
      const [x, y, pid, fx, fy] = q;
      const yuz = gorunenYuz(son, model, pid);
      const sicrama = onceki && G.uzaklik([fx, fy], [onceki[3], onceki[4]]) > 3 * G.uzaklik([x, y], [onceki[0], onceki[1]]) + 1e-3;
      if (!parca || yuz !== oncekiYuz || sicrama) {
        parca = { renk: cz.renk, kalinlik: cz.kalinlik ?? 1.1, firca: !!cz.firca, noktalar: [] };
        sonuc[yuz].push(parca);
      }
      parca.noktalar.push(yuz === 'on' ? [fx, fy] : [en - fx, fy]);      // arka yüz: kağıdın arkasından bakış
      oncekiYuz = yuz; onceki = q;
    }
  }
  for (const k of ['on', 'arka']) sonuc[k] = sonuc[k].filter(p => p.noktalar.length);
  return sonuc;
}

// İsim: sağ kanadın ana düzlemindeki yeri (yerel ×100 çerçevesi) → düz kağıt. Dönüş: { yuz, matris } — matris,
// yerel ×100 koordinatlı yazıyı düz kağıt birimine (×1) götüren afin; arka yüzde kağıdın arkasından bakış.
export function isimDeseni(son, model, yer) {
  if (!yer) return null;
  const ana = anaDuzlem(model, 'sag');
  if (!ana.length) return null;
  const merkez = [yer.cx / 100, yer.cy / 100];
  const altta = ana.filter(p => G.icinde(G.ccw(p.noktalar2), merkez, 1e-6));
  if (!altta.length) return null;
  const yukari = ana[0].M.R[8] >= 0;
  const ust = altta.reduce((a, b) => ((yukari ? b.indeks > a.indeks : b.indeks < a.indeks) ? b : a));
  const pol = son.poligonlar.find(p => p.id === ust.id);
  const yuz = yukari ? pol.yuz : tersYuz(pol.yuz);
  // yerel ×100 → yerel ×1 → (T) düz → (arka ise x → en − x)
  const olcek = [0.01, 0, 0, 0.01, 0, 0];
  let A = G.birlestir(pol.T, olcek);
  if (yuz === 'arka') A = G.birlestir([-1, 0, 0, 1, enOf(son), 0], A);
  // matris motorun satır düzeninde ([a, b, c, d, e, f]: x' = a·x + b·y + e); svgMatris SVG/canvas sırasında
  // (x' = a·x + c·y + e). Eğik katlarda doğrusal kısım simetrik değildir, karıştırılırsa isim kağıttan kaçar.
  return { yuz, matris: A, svgMatris: [A[0], A[2], A[1], A[3], A[4], A[5]], aynali: G.detT(A) < 0, merkez: G.donustur(A, [yer.cx, yer.cy]) };
}

export { kanatGeometrisi };
