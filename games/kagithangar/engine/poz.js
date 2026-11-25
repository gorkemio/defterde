// Poz: katlanmış durumu 2B animasyon karesine ya da 3B uçak modeline çevirir. DOM'suz.
//
// katlanis(hz, θ): bir katlamanın θ açısındaki üstten görünüşü (atölye animasyonu). θ=0 katlanmamış, 180 katlanmış.
//   Hareket eden noktanın menteşeye uzaklığı d → d·cos θ; 90°'de parça çizgiye iner, 180°'de yansımış konuma oturur.
// poz(durum, hareketler): adımlardaki `poz` açılarıyla kanatları açılmış 3B model (uçuş, hangar, boyama görünümü).
import * as G from './geom.js';
import { KatlamaHatasi, kirisikler as onKirisikler } from './fold.js';

const ters = (yuz) => (yuz === 'on' ? 'arka' : 'on');

/* ---------------- 2B: adım animasyonu ---------------- */

// Dönüş: yığın sırasıyla [{ id, noktalar, yuz, isik, hareketli, z }].
export function katlanis(hz, theta) {
  const t = theta * Math.PI / 180;
  const [a, b] = hz.h.cizgi;
  const d = G.fark(b, a), L = Math.hypot(d[0], d[1]);
  const n = [-d[1] / L * hz.isaret, d[0] / L * hz.isaret];     // hareket eden tarafa bakan birim normal
  const c = Math.cos(t), s = Math.sin(t);
  const ileri = theta > 90;

  const hareketli = hz.hareketEdenler.map(({ kaynak, noktalar }) => {
    let zEn = 0;
    const yeni = noktalar.map(p => {
      const u = G.ic(G.fark(p, a), n);                           // menteşeye uzaklık (≥ 0)
      zEn = Math.max(zEn, u * s);
      return [p[0] + n[0] * u * (c - 1), p[1] + n[1] * u * (c - 1)];
    });
    return {
      id: kaynak.id, noktalar: yeni, yuz: ileri ? ters(kaynak.yuz) : kaynak.yuz,
      isik: 1 - 0.2 * s, hareketli: true, z: zEn, mentese: [a, b],
    };
  });
  if (ileri) hareketli.reverse();
  const sabit = hz.sabitler.map(p => ({ id: p.id, noktalar: p.noktalar, yuz: p.yuz, isik: 1, hareketli: false, z: 0 }));
  return hz.h.tip === 'dag' ? [...hareketli, ...sabit] : [...sabit, ...hareketli];
}

/* ---------------- 3B: kanatları açılmış model ---------------- */

// 3B katı dönüşüm: p' = R·p + t (R satır düzeninde 3×3).
const BIRIM3 = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };
const uygula3 = (M, p) => [
  M.R[0] * p[0] + M.R[1] * p[1] + M.R[2] * p[2] + M.t[0],
  M.R[3] * p[0] + M.R[4] * p[1] + M.R[5] * p[2] + M.t[1],
  M.R[6] * p[0] + M.R[7] * p[1] + M.R[8] * p[2] + M.t[2],
];
const yon3 = (M, v) => [
  M.R[0] * v[0] + M.R[1] * v[1] + M.R[2] * v[2],
  M.R[3] * v[0] + M.R[4] * v[1] + M.R[5] * v[2],
  M.R[6] * v[0] + M.R[7] * v[1] + M.R[8] * v[2],
];
const carp3 = (A, B) => {          // A ∘ B
  const R = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    R.push(A.R[i * 3] * B.R[j] + A.R[i * 3 + 1] * B.R[3 + j] + A.R[i * 3 + 2] * B.R[6 + j]);
  }
  return { R, t: uygula3(A, B.t) };
};
const fark3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const ic3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const birim3 = (v) => { const L = Math.hypot(...v) || 1; return v.map(x => x / L); };

// c noktasından geçen k ekseni etrafında φ dönüşü (Rodrigues).
function eksenDonusu(c, k, phi) {
  const [x, y, z] = k, C = Math.cos(phi), S = Math.sin(phi), V = 1 - C;
  const R = [
    C + x * x * V, x * y * V - z * S, x * z * V + y * S,
    y * x * V + z * S, C + y * y * V, y * z * V - x * S,
    z * x * V - y * S, z * y * V + x * S, C + z * z * V,
  ];
  const Rc = [R[0] * c[0] + R[1] * c[1] + R[2] * c[2], R[3] * c[0] + R[4] * c[1] + R[5] * c[2], R[6] * c[0] + R[7] * c[1] + R[8] * c[2]];
  return { R, t: [c[0] - Rc[0], c[1] - Rc[1], c[2] - Rc[2]] };
}

// Adımların varsayılan poz açıları: { hareketNo: derece }.
export function pozAcilari(hareketler, ek = {}) {
  const a = {};
  for (const h of hareketler) if (h.poz != null) a[h.no] = h.poz;
  return Object.assign(a, ek);
}

// Gerçek bir kağıt uçağın duruşu: kanatlar hafif yukarı (dihedral, poz 90'ın altı uçları kaldırır) ve gövdenin
// iki yarısı omurgadan birkaç derece açık (V gövde). Gövde katı = ilk kanat katından önceki son gerçek kat.
// Her gövde yarısı govde/2 dışa yattığı için kanadı o kadar indirir; dihedral bunu telafi eder (verilen = gerçek).
export const GORUNUM = { dihedral: 7, govde: 7 };
export function gorunumAcilari(hareketler, o = {}) {
  const { dihedral, govde } = { ...GORUNUM, ...o };
  const a = {};
  for (const h of hareketler) if (h.kanat && h.poz != null) a[h.no] = h.poz - dihedral - govde / 2;
  const ilkKanat = hareketler.findIndex(h => h.kanat);
  for (let i = ilkKanat - 1; i >= 0 && govde; i--) {
    const h = hareketler[i];
    if (h.tip === 'cevir' || h.ac || h.poz != null) continue;
    a[h.no] = 180 - govde;
    break;
  }
  return a;
}

// Kanadın gerçek dihedral açısı (derece): uçuş eksenindeki modelde ana düzlemin yataydan eğimi, uç yukarıysa +.
export function dihedralOlc(model, kanat) {
  const ana = anaDuzlem(model, kanat);
  if (!ana.length) return null;
  let n = yon3(ana[0].M, [0, 0, 1]);
  if (n[2] < 0) n = n.map(v => -v);
  const disa = kanat === 'sol' ? 1 : -1;                  // sol kanat +Y, sağ kanat −Y
  return Math.atan2(-n[1] * disa, n[2]) * 180 / Math.PI;
}

// Duruş açıları, menteşe omurgaya paralel olmasa da (açılı kanat katı) dihedral tam istenen değer olsun diye
// pozlanıp ölçülerek iki kez düzeltilir.
export function gorunumAcilariTam(son, hareketler, o = {}) {
  const a = gorunumAcilari(hareketler, o);
  const hedef = { ...GORUNUM, ...o }.dihedral;
  for (let tur = 0; tur < 2; tur++) {
    const m = ucusEkseni(poz(son, pozAcilari(hareketler, a)));
    for (const k of ['sol', 'sag']) {
      const h = [...hareketler].reverse().find(x => x.kanat === k && x.poz != null);
      const olcu = dihedralOlc(m, k);
      if (h && olcu != null) a[h.no] -= hedef - olcu;
    }
  }
  return a;
}

// Düşük katlama kalitesi: iki kanat farklı açıda durur (sağ sarkar, sol kalkar; gözle görülür ama abartısız).
// taban: üzerine eklenecek açılar (ör. dihedral); yoksa tasarımın poz değeri.
export function kaliteAcilari(hareketler, kalite, taban = {}) {
  if (kalite == null || kalite >= 100) return {};
  const son = (k) => [...hareketler].reverse().find(h => h.kanat === k && h.poz != null);
  const kusur = 100 - kalite, a = {};
  const sag = son('sag'), sol = son('sol');
  if (sag) a[sag.no] = (taban[sag.no] ?? sag.poz) + kusur * 0.09;
  if (sol) a[sol.no] = (taban[sol.no] ?? sol.poz) - kusur * 0.05;
  return a;
}

// Dönüş: { parcalar: [{ id, indeks, yuz, noktalar3, M, kanat }] } — kağıt koordinatında (x, y kağıt, z yukarı).
export function poz(durum, acilar) {
  const P = durum.poligonlar;
  const M = P.map(() => BIRIM3);
  const numaralar = Object.keys(acilar).map(Number).sort((a, b) => b - a);   // sondan başa

  for (const no of numaralar) {
    const etiket = 'h:' + no;
    const tasinan = P.map((p, i) => (p.etiketler.includes(etiket) ? i : -1)).filter(i => i >= 0);
    if (!tasinan.length) continue;
    // menteşe: bu hareketin kırışığını kenarında taşıyan, bu hareketle taşınmamış bir komşu
    let mentese = null;
    for (const k of durum.kirisiklar) {
      if (k.hareket !== no) continue;
      for (let i = 0; i < P.length && !mentese; i++) {
        if (P[i].etiketler.includes(etiket)) continue;
        const duz = P[i].noktalar.map(q => G.donustur(P[i].T, q));
        if (G.kenarPaylasir(duz, [k.p1, k.p2])) mentese = { i, k };
      }
      if (mentese) break;
    }
    if (!mentese) throw new KatlamaHatasi('MenteseYok', `hareket ${no}`);
    const Q = P[mentese.i], MQ = M[mentese.i];
    const Ti = G.tersT(Q.T);
    const a2 = G.donustur(Ti, mentese.k.p1), b2 = G.donustur(Ti, mentese.k.p2);
    const A = uygula3(MQ, [a2[0], a2[1], 0]), B = uygula3(MQ, [b2[0], b2[1], 0]);
    const k = birim3(fark3(B, A));
    const phi = (180 - acilar[no]) * Math.PI / 180;
    const ustte = Math.max(...tasinan) > mentese.i ? 1 : -1;     // yığında komşunun üstündeyse +z'ye kalkar
    const nQ = yon3(MQ, [0, 0, 1]);
    // taşınanların ağırlık merkezi: hangi dönüş yönü onu komşunun doğru yüzüne kaldırıyor?
    let c = [0, 0, 0], sayi = 0;
    for (const i of tasinan) for (const q of P[i].noktalar) { const r = uygula3(M[i], [q[0], q[1], 0]); c = c.map((v, j) => v + r[j]); sayi++; }
    c = c.map(v => v / sayi);
    const deneme = (f) => ic3(fark3(uygula3(eksenDonusu(A, k, f), c), c), nQ) * ustte;
    const D = eksenDonusu(A, k, deneme(phi) >= deneme(-phi) ? phi : -phi);
    for (const i of tasinan) M[i] = carp3(D, M[i]);
  }

  // Kağıdın kendi kenarı mı, kat yeri mi? (düz kağıtta dış sınırın üstündeki kenarlar 'kenar')
  const duzler = P.map(p => p.noktalar.map(q => G.donustur(p.T, q)));
  const hepsi = duzler.flat();
  const sinir = [Math.min(...hepsi.map(q => q[0])), Math.min(...hepsi.map(q => q[1])),
    Math.max(...hepsi.map(q => q[0])), Math.max(...hepsi.map(q => q[1]))];
  const ayni = (u, v) => Math.abs(u - v) < 1e-6;
  const kenarTuru = (a, b) => ((ayni(a[0], sinir[0]) && ayni(b[0], sinir[0])) || (ayni(a[0], sinir[2]) && ayni(b[0], sinir[2]))
    || (ayni(a[1], sinir[1]) && ayni(b[1], sinir[1])) || (ayni(a[1], sinir[3]) && ayni(b[1], sinir[3])) ? 'kenar' : 'kat');

  return {
    parcalar: P.map((p, i) => ({
      id: p.id, indeks: i, yuz: p.yuz, M: M[i], etiketler: p.etiketler,
      kanat: (p.etiketler.find(e => e.startsWith('kanat:')) || '').slice(6) || null,
      noktalar2: p.noktalar,
      noktalar3: p.noktalar.map(q => uygula3(M[i], [q[0], q[1], 0])),
      kenarTurleri: duzler[i].map((q, j) => kenarTuru(q, duzler[i][(j + 1) % duzler[i].length])),
      kirisikler2: onKirisikler(durum, p),
    })),
  };
}

// Kağıt koordinatındaki modeli uçuş eksenine döndürür: X ileri (burun), Y sol, Z yukarı; gövde üstü Z = 0.
// Kağıtta burun y = 0'da; "yukarı" omurgadan kanat menteşelerine doğru (çift sayıda çevirde -x yönünde olur).
// Dönüşüm katı (det = +1): yazı aynalanmaz.
export function ucusEkseni(model) {
  const ortX = (ps) => { const xs = ps.flatMap(p => p.noktalar3.map(q => q[0])); return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); };
  const kanatlar = model.parcalar.filter(p => p.kanat), govdeP = model.parcalar.filter(p => !p.kanat);
  const yukari = kanatlar.length && govdeP.length && ortX(kanatlar) < ortX(govdeP) ? -1 : 1;
  const don = ([x, y, z]) => [-y, -z * yukari, x * yukari];
  const R = { R: [0, -1, 0, 0, 0, -yukari, yukari, 0, 0], t: [0, 0, 0] };
  let parcalar = model.parcalar.map(p => ({ ...p, M: carp3(R, p.M), noktalar3: p.noktalar3.map(don) }));
  // V gövde: gövde yarılarının normallerinin ortalaması yatay olsun (X ekseni etrafında yalpa düzeltmesi)
  const normaller = [];
  for (const p of parcalar.filter(q => !q.kanat)) {
    let n = yon3(p.M, [0, 0, 1]);
    if (n[1] < 0) n = n.map(v => -v);
    if (!normaller.some(m => Math.hypot(m[0] - n[0], m[1] - n[1], m[2] - n[2]) < 1e-6)) normaller.push(n);
  }
  if (normaller.length) {
    const ort = normaller.reduce((a, n) => a.map((v, j) => v + n[j]), [0, 0, 0]);
    const a = Math.atan2(-ort[2], ort[1]);
    if (Math.abs(a) > 1e-12) {
      const c = Math.cos(a), s = Math.sin(a);
      const Rx = { R: [1, 0, 0, 0, c, -s, 0, s, c], t: [0, 0, 0] };
      parcalar = parcalar.map(p => ({ ...p, M: carp3(Rx, p.M), noktalar3: p.noktalar3.map(q => uygula3(Rx, q)) }));
    }
  }
  // Kanat kirişi: açılı kanat katında (gövde burunda sıfır, kuyrukta derin) kanatlar yatay dursun, omurga kuyruğa
  // doğru insin. İki kanadın ana düzlem normallerinin ortalaması Y etrafında düşeye çevrilir.
  const kanatNormalleri = ['sol', 'sag'].map(k => {
    const ana = anaDuzlemListe(parcalar, k);
    if (!ana.length) return null;
    let n = yon3(ana[0].M, [0, 0, 1]);
    if (n[2] < 0) n = n.map(v => -v);
    return n;
  }).filter(Boolean);
  if (kanatNormalleri.length) {
    const ort = kanatNormalleri.reduce((a, n) => a.map((v, j) => v + n[j]), [0, 0, 0]);
    const b = Math.atan2(ort[0], ort[2]);                  // X'e doğru eğim; −b döndürünce düşey
    if (Math.abs(b) > 1e-9) {
      const c = Math.cos(-b), s = Math.sin(-b);
      const Ry = { R: [c, 0, s, 0, 1, 0, -s, 0, c], t: [0, 0, 0] };
      parcalar = parcalar.map(p => ({ ...p, M: carp3(Ry, p.M), noktalar3: p.noktalar3.map(q => uygula3(Ry, q)) }));
    }
  }
  const govde = parcalar.filter(p => !p.kanat);
  const govdeN = (govde.length ? govde : parcalar).flatMap(p => p.noktalar3);
  const zUst = Math.max(...govdeN.map(q => q[2]));
  const yOrta = (Math.min(...govdeN.map(q => q[1])) + Math.max(...govdeN.map(q => q[1]))) / 2;
  const xler = parcalar.flatMap(p => p.noktalar3.map(q => q[0]));
  const xOrta = (Math.min(...xler) + Math.max(...xler)) / 2;
  const kaydir = (q) => [q[0] - xOrta, q[1] - yOrta, q[2] - zUst];
  return {
    parcalar: parcalar.map(p => ({ ...p, M: { R: p.M.R, t: kaydir(p.M.t) }, noktalar3: p.noktalar3.map(kaydir) })),
  };
}

// İki düzlemin buluştuğu kat yerleri (kanat kökü, kanat ucu, omurga): o kenarın içe doğru gölgesi çizilir.
// Her parçaya menteseler: [kenar indeksi] ekler. Model başına bir kez (poz değişmedikçe).
export function menteseleriIsaretle(model) {
  const kenarlar = [];
  model.parcalar.forEach((p, pi) => {
    const anahtar = grupAnahtari(p.M), n = p.noktalar3.length;
    p.noktalar3.forEach((a, i) => kenarlar.push({ pi, i, anahtar, a, b: p.noktalar3[(i + 1) % n] }));
  });
  const ust = (a, b, c, d) => {
    const u = fark3(b, a), L = Math.hypot(...u);
    if (L < 1e-9) return false;
    const k = u.map(v => v / L);
    const yer = (q) => { const w = fark3(q, a), t = ic3(w, k); return [t, Math.hypot(w[0] - k[0] * t, w[1] - k[1] * t, w[2] - k[2] * t)]; };
    const [t1, d1] = yer(c), [t2, d2] = yer(d);
    if (d1 > 1e-6 || d2 > 1e-6) return false;
    return Math.min(L, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 1e-4;
  };
  const mentese = model.parcalar.map(() => []);
  for (const e of kenarlar) {
    const p = model.parcalar[e.pi];
    if (p.kenarTurleri && p.kenarTurleri[e.i] === 'kenar') continue;
    if (kenarlar.some(f => f.anahtar !== e.anahtar && ust(e.a, e.b, f.a, f.b))) mentese[e.pi].push(e.i);
  }
  return { parcalar: model.parcalar.map((p, i) => ({ ...p, menteseler: mentese[i] })) };
}

/* ---------------- kamera ---------------- */

// Z etrafında yaw, sonra yukarıdan pitch. Ekran y aşağı. o.f verilirse hafif perspektif: izleyici f birim
// uzakta (uzak nokta küçülür); verilmezse ortografik. Derinlik büyüdükçe uzak.
export function kamera(yawDer, pitchDer, o = {}) {
  const yw = yawDer * Math.PI / 180, pt = pitchDer * Math.PI / 180;
  const cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt);
  const odak = o.f || 0;
  const f = ([x, y, z]) => {
    const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
    const derinlik = y1 * cp - z * sp;
    const k = odak ? odak / (odak + derinlik) : 1;
    return { x: x1 * k, y: -(z * cp + y1 * sp) * k, derinlik };
  };
  f.bakis = [sy * cp, cy * cp, -sp];             // izleyiciden sahneye doğru
  return f;
}
// UCUS: önden-yandan, gövde (omurga) kanatların altında görünsün; SAHNE: yan görünüşlü uçuş sahnesi.
export const KAMERALAR = {
  UCUS: [-34, 17, { f: 9 }], HANGAR: [-26, 24, { f: 9 }], USTTEN: [0, 90], SAHNE: [-16, 24],
};

// Işık uçuş ekseninde (X burun, Y sol, Z yukarı): yukarıdan, biraz önden ve sağdan. Kanat üstü tam aydınlık,
// görünen gövde yanı yarı gölgede, alt yüzler koyu.
export const ISIK = birim3([0.3, -0.25, 1]);
export const ORTAM = 0.6;
export const KALINLIK = 0.0012;                 // katman başına (kağıt birimi): yığınlar katman katman okunur

export const grupAnahtari = (M) => M.R.map(v => v.toFixed(5)).join() + '|' + M.t.map(v => v.toFixed(5)).join();

// Düzlem grupları (aynı katı dönüşüm = aynı düzlem). Gruplar, düzlem ayrımıyla (bir grup ötekinin düzleminin
// tamamen arkasındaysa önce çizilir) ve eşitlikte derinlikle sıralanır; grup içinde kameraya doğru yığın sırası.
// Her katman, grubun ortasına göre normal boyunca KALINLIK kadar kaydırılır.
// Dönüş: { parcalar: [{ id, indeks, kanat, sanal, anahtar, yuz, isik, ustte, M (kaydırılmış), noktalar2,
//   noktalar (ekran), kenarTurleri, kirisikler (ekran), menteseler (ekran kenarları) }], golge, isik }.
export function izdusum(model, kam, o = {}) {
  const L = o.isik || ISIK, ortam = o.ortam ?? ORTAM, kalinlik = o.kalinlik ?? KALINLIK;
  const gruplar = new Map();
  for (const p of model.parcalar) {
    const anahtar = grupAnahtari(p.M);
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(p);
  }
  const ekr = (q) => { const r = kam(q); return [r.x, r.y]; };
  const liste = [...gruplar.entries()].map(([anahtar, ps]) => {
    const n = yon3(ps[0].M, [0, 0, 1]);
    const bakiyor = ic3(n, kam.bakis) < 0;                 // yerel +z kameraya dönük
    const nGor = bakiyor ? n : n.map(v => -v);
    const isik = ortam + (1 - ortam) * Math.min(1, Math.max(0, ic3(nGor, L)) / L[2]);
    const yigin = ps.slice().sort((a, b) => a.indeks - b.indeks);
    const orta = (yigin.length - 1) / 2;
    const kayma = new Map(yigin.map((p, r) => [p, n.map(v => v * (r - orta) * kalinlik)]));
    let derinlik = 0, sayi = 0;
    for (const p of ps) for (const q of p.noktalar3) { derinlik += kam(q).derinlik; sayi++; }
    const sirali = bakiyor ? yigin : yigin.slice().reverse();
    return {
      anahtar, n, nokta: ps[0].noktalar3[0], noktalar: ps.flatMap(p => p.noktalar3), derinlik: derinlik / sayi,
      parcalar: sirali.map((p, r) => {
        const v = kayma.get(p);
        const M = { R: p.M.R, t: [p.M.t[0] + v[0], p.M.t[1] + v[1], p.M.t[2] + v[2]] };
        const n3 = p.noktalar3.map(q => [q[0] + v[0], q[1] + v[1], q[2] + v[2]]);
        const ekranda = n3.map(ekr);
        return {
          id: p.id, indeks: p.indeks, kanat: p.kanat, sanal: p.sanal || null, anahtar, yuz: bakiyor ? p.yuz : ters(p.yuz),
          isik, ustte: r > 0, M, noktalar2: p.noktalar2, noktalar: ekranda,
          kenarTurleri: p.kenarTurleri || null,
          kirisikler: (p.kirisikler2 || []).map(sg => sg.map(q => ekr(uygula3(M, [q[0], q[1], 0])))),
          menteseler: (p.menteseler || []).map(i => [ekranda[i], ekranda[(i + 1) % ekranda.length]]),
        };
      }),
    };
  });
  const sira = duzlemSirasi(liste, kam.bakis);
  const zemin = o.zemin ?? -0.3;
  const golge = model.parcalar.map(p => p.noktalar3.map(q => {
    const t = (q[2] - zemin) / L[2];
    return ekr([q[0] - L[0] * t, q[1] - L[1] * t, zemin]);
  }));
  return { parcalar: sira.flatMap(g => g.parcalar), golge, isik: L };
}

// Ressam sırası: i grubu j'nin düzleminin tamamen arkasındaysa (ya da j, i'nin düzleminin tamamen önündeyse)
// i önce. Kısıt olmayan çiftlerde ve döngüde uzaktaki önce.
function duzlemSirasi(liste, bakis) {
  const N = liste.length, EPS = 1e-5;
  const once = liste.map(() => new Set());
  const yan = (g, q) => ic3(fark3(q, g.nokta), g.n) * -Math.sign(ic3(g.n, bakis));   // + izleyici tarafı
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j || Math.abs(ic3(liste[j].n, bakis)) < 1e-9) continue;
    let arkada = true, onde = true;
    for (const q of liste[i].noktalar) { const d = yan(liste[j], q); if (d > EPS) arkada = false; if (d < -EPS) onde = false; }
    if (arkada && !onde) once[j].add(i);
    else if (onde && !arkada) once[i].add(j);
  }
  const kalan = new Set(liste.keys()), sonuc = [];
  while (kalan.size) {
    let sec = -1;
    for (const i of kalan) {
      if ([...once[i]].some(k => kalan.has(k))) continue;
      if (sec < 0 || liste[i].derinlik > liste[sec].derinlik) sec = i;
    }
    if (sec < 0) for (const i of kalan) if (sec < 0 || liste[i].derinlik > liste[sec].derinlik) sec = i;
    kalan.delete(sec);
    sonuc.push(liste[sec]);
  }
  return sonuc;
}

/* ---------------- ayar paneli: sanal katlar ---------------- */

const matAnahtari = (p) => grupAnahtari(p.M);

// Bir kanadın ana düzlemi (kanat ucu katları ve sanal katlar hariç): en çok parçanın paylaştığı dönüşüm.
export const anaDuzlem = (model, kanat) => anaDuzlemListe(model.parcalar, kanat);
function anaDuzlemListe(parcalar, kanat) {
  const adaylar = parcalar.filter(p => p.kanat === kanat && !p.sanal);
  if (!adaylar.length) return [];
  const sayac = new Map();
  for (const p of adaylar) sayac.set(matAnahtari(p), (sayac.get(matAnahtari(p)) || 0) + 1);
  const ana = [...sayac.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return adaylar.filter(p => matAnahtari(p) === ana);
}

// Kanadın ana düzlemindeki bütün katmanları (son durumun 2B koordinatında) çizgiyle böl, tut tarafını menteşe
// etrafında `aci` derece bük (pozitif = dünya +Z, yukarı). Kağıdın katmanları birlikte bükülür.
export function sanalKat(model, { kanat, cizgi, tut, aci, ad }) {
  if (!aci) return model;
  const ana = new Set(anaDuzlem(model, kanat));
  if (!ana.size) return model;
  const isaret = Math.sign(G.taraf(cizgi, tut)) || 1;
  const M0 = [...ana][0].M;
  const A = uygula3(M0, [cizgi[0][0], cizgi[0][1], 0]), B = uygula3(M0, [cizgi[1][0], cizgi[1][1], 0]);
  const k = birim3(fark3(B, A));
  const kalanlar = [], kanatciklar = [];
  for (const p of model.parcalar) {
    if (!ana.has(p)) { kalanlar.push(p); continue; }
    const ic = G.kes(p.noktalar2, cizgi, -isaret), dis = G.kes(p.noktalar2, cizgi, isaret);
    const parca = (n, ek) => ({
      ...p, ...ek, noktalar2: n, noktalar3: n.map(q => uygula3(p.M, [q[0], q[1], 0])),
      kenarTurleri: kenarlariTasi(p.noktalar2, p.kenarTurleri, n),
      kirisikler2: (p.kirisikler2 || []).map(sg => G.parcaKirp(sg, G.ccw(n))).filter(Boolean),
    });
    if (ic.length && Math.abs(G.alan(ic)) > 1e-9) kalanlar.push(parca(ic, {}));
    if (dis.length && Math.abs(G.alan(dis)) > 1e-9) kanatciklar.push(parca(dis, { sanal: ad }));
  }
  if (!kanatciklar.length) return model;
  let c = [0, 0, 0], sayi = 0;
  for (const p of kanatciklar) for (const q of p.noktalar3) { c = c.map((v, j) => v + q[j]); sayi++; }
  c = c.map(v => v / sayi);
  const phi = Math.abs(aci) * Math.PI / 180;
  const yukari = (f) => uygula3(eksenDonusu(A, k, f), c)[2] - c[2];
  const f = (yukari(phi) >= yukari(-phi)) === (aci > 0) ? phi : -phi;
  const D = eksenDonusu(A, k, f);
  return {
    parcalar: [...kalanlar, ...kanatciklar.map(p => ({ ...p, M: carp3(D, p.M), noktalar3: p.noktalar3.map(q => uygula3(D, q)) }))],
  };
}

// Bölünen poligonun kenar türleri: eski bir kenarın üstündeki yeni kenar onun türünü alır, kesik yeni kattır.
function kenarlariTasi(eski, turler, yeni) {
  const dogruda = (q, c, d) => Math.abs(G.capraz(G.fark(d, c), G.fark(q, c))) / (G.uzaklik(c, d) || 1) < 1e-7;
  return yeni.map((a, i) => {
    const b = yeni[(i + 1) % yeni.length];
    for (let j = 0; j < eski.length; j++) {
      const c = eski[j], d = eski[(j + 1) % eski.length];
      if (dogruda(a, c, d) && dogruda(b, c, d)) return (turler && turler[j]) || 'kat';
    }
    return 'kat';
  });
}

// Kanadın son durumdaki 2B sınırları: menteşe tarafı ve dış uç.
export function kanatGeometrisi(model, kanat) {
  const ana = anaDuzlem(model, kanat);
  const govde = model.parcalar.filter(p => !p.kanat);
  if (!ana.length) return null;
  const xs = ana.flatMap(p => p.noktalar2.map(q => q[0])), ys = ana.flatMap(p => p.noktalar2.map(q => q[1]));
  const gx = govde.flatMap(p => p.noktalar2.map(q => q[0]));
  const gOrt = gx.reduce((a, b) => a + b, 0) / (gx.length || 1);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const [menteseX, disX] = Math.abs(x0 - gOrt) < Math.abs(x1 - gOrt) ? [x0, x1] : [x1, x0];
  return { menteseX, disX, yon: Math.sign(menteseX - disX), yUst: Math.min(...ys), yArka: Math.max(...ys) };
}

// Kanadın ana düzleminin yerel 2B koordinatında uçuş yönleri: F = ileri (burna doğru), O = dışa (kanat ucuna).
// Kat çizgisi açılı da olsa (dart) dikey de olsa doğru köşeyi bulmak için kullanılır.
export function kanatYonleri(model, kanat) {
  const ana = anaDuzlem(model, kanat);
  if (!ana.length) return null;
  const R = ana[0].M.R;
  const birim = ([x, y]) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
  const F = birim([R[0], R[1]]);
  const O = birim(kanat === 'sol' ? [R[3], R[4]] : [-R[3], -R[4]]);
  return { ana, F, O, noktalar: ana.flatMap(p => p.noktalar2) };
}

// Ayar paneli → sanal katlar. ayar: { kanatcik: -2..2, kivrimSol: -1..1, kivrimSag: -1..1 }.
// Kıvrım: kanadın dış şeridi (veter boyunca, uçtan 0.07) ±25°; kanatçık: firar kenarının dış köşesi ±12° adım başına.
export function ayarKatlari(model, ayar = {}) {
  let m = model;
  const ic2 = (a, b) => a[0] * b[0] + a[1] * b[1];
  for (const kanat of ['sol', 'sag']) {
    const y = kanatYonleri(m, kanat);
    if (!y) continue;
    const kivrim = ayar[kanat === 'sol' ? 'kivrimSol' : 'kivrimSag'] || 0;
    if (kivrim) {
      const uc = y.noktalar.reduce((a, b) => (ic2(b, y.O) > ic2(a, y.O) ? b : a));
      const c = ic2(uc, y.O) - 0.07;
      const a = [y.O[0] * c, y.O[1] * c], d = [-y.O[1], y.O[0]];
      m = sanalKat(m, { kanat, ad: 'kivrim', aci: 25 * kivrim, cizgi: [[a[0] - 3 * d[0], a[1] - 3 * d[1]], [a[0] + 3 * d[0], a[1] + 3 * d[1]]], tut: uc });
    }
    const k = ayar.kanatcik || 0;
    if (k) {
      const y2 = kanatYonleri(m, kanat);
      // firar kenarının dış köşesi: en geride ve en dışta
      const C = y2.noktalar.reduce((a, b) => (ic2(b, y2.O) - ic2(b, y2.F) > ic2(a, y2.O) - ic2(a, y2.F) ? b : a));
      const p1 = [C[0] + y2.F[0] * 0.14, C[1] + y2.F[1] * 0.14];
      const p2 = [C[0] - y2.O[0] * 0.24, C[1] - y2.O[1] * 0.24];
      m = sanalKat(m, { kanat, ad: 'kanatcik', aci: 12 * k, cizgi: [p1, p2], tut: C });
    }
  }
  return m;
}

// Boya noktası (kanadın ana düzleminde, son durumun 2B koordinatı) → üstten görünen katman ve düz kağıt noktası.
// Kalıcı kayıt düz kağıt koordinatını da tutar (Faz 7: şablona baskı).
export function boyaNoktasi(durum, model, kanat, [x, y]) {
  const ana = anaDuzlem(model, kanat).filter(p => G.icinde(G.ccw(p.noktalar2), [x, y], 1e-6));
  if (!ana.length) return null;
  const yukariBakiyor = yon3(ana[0].M, [0, 0, 1])[2] >= 0;
  const ust = ana.reduce((a, b) => ((yukariBakiyor ? b.indeks > a.indeks : b.indeks < a.indeks) ? b : a));
  const pol = durum.poligonlar.find(q => q.id === ust.id);
  const [fx, fy] = G.donustur(pol.T, [x, y]);
  return { poligonId: ust.id, fx, fy };
}

// İsmin yeri (kanadın 2B koordinatı ×100): kanadın köke yakın, en uzun olduğu şeridi; boyu o şeride sığacak kadar.
export function isimYeri(g, kirp, ad, olcek = 1) {
  if (!g || !ad) return null;
  const genislik = Math.abs(g.menteseX - g.disX) * 100;
  const cx = (g.disX + (g.menteseX - g.disX) * 0.66) * 100;
  let y0 = Infinity, y1 = -Infinity;
  for (const n of kirp) {
    const s = G.parcaKirp([[cx, -1e4], [cx, 1e4]], G.ccw(n));
    if (s) { y0 = Math.min(y0, s[0][1], s[1][1]); y1 = Math.max(y1, s[0][1], s[1][1]); }
  }
  if (!isFinite(y0)) return null;
  // boyut: kanadın genişliği (stilin ölçeğiyle) ya da kanat boyunca sığacak uzunluk, hangisi küçükse
  const boyut = Math.max(3, Math.min(genislik * 0.22 * olcek, (y1 - y0) * 0.86 / (0.5 * Math.max(4, [...ad].length))));
  return { cx, cy: (y0 + y1) / 2, boyut };
}

// Düz kağıt noktası → ekrana giden afin (o parçanın yerel düzlemi üzerinden). Dönüş [a, b, c, d, e, f]:
// x' = a·x + c·y + e, y' = b·x + d·y + f (SVG/canvas matrisi sırası). Ortografikte tam; perspektifte merkez
// (düz kağıt noktası) çevresinde doğrusal yaklaşım, o yüzden çizilen parçanın merkezi verilir.
export function duzdenEkrana(T, M, kam, ekran, merkez = [0, 0]) {
  const Ti = G.tersT(T);
  const ek = (q) => { const l = G.donustur(Ti, q); const r = kam(uygula3(M, [l[0], l[1], 0])); return ekran([r.x, r.y]); };
  return afinCerceve(ek, merkez);
}

// f: düzlem noktası → ekran. Merkez çevresinde (h adımla) doğrusal yaklaşım; matris düzlem koordinatını alır.
export function afinCerceve(f, [cx, cy] = [0, 0], h = 0.05) {
  const O = f([cx, cy]), X = f([cx + h, cy]), Y = f([cx, cy + h]);
  const a = (X[0] - O[0]) / h, b = (X[1] - O[1]) / h, c = (Y[0] - O[0]) / h, d = (Y[1] - O[1]) / h;
  return [a, b, c, d, O[0] - a * cx - c * cy, O[1] - b * cx - d * cy];
}
