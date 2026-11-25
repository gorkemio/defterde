// Kağıt durumlarını ve bitmiş uçağı gerçek kağıt malzemesiyle çizer (kagitCiz üstüne). Koordinat: kağıt birimi × ölçek.
// Sahibinin mürekkebi (isim, boya) kanatların düzleminde, o kanadın parçalarından hemen sonra çizilir:
// 3B görünümde önde duran parçalar boyayı doğru örter.
import { cizgiStili, isimMetni } from '../engine/murekkep.js';
import { isimSvg, isimOlcegi } from './isimYazisi.js';
import { RENK } from './renkler.js';
import { ATAC_YOLU, ATAC_RENGI } from './atac.js';
import { kagitCiz } from './kagitCiz.js';
import { kirisikler } from '../engine/fold.js';
import { kirisikIzleri } from '../engine/hangar.js';
import { poz, pozAcilari, ucusEkseni, kamera, izdusum, KAMERALAR, kaliteAcilari, gorunumAcilariTam, menteseleriIsaretle, ayarKatlari, anaDuzlem, kanatGeometrisi, isimYeri, duzdenEkrana, afinCerceve, grupAnahtari } from '../engine/poz.js';
import * as G from '../engine/geom.js';
export { isimYeri };

const KL = () => window.Kit.kalem;
const olcekle = (n, S, [ox, oy] = [0, 0]) => n.map(([x, y]) => [ox + x * S, oy + y * S]);

// Düz durum (üstten): poligonlar yığın sırasıyla; ön kırışıklar ('ac') ince çizgi; üst katmanlar alttakine
// hafif gölge düşürür.
export function durumCiz(katman, durum, o = {}) {
  const S = o.olcek ?? 300;
  const parcalar = durum.poligonlar.map((p, i) => ({
    noktalar: olcekle(p.noktalar, S, o.konum),
    yuz: p.yuz,
    ustte: i > 0,
    kirisikler: kirisikler(durum, p).map(s => olcekle(s, S, o.konum)),
  }));
  return kagitCiz(katman, parcalar, { golge: o.golge, kenar: o.kenar, bulaniklik: o.bulaniklik, temas: [S * 0.0035, S * 0.006] });
}

// Animasyon karesi: poz.katlanis çıktısı.
export function kareCiz(katman, parcalar, o = {}) {
  const S = o.olcek ?? 300;
  return kagitCiz(katman, parcalar.map(p => ({
    noktalar: olcekle(p.noktalar, S, o.konum), yuz: p.yuz, isik: p.isik,
    mentese: p.hareketli && p.isik < 0.995 ? olcekle(p.mentese, S, o.konum) : null,
  })), { golge: o.golge, kenar: o.kenar, mentese: S * 0.06 });
}

// Uçuş eksenindeki 3B model: gerçek duruş (dihedral, V gövde) + kaliteye göre asimetri + ayar panelinin sanal
// katları; en sonda düzlemlerin buluştuğu kat yerleri işaretlenir (iç gölge).
export function ucakModeli(katlama, o = {}) {
  const taban = gorunumAcilariTam(katlama.son, katlama.hareketler, o.gorunum);
  const ek = { ...taban, ...kaliteAcilari(katlama.hareketler, o.kalite, taban), ...(o.acilar || {}) };
  let model = ucusEkseni(poz(katlama.son, pozAcilari(katlama.hareketler, ek)));
  if (o.ayar) model = ayarKatlari(model, o.ayar);
  return menteseleriIsaretle(model);
}

// izdusum parçası → kagitCiz parçası (ekran koordinatına).
export const kagitParcasi = (p, ekran) => ({
  noktalar: p.noktalar.map(ekran), yuz: p.yuz, isik: p.isik, ustte: p.ustte, kenarTurleri: p.kenarTurleri,
  kirisikler: p.kirisikler.map(s => s.map(ekran)), menteseler: p.menteseler.map(s => s.map(ekran)),
});

export const RENKLER = { mavi: RENK.mavi, kirmizi: RENK.kirmizi, yesil: RENK.yesil };
export const BOYA_RENKLERI = Object.keys(RENKLER);
let klipSayac = 0;

// Bitmiş uçak. o: { ucak (kayıt: ad, boya, ayar, kalite), kamera, merkez, olcek, zemin, golge }.
// Dönüş: { g, model, cerceveler: { sol, sag }, boyaKatmani: { sol, sag }, ekran(p3) }.
// Çerçeve: kanadın ana düzleminde son durumun 2B koordinatı × 100 → ekran (SVG matrisi) ve tersi.
export function ucakCiz(katman, katlama, o = {}) {
  const u = o.ucak || {};
  const model = o.model || ucakModeli(katlama, { kalite: o.kalite ?? u.kalite, ayar: u.ayar });
  const kam = kamera(...(o.kamera || KAMERALAR.UCUS));
  const S = o.olcek ?? 200, [mx, my] = o.merkez || [0, 0];
  const ekran = ([x, y]) => [mx + x * S, my + y * S];
  const ekran3 = (p) => { const r = kam(p); return ekran([r.x, r.y]); };
  const iz = izdusum(model, kam, { zemin: o.zemin ?? -0.3 });
  const g = KL().svgEl('g', { class: 'ucak' }, katman);
  const ciz = { golge: false, kenar: o.kenar, mentese: S * 0.07, menteseGucu: .16, temas: temasKaymasi(kam, iz.isik, S) };

  // gölge bir kez, sonra düzlem düzlem kağıt
  kagitCiz(g, [], {
    golge: o.golge ?? { dx: 0, dy: 0, opaklik: .16 },
    golgeParcalar: iz.golge.map(n => n.map(ekran)), bulaniklik: o.bulaniklik ?? 3,
  });
  const cerceveler = { sol: kanatCercevesi('sol'), sag: kanatCercevesi('sag') };
  const boyaKatmani = {};
  const parcalar = iz.parcalar;
  for (let i = 0; i < parcalar.length;) {
    let j = i;
    while (j < parcalar.length && parcalar[j].anahtar === parcalar[i].anahtar) j++;
    const duzler = ((u.boya && u.boya.cizgiler) || []).filter(c => c.duz);
    if (!duzler.length) {
      kagitCiz(g, parcalar.slice(i, j).map(p => kagitParcasi(p, ekran)), ciz);
    } else {
      for (const p of parcalar.slice(i, j)) {               // düz kağıda çizilmiş mürekkep: parçanın hemen ardından
        const kp = kagitParcasi(p, ekran);
        kagitCiz(g, [kp], ciz);
        duzMurekkep(g, p, kp.noktalar, duzler, katlama.son, kam, ekran);
      }
    }
    for (const kanat of ['sol', 'sag']) {
      const c = cerceveler[kanat];
      if (c && c.anahtar === parcalar[i].anahtar && !boyaKatmani[kanat]) boyaKatmani[kanat] = murekkep(g, c, kanat, u);
    }
    i = j;
  }
  if (u.ayar && u.ayar.atac) atacCiz(g, model, ekran3, u.ayar.atac, S);

  function kanatCercevesi(kanat) {
    const duzlem = anaDuzlem(model, kanat);
    if (!duzlem.length) return null;
    const anahtar = grupAnahtari(duzlem[0].M);
    const m = kanatMatrisi(iz, duzlem, anahtar, ekran3);
    const det = m[0] * m[3] - m[1] * m[2];
    return {
      anahtar,
      matris: m, aynali: det < 0, gorunur: Math.abs(det) > 1e-6,
      kirp: duzlem.map(p => p.noktalar2.map(([x, y]) => [x * 100, y * 100])),
      geometri: kanatGeometrisi(model, kanat),
      // ekran (svg) → yerel (kağıt 2B, ×1)
      yerele([sx, sy]) {
        const dx = sx - m[4], dy = sy - m[5];
        return [(m[3] * dx - m[2] * dy) / det / 100, (-m[1] * dx + m[0] * dy) / det / 100];
      },
    };
  }
  return { g, model, cerceveler, boyaKatmani, ekran: ekran3 };
}

// Kanadın yerel 2B koordinatı ×100 → ekran matrisi. Mürekkep, o düzlemde en üstte çizilen katmanın üstüne
// (kalınlık kayması dahil) oturur; perspektifte kanadın ortası çevresinde doğrusal yaklaşım.
export function kanatMatrisi(iz, duzlem, anahtar, ekran3) {
  const ustteki = iz.parcalar.filter(p => p.anahtar === anahtar).pop();
  const M = ustteki ? ustteki.M : duzlem[0].M;
  const nokta = ([x, y]) => ekran3([
    M.R[0] * x + M.R[1] * y + M.t[0], M.R[3] * x + M.R[4] * y + M.t[1], M.R[6] * x + M.R[7] * y + M.t[2]]);
  const merkez = G.merkez(duzlem.flatMap(p => p.noktalar2));
  const [a, b, c, d, e, f] = afinCerceve(nokta, merkez);
  return [a / 100, b / 100, c / 100, d / 100, e, f];
}

// Katmanın alttakine düşen gölgesinin ekrandaki kayması: ışığın tersi yönünde, ölçekle orantılı.
export function temasKaymasi(kam, L, S) {
  const a = kam([0, 0, 0]), b = kam([-L[0], -L[1], -L[2]]);
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
  const k = S * 0.006;
  return [dx / n * k, Math.max(dy / n * k, k * 0.4)];
}

// Kanadın düzleminde, kanat şekline kırpılmış mürekkep katmanı: boya çizgileri ve (sağ kanatta) isim.
function murekkep(g, c, kanat, u) {
  if (!c.gorunur) return null;
  const KLk = KL();
  const id = 'murekkep-' + (++klipSayac);
  const defs = KLk.svgEl('defs', null, g);
  const klip = KLk.svgEl('clipPath', { id }, defs);
  for (const n of c.kirp) KLk.svgEl('path', { d: 'M' + n.map(q => q.map(v => v.toFixed(2)).join(',')).join('L') + 'Z' }, klip);
  const dis = KLk.svgEl('g', { transform: `matrix(${c.matris.map(v => v.toFixed(5)).join(' ')})` }, g);
  const ic = KLk.svgEl('g', { 'clip-path': `url(#${id})`, class: 'murekkep' }, dis);
  for (const [a, b] of kirisikler_(u, kanat, c.geometri)) {          // kağıdın kırışıkları (kalem değil)
    KLk.svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: 'rgba(130, 120, 98, .55)', 'stroke-width': .5, 'stroke-linecap': 'round' }, ic);
    KLk.svgEl('line', { x1: a[0] + .35, y1: a[1] + .35, x2: b[0] + .35, y2: b[1] + .35, stroke: 'rgba(255, 255, 255, .8)', 'stroke-width': .45, 'stroke-linecap': 'round' }, ic);
  }
  for (const cz of (u.boya && u.boya.cizgiler) || []) if (cz.kanat === kanat) boyaCizgisi(ic, cz);
  if (kanat === 'sag' && u.ad) isimYaz(ic, c, u);
  return ic;
}

// Yıpranma: kanadın normalize koordinatındaki kırışıklar → yerel ×100.
export function kirisikler_(u, kanat, g) {
  const adet = (u.yipranma && u.yipranma.kirisik) || 0;
  if (!adet || !g) return [];
  const m = ([a, b]) => [(g.menteseX + (g.disX - g.menteseX) * a) * 100, (g.yUst + (g.yArka - g.yUst) * b) * 100];
  return kirisikIzleri(u.id || 'ucak', adet).filter(k => k.kanat === kanat).map(k => [m(k.a), m(k.b)]);
}

// Düz kağıda çizilmiş (açıkken) mürekkep: bu parçanın görünen yüzündeki çizgiler, parçaya kırpılmış.
function duzMurekkep(g, p, ekranda, duzler, son, kam, ekran) {
  const cizgiler = duzler.filter(c => c.yuz === p.yuz);
  if (!cizgiler.length) return;
  const pol = son.poligonlar.find(q => q.id === p.id);
  if (!pol) return;
  const KLk = KL();
  const m = duzdenEkrana(pol.T, p.M, kam, ekran, G.donustur(pol.T, G.merkez(p.noktalar2)));
  if (Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-6) return;
  const id = 'duz-' + (++klipSayac);
  const defs = KLk.svgEl('defs', null, g);
  const klip = KLk.svgEl('clipPath', { id }, defs);
  KLk.svgEl('path', { d: 'M' + ekranda.map(q => q.map(v => v.toFixed(2)).join(',')).join('L') + 'Z' }, klip);
  const dis = KLk.svgEl('g', { 'clip-path': `url(#${id})` }, g);
  const ic = KLk.svgEl('g', { transform: `matrix(${m.map(v => v.toFixed(5)).join(' ')})` }, dis);
  for (const cz of cizgiler) {
    const n = cz.noktalar;
    const d = n.length === 1 ? `M${n[0][0]},${n[0][1]}l0.0001,0` : 'M' + n.map(q => `${q[0].toFixed(4)},${q[1].toFixed(4)}`).join('L');
    const st = cizgiStili(cz);
    KLk.svgEl('path', { d, fill: 'none', stroke: RENKLER[cz.renk] || RENKLER.mavi, 'stroke-width': st.kalinlik / 100, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: st.saydamlik }, ic);
  }
}

export function boyaCizgisi(ic, cz) {
  const n = cz.noktalar;
  if (!n.length) return null;
  const d = n.length === 1
    ? `M${n[0][0] * 100},${n[0][1] * 100}l0.01,0`
    : 'M' + n.map(q => `${(q[0] * 100).toFixed(2)},${(q[1] * 100).toFixed(2)}`).join('L');
  const st = cizgiStili(cz);
  return KL().svgEl('path', {
    d, fill: 'none', stroke: RENKLER[cz.renk] || RENKLER.mavi, 'stroke-width': st.kalinlik,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: st.saydamlik,
  }, ic);
}

// İsim kanat boyunca, burna doğru akar; stil (renk, boyut, biçim) uçağın isimStili'nden.
function isimYaz(ic, c, u) {
  const ad = isimMetni(u.ad, (u.isimStili || {}).bicim);
  const yer = isimYeri(c.geometri, c.kirp, ad, isimOlcegi(u.isimStili));
  if (!yer) return;
  const yon = KL().svgEl('g', { transform: `translate(${yer.cx.toFixed(2)} ${yer.cy.toFixed(2)}) rotate(-90)${c.aynali ? ' scale(1 -1)' : ''}` }, ic);
  isimSvg(yon, u.ad, u.isimStili, yer.boyut, u.id);
}

// Burunda tel ataç: metal bir nesne (kalem çizgisi değil, keskin gri tel).
function atacCiz(g, model, ekran3, adet, S) {
  const noktalar = model.parcalar.flatMap(p => p.noktalar3);
  const burun = noktalar.reduce((a, b) => (b[0] > a[0] ? b : a));
  const zUst = 0, arka = [burun[0] - 0.1, 0, Math.max(burun[2], zUst - 0.02)];
  const a = ekran3([burun[0] - 0.02, 0, burun[2] * 0.5]), b = ekran3(arka);
  const aci = Math.atan2(a[1] - b[1], a[0] - b[0]) * 180 / Math.PI;
  const olcek = S * 0.0042;
  const KLk = KL();
  for (let i = 0; i < adet; i++) {
    const t = 0.1 + i * 0.32;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const grup = KLk.svgEl('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${aci.toFixed(1)}) scale(${olcek.toFixed(3)}) translate(-17 -4)`, class: 'atac' }, g);
    KLk.svgEl('path', { d: ATAC_YOLU, fill: 'none', stroke: ATAC_RENGI, 'stroke-width': 1.1, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }, grup);
    KLk.svgEl('path', { d: ATAC_YOLU, fill: 'none', stroke: '#d4d9de', 'stroke-width': 0.45, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', transform: 'translate(-.25 -.25)' }, grup);
  }
}
