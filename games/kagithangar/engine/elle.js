// ELLE modu hesapları: sürükleme → katlama açısı, bırakma → hassasiyet, adımlar → katlama kalitesi. DOM'suz.
//
// Katlama çizgisi tasarımdan gelir; sürükleme yalnız açıyı ve bırakma noktasını belirler. Yalnız çizgiye dik
// bileşen sayılır (çizgi boyunca kayma ne açıyı ne hassasiyeti etkiler).
import * as G from './geom.js';

export const IZLE_KALITESI = 85;
export const OLU_BOLGE = 0.02;          // t bunun altındaysa kağıt kalkmaz
export const YAPISMA = 0.97;            // t bunun üstündeyse görüntü tam katlanmış durur

const sinir = (v, a, b) => Math.min(b, Math.max(a, v));

// Hareket eden tarafa bakan birim normal ve tut'un çizgiye uzaklığı (dT > 0).
export function eksen(h) {
  const [a, b] = h.cizgi;
  const d = G.fark(b, a), L = Math.hypot(d[0], d[1]);
  const isaret = Math.sign(G.taraf(h.cizgi, h.tut)) || 1;
  const n = [-d[1] / L * isaret, d[0] / L * isaret];
  return { a, n, dT: G.ic(G.fark(h.tut, a), n) };
}

// İşaretçinin çizgiye dik konumu: dT = tut'ta, 0 = çizgide, -dT = hedefte.
export function dikKonum(h, P) {
  const { a, n } = eksen(h);
  return G.ic(G.fark(P, a), n);
}

// Sürüklenen nokta P (kağıt koordinatı) → derece. Üstten görünüşte köşe parmağı izler: dP = dT·cos θ.
export function suruklemeAcisi(h, P) {
  const { dT } = eksen(h);
  const t = sinir((dT - dikKonum(h, P)) / (2 * dT), 0, 1);
  if (t < OLU_BOLGE) return 0;
  if (t > YAPISMA) return 180;
  return Math.acos(1 - 2 * t) * 180 / Math.PI;
}

// Kısa katlarda sıkı, uzun katlarda en çok kağıt genişliğinin %10'u.
export const tolerans = (h) => sinir(0.4 * eksen(h).dT, 0.03, 0.10);

// Bırakma: hedefe dik uzaklık → kabul ve hassasiyet (0–100).
export function birak(h, P) {
  const { dT } = eksen(h);
  const hata = Math.abs(dikKonum(h, P) + dT);
  const tol = tolerans(h);
  return { hata, tol, kabul: hata <= tol, hassasiyet: Math.round(100 * Math.max(0, 1 - hata / tol)) };
}

// Katlama kalitesi = adımların hassasiyet ortalaması. kayitlar: { adimNo: [hareket hassasiyetleri] }.
export function kalite(kayitlar) {
  const adimlar = Object.values(kayitlar).filter(l => l && l.length);
  if (!adimlar.length) return null;
  const ort = (l) => l.reduce((s, v) => s + v, 0) / l.length;
  return Math.round(ort(adimlar.map(ort)));
}

// Hassasiyet sayılan hareket mi? (çevir ve ön kırışık sayılmaz; ön kırışık yine de elle sürüklenir)
export const sayilir = (h) => !!h && h.tip !== 'cevir' && !h.ac;

// ELLE'de sürüklenerek mi katlanır? Çevir dışındaki her hareket, ön kırışık (ac) dahil.
export const surukle = (h) => !!h && h.tip !== 'cevir';

// Kabul edilen sürüklemeden sonra oynatılacak animasyon: ön kırışık kapanır, sonra yavaşça yeniden açılır.
export const kabulAnimasyonu = (h) => (h && h.ac ? 'kapat-ac' : 'kapat');

// Sıradaki hareket için arayüz: nasıl yapılır (sürükle / dokun / düğme), düğme etiketi ve ipucu metni.
export function etkilesim(h, mod) {
  if (!h) return null;
  const dugme = h.tip === 'cevir' ? 'Çevir →' : h.ac ? 'Katla ve aç →' : 'Katla →';
  if (mod !== 'elle') return { tur: 'dugme', sayilir: false, dugme, ipucu: 'Düğmeye bas ya da → tuşu.' };
  if (h.tip === 'cevir') return { tur: 'dokun', sayilir: false, dugme, ipucu: 'Kağıda dokun: ters çevir.' };
  return {
    tur: 'surukle', sayilir: sayilir(h), dugme,
    ipucu: h.ac ? 'Halkadan tut, hayalet işarete sürükle. Bırakınca kağıt yeniden açılır, kat izi kalır.'
      : 'Kalem halkasından tut, hayalet işarete sürükle.',
  };
}
