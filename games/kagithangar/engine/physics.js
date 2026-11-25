// Uçuş fiziği: 2D yan görünüm + basit yanal model. DOM'suz, belirlenimci (aynı atış = aynı uçuş).
// Durum: x (ileri, m), y (yükseklik, m), vx, vy (m/s), th (burun açısı, rad), om (yunuslama hızı, rad/s),
//        psi (yanal sapma açısı, rad), z (yanal konum, m), t (s).
// Sabit dt = 1/120 s, yarı-örtük Euler (önce hızlar, sonra konumlar).

export const DT = 1 / 120;
const RHO = 1.2, G = 9.81, DER = Math.PI / 180;

/* ------------------------------------------------------------------------------------------------
   PARAMETRE TABLOSU — tasarımın karakter sayıları (1–10) → aerodinamik katsayılar.
   Planlamada node simülasyonuyla ayarlandı (PLAN.md §7). Tek yer burası.
     S      kanat alanı (m²)            0.012 + 0.0018·süzülme        geniş kanat = çok taşıma
     m      kütle (kg)                  0.005 + 0.001·ataç             A4 ≈ 5 g, ataç ≈ 1 g
     CLa    taşıma eğimi (1/rad)        2.5 + 0.25·süzülme
     CD0    sıfır taşımada sürükleme    0.040 − 0.0025·hız − 0.001·süzülme
     k      indüklenmiş sürükleme       0.12 − 0.006·süzülme
     vTrim  denge hızı (m/s)            1.9 + 0.75·hız + 0.4·ataç      dart hızlı, planör yavaş süzülür
     aTrim  denge hücum açısı           CL_trim/CLa + kanatçık·(1 + 0.85·akrobasi)°
     aStall stall açısı                 12° + 0.5·akrobasi
     qEsnek kağıt esnekliği (Pa)        150 − 10·s + 25·max(0, s − 5)  hızlıyken kanat bükülür, taşıma sınırlanır
     Cma    statik denge                0.3 + 0.08·denge
     Cmq    yunuslama sönümü            0.5 + 0.2·d − 0.08·max(0, s − 5)
   Geniş kanatlı planörlerde (süzülme > 5) kanat daha sert, sönüm daha az: gerçek planör gibi hafifçe
   dalgalanarak (phugoid) süzülür; dart düz gider.
   Stall'dan sonra sürükleme artar (kağıt havayı keser): CD = CD0 + k·CL² + 0.8·(|α_eff| − α_stall).
   Moment ham α ile hesaplanır (esneme kanadı büker, burnun trim açısını değil).
   Kalite, kıvrım ve yıpranma (10 kırışıktan sonra) sürüklemeyi artırır, yanal sapma ve yalpa ekler.
------------------------------------------------------------------------------------------------ */

// Tohumlu küçük rastgele (yıpranma gürültüsü, sapma yönü): aynı uçak hep aynı yöne kayar.
function tohumluRastgele(metin) {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) { h ^= metin.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0 || 1;
  return () => { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; };
}

export function parametreler(tasarim, ucak = {}) {
  const { hiz, suzulme, denge, akrobasi } = tasarim.karakter;
  const ayar = { kanatcik: 0, kivrimSol: 0, kivrimSag: 0, atac: 0, ...(ucak.ayar || {}) };
  const kalite = ucak.kalite ?? 100;
  const kusur = (100 - kalite) / 100;
  const r = tohumluRastgele(ucak.id || tasarim.id);
  const yon = r() < 0.5 ? -1 : 1;                     // sapma yönü ilk sayı: yıpranma gürültüsü onu değiştirmesin

  const S = 0.012 + 0.0018 * suzulme;
  const m = 0.005 + 0.001 * ayar.atac;
  let CLa = 2.5 + 0.25 * suzulme;
  let CD0 = 0.040 - 0.0025 * hiz - 0.001 * suzulme;
  const k = 0.12 - 0.006 * suzulme;
  const vTrim = 1.9 + 0.75 * hiz + 0.4 * ayar.atac;
  const CLtrim = 2 * m * G / (RHO * S * vTrim * vTrim);
  let aTrim = CLtrim / CLa + ayar.kanatcik * (1 + 0.85 * akrobasi) * DER;
  let Cma = 0.3 + 0.08 * denge;
  const ayniYon = Math.sign(ayar.kivrimSol) === Math.sign(ayar.kivrimSag) && ayar.kivrimSol !== 0;
  if (ayniYon) Cma += 0.05 * Math.abs(ayar.kivrimSol);

  CD0 *= 1 + 0.5 * kusur + 0.1 * (Math.abs(ayar.kivrimSol) + Math.abs(ayar.kivrimSag));
  const fazlaKirisik = Math.max(0, ((ucak.yipranma && ucak.yipranma.kirisik) || 0) - 10);
  if (fazlaKirisik) {                                   // buruşuk kağıt: daha çok sürükleme, daha az taşıma, burun aşağı
    CD0 *= 1 + 0.05 * fazlaKirisik;
    CLa *= Math.max(0.6, 1 - 0.015 * fazlaKirisik);
    aTrim += (-0.1 + (r() - 0.5) * 0.2) * DER * fazlaKirisik;
  }
  const fazlaSuzulme = Math.max(0, suzulme - 5);
  return {
    S, m, CLa, CD0, k, vTrim, aTrim,
    aStall: (12 + 0.5 * akrobasi) * DER,
    qEsnek: 150 - 10 * suzulme + 25 * fazlaSuzulme,
    Cma, Cmq: 0.5 + 0.2 * denge - 0.08 * fazlaSuzulme, c: 0.1, I: m * 0.08 * 0.08,
    sapma: 0.15 * kusur * yon + 0.2 * (ayar.kivrimSag - ayar.kivrimSol),   // rad/s
    yalpa: 0.05 * kusur,                                                     // rad/s genlik
    yatis: 15 * DER * kusur,                                                 // görüntüde kanat yalpası (rad)
  };
}

const etkinAci = (P, alfa, q) => alfa / (1 + q / P.qEsnek);

// Taşıma katsayısı: doğrusal, stall'dan sonra 8° içinde %35'e düşer. Kağıt esnekliği hızlıyken açıyı yumuşatır.
export function CL(P, alfa, q = 0) {
  const a = etkinAci(P, alfa, q);
  const s = Math.sign(a), aa = Math.abs(a);
  if (aa <= P.aStall) return P.CLa * a;
  const CLmax = P.CLa * P.aStall;
  const a2 = P.aStall + 8 * DER;
  if (aa < a2) return s * CLmax * (1 - 0.65 * (aa - P.aStall) / (a2 - P.aStall));
  return s * 0.35 * CLmax;
}

// Sürükleme katsayısı: parazit + indüklenmiş; stall'dan sonra kopan akış sürüklemeyi hızla artırır.
export function CD(P, alfa, q = 0, cl = CL(P, alfa, q)) {
  const asim = Math.max(0, Math.abs(etkinAci(P, alfa, q)) - P.aStall);
  return P.CD0 + P.k * cl * cl + 0.8 * asim;
}

import { sahneHazirla } from './sahneler.js';
export const SAHNE_SINIF = sahneHazirla('sinif');
export const SAHNE_ACIK = { id: 'acik', ad: 'acik', uzunluk: Infinity, tavan: Infinity, yanDuvar: Infinity, pencere: null, el: [0.5, 1.3], zeminY: () => 0, ruzgar: null };
const zemin = (sahne, x) => (sahne.zeminY ? sahne.zeminY(x) : 0);
const ruzgarHizi = (sahne, t) => (sahne.ruzgar ? sahne.ruzgar(t) : 0);
export const PENCERE_BONUSU = 8;
const SURTUNME = 1.5, SERT_INIS = 4.0;     // kağıt yerde çabuk durur; 4 m/s'den sert düşüş = çarpma
export const PSI_SINIRI = 0.9;             // yanal sapma açısı (rad): kağıt uçak kendi üstüne dönüp geri gelmez
export const ORNEK_HZ = 60, YOL_NOKTASI = 60;

export function baslat(P, { hiz, aci, x0 = 0.5, y0 = 1.3, sahne }) {
  if (sahne && sahne.el) { x0 = sahne.el[0]; y0 = sahne.el[1]; }
  const a = aci * DER;
  return { t: 0, x: x0, y: y0, vx: hiz * Math.cos(a), vy: hiz * Math.sin(a), th: a + P.aTrim, om: 0, psi: 0, z: 0, yerde: false, bitti: false };
}

const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Bir adım. Dönüş: yeni durum ve bu adımda olan olaylar.
export function adim(d, P, sahne, dt = DT) {
  const olaylar = [];
  const n = { ...d };
  if (d.bitti) return { durum: n, olaylar };

  if (d.yerde && n.y > zemin(sahne, n.x) + 0.01) n.yerde = false;   // sahanlığın kenarından düştü
  if (n.yerde) {                                        // yerde kayma: sürtünmeyle durur
    const v = Math.abs(n.vx);
    const yavas = SURTUNME * G * dt;
    n.vx = v <= yavas ? 0 : n.vx - Math.sign(n.vx) * yavas;
    n.x = Math.min(n.x + n.vx * Math.cos(n.psi) * dt, sahne.uzunluk - 0.01);
    n.z = Math.max(-sahne.yanDuvar, Math.min(sahne.yanDuvar, n.z + n.vx * Math.sin(n.psi) * dt));
    n.th += (0 - n.th) * Math.min(1, 12 * dt);
    n.t += dt;
    if (n.y > zemin(sahne, n.x) + 0.01) { n.yerde = false; return { durum: n, olaylar }; }
    if (Math.abs(n.vx) < 0.2) { n.vx = 0; n.bitti = true; olaylar.push({ tur: 'durdu', t: n.t }); }
  } else {
    const w = ruzgarHizi(sahne, n.t);                     // rüzgâr: + arkadan; kuvvetler havaya göre hızla
    const hx = n.vx - w, hy = n.vy;
    const v = Math.max(Math.hypot(hx, hy), 1e-3);
    const gamma = Math.atan2(hy, hx);
    const alfa = sar(n.th - gamma);
    const q = 0.5 * RHO * v * v;
    const cl = CL(P, alfa, q), cd = CD(P, alfa, q, cl);
    const L = q * P.S * cl, Dr = q * P.S * cd;
    const ux = hx / v, uy = hy / v;
    const ax = (-Dr * ux - L * uy) / P.m;
    const ay = (-Dr * uy + L * ux) / P.m - G;
    const M = q * P.S * P.c * (-P.Cma * (alfa - P.aTrim) - P.Cmq * n.om * P.c / (2 * Math.max(v, 0.5)));
    n.om += M / P.I * dt;
    n.vx += ax * dt;
    n.vy += ay * dt;
    n.th += n.om * dt;
    n.psi = Math.max(-PSI_SINIRI, Math.min(PSI_SINIRI, n.psi + (P.sapma + P.yalpa * Math.sin(2 * Math.PI * 1.5 * n.t)) * dt));
    n.x += n.vx * Math.cos(n.psi) * dt;
    n.z += n.vx * Math.sin(n.psi) * dt;
    n.y += n.vy * dt;
    n.t += dt;

    if (n.y >= sahne.tavan) {
      n.y = sahne.tavan; n.vy = -0.3 * Math.abs(n.vy); n.om *= -0.3;
      olaylar.push({ tur: 'tavan', t: n.t, x: n.x });
    }
    if (n.x >= sahne.uzunluk) {
      const p = sahne.pencere;
      if (p && n.y >= p.y1 && n.y <= p.y2 && Math.abs(n.z) <= p.z) {
        n.bitti = true;
        olaylar.push({ tur: 'pencere', t: n.t, x: n.x, y: n.y });
        return { durum: n, olaylar };
      }
      n.x = sahne.uzunluk - 0.01;
      n.vx = -0.15 * Math.abs(n.vx); n.vy = Math.min(n.vy, 0); n.om = -6;
      olaylar.push({ tur: 'duvar', t: n.t, y: n.y });
    }
    if (Math.abs(n.z) >= sahne.yanDuvar) {
      n.z = Math.sign(n.z) * sahne.yanDuvar; n.psi = 0; n.vx *= 0.2;
      olaylar.push({ tur: 'yanDuvar', t: n.t, x: n.x });
    }
    const zy = zemin(sahne, n.x);
    if (n.y <= zy) {
      if (d.y < zy - 1e-9 && zemin(sahne, d.x) < zy - 1e-9) {
        // yükseltilmiş zemine (sahanlık) alttan girdi: üstüne ışınlanmaz, kenarına çarpar
        n.x = d.x; n.vx = -0.15 * Math.abs(n.vx); n.om = -4;
        olaylar.push({ tur: 'duvar', t: n.t, y: n.y });
      } else {
        const sert = Math.abs(n.vy) > SERT_INIS;
        n.y = zy; n.vy = 0; n.om = 0; n.yerde = true;
        olaylar.push({ tur: sert ? 'yereCakildi' : 'indi', t: n.t, x: n.x });
      }
    }
  }
  return { durum: n, olaylar };
}

// Kırışık sayısı: duvara, yan duvara ya da sertçe yere değme. Duvara sürtünen uçak her adımda olay üretir;
// bir temas (aynı türden, aralarında 0,3 sn'den kısa olaylar) tek kırışık sayılır.
export function temasSayisi(olaylar) {
  const son = {};
  let n = 0;
  for (const e of olaylar) {
    if (e.tur !== 'duvar' && e.tur !== 'yanDuvar' && e.tur !== 'yereCakildi') continue;
    if (!(son[e.tur] != null && e.t - son[e.tur] < 0.3)) n++;
    son[e.tur] = e.t;
  }
  return n;
}

// Bütün uçuş. Dönüş: uçuş kaydı (fiş ve oynatım için).
export function simule(P, firlatma, sahne = SAHNE_SINIF, o = {}) {
  const enUzun = o.enUzunSure ?? 25;
  let d = baslat(P, { ...firlatma, sahne: firlatma.x0 == null ? sahne : null });
  const x0 = d.x;
  const ornekler = [{ t: 0, x: d.x, y: d.y, th: d.th, z: d.z, ro: 0, v: Math.hypot(d.vx, d.vy) }];
  const olaylar = [];
  // Takla: uçuş yolunun havada, uçarak dönülen açısı. Çarpma anlarında (duvar sekmesi, tavan) hız yönü sıçrar;
  // o sıçramalar ve hemen sonrası, ya da hız düşükken (düşen kağıt) sayılmaz.
  let enYuksek = d.y, donus = 0, gamOnceki = Math.atan2(d.vy, d.vx), sayac = 0, sonCarpma = -1, ro = 0;
  while (!d.bitti && d.t < enUzun) {
    const r = adim(d, P, sahne);
    d = r.durum;
    olaylar.push(...r.olaylar);
    if (r.olaylar.some(e => e.tur === 'duvar' || e.tur === 'tavan' || e.tur === 'yanDuvar')) sonCarpma = d.t;
    const g = Math.atan2(d.vy, d.vx);
    if (!d.yerde && d.t - sonCarpma > 0.3 && Math.hypot(d.vx, d.vy) > 1.5) donus += sar(g - gamOnceki);
    gamOnceki = g;
    enYuksek = Math.max(enYuksek, d.y);
    // görüntüdeki yalpa (rad): kalite yalpası + sapmanın eğdirdiği kanat; yerde yumuşakça düzelir
    const giris = Math.min(1, d.t / 0.25), yumusak = giris * giris * (3 - 2 * giris);   // elden çıkarken düz başlar
    const hedefRo = (P.yatis * Math.sin(2 * Math.PI * 1.5 * d.t) + 0.4 * Math.atan(P.sapma / 0.3)) * yumusak;
    ro = d.yerde ? ro * Math.exp(-6 * DT) : hedefRo;
    if (++sayac % 2 === 0 || d.bitti) ornekler.push({ t: d.t, x: d.x, y: d.y, th: d.th, z: d.z, ro, v: Math.hypot(d.vx, d.vy) });
  }
  const pencere = olaylar.some(e => e.tur === 'pencere');
  const inis = olaylar.find(e => e.tur === 'indi' || e.tur === 'yereCakildi');
  const havada = inis ? inis.t : d.t;
  // kroki: en çok YOL_NOKTASI nokta, son nokta (iniş) her zaman dahil
  const adim_ = Math.max(1, Math.ceil((ornekler.length - 1) / (YOL_NOKTASI - 1)));
  const yol = ornekler.filter((_, i) => i % adim_ === 0 && i < ornekler.length - 1).concat([ornekler[ornekler.length - 1]])
    .slice(-YOL_NOKTASI).map(s => [+s.x.toFixed(2), +s.z.toFixed(2)]);
  const olay = pencere ? 'pencere'
    : olaylar.some(e => e.tur === 'duvar') ? 'duvar'
      : olaylar.some(e => e.tur === 'yanDuvar') ? 'yanDuvar'
        : olaylar.some(e => e.tur === 'yereCakildi') ? 'yereCakildi' : 'indi';
  const carpma = temasSayisi(olaylar);
  return {
    ornekler, olaylar, olay, yol,
    mesafe: pencere ? (sahne.uzunluk - x0) + PENCERE_BONUSU : Math.max(0, d.x - x0), sahne: sahne.id || null,
    sure: havada, enYuksek, loop: Math.floor(Math.abs(donus) / (2 * Math.PI)),
    tavan: olaylar.filter(e => e.tur === 'tavan').length, carpma, sapma: d.z,
  };
}

// Fırlatma jestinden atışa: hız 3–12 m/s, açı −20°..80°.
export const atis = (hiz, aci) => ({ hiz: Math.min(12, Math.max(3, hiz)), aci: Math.min(80, Math.max(-20, aci)) });
