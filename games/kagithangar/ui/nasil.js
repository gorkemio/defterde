// #/nasil — "Nasıl uçar?": defter sayfasında doodle'larla kağıt uçağın fiziği. Sayılar uçuş motorundan gelir.
import { ATAC_YOLU, ATAC_RENGI } from './atac.js';
import { ust, not, el, svgKatman, cerceveleriCiz, secimGrubu } from './sayfa.js';
import { hepsiniYukle } from './tasarimYukle.js';
import { parametreler, CL, simule, SAHNE_ACIK } from '../engine/physics.js';

const DER = Math.PI / 180;
const sayi = (v, b = 1) => v.toFixed(b).replace('.', ',');

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  ust(kap, 'Nasıl uçar?', { geri: { hash: '#/masa', yazi: 'masa' } });
  not(kap, 'Kağıt uçağın sırrı dört kuvvet, bir açı ve biraz denge. Sayılar bu sitenin uçuş motorundan.');
  const veriler = await hepsiniYukle();
  if (!ctx.gecerli()) return {};
  const tasarim = (id) => veriler.find(v => v.tasarim.id === id).tasarim;
  const izgara = el('div', { sinif: 'nasil-izgara' }, kap);

  const bolum = (baslik, metin) => {
    const s = el('section', { sinif: 'nasil-bolum' }, izgara);
    KL.harfle(el('h2', { sinif: 'bolum' }, s), baslik);
    if (metin) KL.harfle(el('p', { sinif: 'not mavi' }, s), metin, { anlik: true });
    return s;
  };
  const mavi = KL.renkDeger('mavi'), kursun = KL.renkDeger('kursun'), kirmizi = KL.renkDeger('kirmizi');

  // ok çizimi: kalemle gövde + iki uç
  function ok(K, g, [x1, y1], [x2, y2], renk, an) {
    K.cizgi(g, [x1, y1, x2, y2], { stroke: renk, strokeWidth: 2 }, ['ok', ...an], { anlik: true });
    const a = Math.atan2(y2 - y1, x2 - x1), u = 10;
    K.cizgi(g, [x2, y2, x2 - u * Math.cos(a - 0.45), y2 - u * Math.sin(a - 0.45)], { stroke: renk, strokeWidth: 2 }, ['oku1', ...an], { anlik: true });
    K.cizgi(g, [x2, y2, x2 - u * Math.cos(a + 0.45), y2 - u * Math.sin(a + 0.45)], { stroke: renk, strokeWidth: 2 }, ['oku2', ...an], { anlik: true });
  }
  // yandan basit uçak doodle'ı (kalemle; bu sayfada uçak da bir çizim)
  function ucakDoodle(K, g, cx, cy, s = 1, an = []) {
    K.cokgen(g, [[cx + 90 * s, cy], [cx - 70 * s, cy - 8 * s], [cx - 70 * s, cy + 2 * s]], { strokeWidth: 1.8 }, ['ucak', ...an], { anlik: true });
    K.cokgen(g, [[cx + 60 * s, cy + 1 * s], [cx - 70 * s, cy + 2 * s], [cx - 64 * s, cy + 18 * s]], { strokeWidth: 1.4 }, ['govde', ...an], { anlik: true });
  }

  /* 1) dört kuvvet */
  {
    const s = bolum('Dört kuvvet', 'Elinden çıkınca uçağın tek motoru senin attığın hız. Kanat havayı aşağı iter, hava kanadı yukarı: taşıma. Yerçekimi aşağı çeker, hava sürtünmesi yavaşlatır.');
    const svg = svgKatman(s, 520, 230, 'nasil-svg');
    const K = KL.kalemYap(svg);
    ucakDoodle(K, svg, 250, 120, 1, ['dort']);
    ok(K, svg, [250, 105], [250, 30], mavi, ['tasima']); KL.metinSvg(svg, 'taşıma', { x: 262, y: 40, boyut: 18, hiza: 'start', renk: 'mavi', anlik: true });
    ok(K, svg, [235, 140], [235, 210], mavi, ['agirlik']); KL.metinSvg(svg, 'ağırlık', { x: 247, y: 205, boyut: 18, hiza: 'start', renk: 'mavi', anlik: true });
    ok(K, svg, [170, 118], [90, 118], kursun, ['surukleme']); KL.metinSvg(svg, 'sürükleme', { x: 80, y: 108, boyut: 17, hiza: 'end', renk: 'kursun', anlik: true });
    ok(K, svg, [350, 116], [450, 116], mavi, ['hiz']); KL.metinSvg(svg, 'atış hızı', { x: 455, y: 106, boyut: 17, hiza: 'start', renk: 'mavi', anlik: true });
  }

  /* 2) hücum açısı ve stall: kaydırıcı + motorun CL eğrisi */
  {
    const s = bolum('Hücum açısı ve stall', 'Kanadın havaya çarpma açısı büyüdükçe taşıma artar; ama bir yerden sonra hava kanadın üstünden kopar ve taşıma birden düşer. Buna stall denir.');
    let secili = 'marti', aci = 8;
    secimGrubu(s, veriler.map(v => ({ id: 'cl-' + v.tasarim.id, yazi: v.tasarim.ad, deger: v.tasarim.id })), secili, (v) => { secili = v; ciz(); }, { etiket: 'Tasarım' });
    const satir = el('div', { sinif: 'satir-alan' }, s);
    KL.harfle(el('label', { sinif: 'etiket', for: 'cl-aci' }, satir), 'hücum açısı:', { anlik: true });
    const kaydirici = el('input', { id: 'cl-aci', type: 'range', min: 0, max: 30, step: 1, value: aci, sinif: 'kaydirici' }, satir);
    const deger = el('span', { sinif: 'not mavi' }, satir);
    const svg = svgKatman(s, 520, 230, 'nasil-svg');
    kaydirici.addEventListener('input', () => { aci = +kaydirici.value; ciz(); });
    function ciz() {
      svg.textContent = '';
      const K = KL.kalemYap(svg);
      const P = parametreler(tasarim(secili));
      const stall = P.aStall / DER;
      KL.harfle(deger, `${aci}°${aci > stall ? ' · stall!' : ''}`, { anlik: true });
      // sol: kanat kesiti ve hava akışı
      const cx = 120, cy = 120, L = 70, a = -aci * DER;
      K.cizgi(svg, [cx - L * Math.cos(a), cy - L * Math.sin(a), cx + L * Math.cos(a), cy + L * Math.sin(a)], { strokeWidth: 3 }, ['kesit'], { anlik: true });
      const kopuk = aci > stall;
      for (let i = 0; i < 4; i++) {
        const y = 70 + i * 32;
        if (kopuk && y < cy) K.egri(svg, [[20, y], [70, y], [100, y - 6], [130, y + 8], [155, y - 10], [180, y + 6], [215, y - 4]], { stroke: kursun, strokeWidth: 1.2, roughness: 2.2 }, ['akis', i, 'k'], { anlik: true });
        else K.egri(svg, [[20, y], [80, y], [cx, y + (y < cy ? -10 : 8) - aci * (y < cy ? 0.4 : 0.6)], [170, y + (y < cy ? -6 : 12)], [215, y + (y < cy ? -2 : 16)]], { stroke: kursun, strokeWidth: 1.2 }, ['akis', i], { anlik: true });
      }
      KL.metinSvg(svg, 'hava →', { x: 30, y: 215, boyut: 15, hiza: 'start', renk: 'kursun', anlik: true });
      // sağ: CL eğrisi
      const ox = 290, oy = 200, gx = 210, gy = 160;
      K.cizgi(svg, [ox, oy, ox + gx, oy], { strokeWidth: 1.4 }, ['eksen-x'], { anlik: true });
      K.cizgi(svg, [ox, oy, ox, oy - gy], { strokeWidth: 1.4 }, ['eksen-y'], { anlik: true });
      KL.metinSvg(svg, 'taşıma', { x: ox + 6, y: oy - gy + 6, boyut: 14, hiza: 'start', renk: 'kursun', anlik: true });
      KL.metinSvg(svg, 'açı', { x: ox + gx, y: oy + 18, boyut: 14, hiza: 'end', renk: 'kursun', anlik: true });
      const enCok = CL(P, P.aStall);
      const nok = [];
      for (let d = 0; d <= 30; d += 1) nok.push([ox + d / 30 * gx, oy - CL(P, d * DER) / (enCok * 1.15) * gy]);
      K.egri(svg, nok, { stroke: mavi, strokeWidth: 2, roughness: 0.6 }, ['egri', secili], { anlik: true });
      const px = ox + aci / 30 * gx, py = oy - CL(P, aci * DER) / (enCok * 1.15) * gy;
      K.daire(svg, [px, py, 12], { stroke: kirmizi, fill: kirmizi, fillStyle: 'solid', strokeWidth: 1 }, ['nokta'], { anlik: true });
      const sx = ox + stall / 30 * gx;
      K.cizgi(svg, [sx, oy, sx, oy - gy], { stroke: kursun, strokeWidth: 1, strokeLineDash: [4, 5] }, ['stall'], { anlik: true });
      KL.metinSvg(svg, `stall ${sayi(stall, 0)}°`, { x: sx + 4, y: oy - gy + 26, boyut: 13, hiza: 'start', renk: 'kursun', anlik: true });
    }
    ciz();
  }

  /* 3) ağırlık merkezi ve ataç */
  {
    const P0 = parametreler(tasarim('ok')), r = [0, 1, 2].map(a => simule(parametreler(tasarim('ok'), { ayar: { atac: a } }), { hiz: 10, aci: 25 }, SAHNE_ACIK));
    const s = bolum('Ağırlık merkezi ve ataç', `Buruna ataç takınca ağırlık öne kayar: uçak burnunu daha az kaldırır, daha alçaktan ve dümdüz gider. Ok'u 10 m/s, 25° ile at: ataçsız en çok ${sayi(r[0].enYuksek, 2)} m'ye çıkıp ${sayi(r[0].mesafe)} m gider; iki ataçla ${sayi(r[2].enYuksek, 2)} m'ye çıkıp ${sayi(r[2].mesafe)} m gider.`);
    const svg = svgKatman(s, 520, 160, 'nasil-svg');
    const K = KL.kalemYap(svg);
    ucakDoodle(K, svg, 250, 80, 1, ['agirlik']);
    K.daire(svg, [215, 86, 18], { strokeWidth: 1.6 }, ['am'], { anlik: true });
    K.cizgi(svg, [206, 86, 224, 86], { strokeWidth: 1.4 }, ['am1'], { anlik: true });
    K.cizgi(svg, [215, 77, 215, 95], { strokeWidth: 1.4 }, ['am2'], { anlik: true });
    KL.metinSvg(svg, 'ağırlık merkezi', { x: 215, y: 130, boyut: 15, renk: 'kursun', anlik: true });
    const g = KL.svgEl('g', { transform: 'translate(318 76) scale(1.4)' }, svg);
    KL.svgEl('path', { d: ATAC_YOLU, fill: 'none', stroke: ATAC_RENGI, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
    ok(K, svg, [215, 60], [262, 60], mavi, ['kayma']);
    KL.metinSvg(svg, 'ataç takınca öne kayar', { x: 300, y: 40, boyut: 15, hiza: 'start', renk: 'mavi', anlik: true });
    void P0;
  }

  /* 4) kanatçıklar */
  {
    const P = (k) => parametreler(tasarim('taklaci'), { ayar: { kanatcik: k } });
    const l0 = simule(P(0), { hiz: 9, aci: 25 }, SAHNE_ACIK).loop, l2 = simule(P(2), { hiz: 9, aci: 25 }, SAHNE_ACIK).loop;
    const s = bolum('Kanatçıklar', `Kuyruktaki kanatçıkları yukarı kıvırınca hava kuyruğu aşağı bastırır, burun kalkar. Fazlası takla attırır: Taklacı aynı atışta kanatçık düzken ${l0}, iki kez yukarıdayken ${l2} takla atar.`);
    const svg = svgKatman(s, 520, 170, 'nasil-svg');
    const K = KL.kalemYap(svg);
    K.cizgi(svg, [80, 100, 330, 100], { strokeWidth: 2.4 }, ['kanat'], { anlik: true });
    K.cizgi(svg, [80, 100, 50, 72], { stroke: kirmizi, strokeWidth: 2.4 }, ['kanatcik'], { anlik: true });
    ok(K, svg, [40, 55], [62, 84], kursun, ['hava']);
    KL.metinSvg(svg, 'hava kuyruğu bastırır', { x: 20, y: 140, boyut: 15, hiza: 'start', renk: 'kursun', anlik: true });
    K.egri(svg, [[340, 100], [400, 60], [450, 50], [490, 70]], { stroke: mavi, strokeWidth: 1.8 }, ['burun'], { anlik: true });
    KL.metinSvg(svg, 'burun kalkar', { x: 420, y: 100, boyut: 15, renk: 'mavi', anlik: true });
    K.egri(svg, [[380, 150], [430, 120], [470, 140], [440, 165], [400, 150]], { stroke: mavi, strokeWidth: 1.4 }, ['takla'], { anlik: true });
  }

  /* 5) kanat ucu ve simetri */
  {
    const s = bolum('Kanat ucu ve simetri', 'Bir kanadın ucunu kıvırırsan o taraf daha çok sürüklenir, uçak döner. Özensiz katlanınca kanatlar eşit olmaz: uçak yalpalar, yana kayar ve kısa düşer. Elle katlarken hassasiyetin bu yüzden önemli.');
    const svg = svgKatman(s, 520, 170, 'nasil-svg');
    const K = KL.kalemYap(svg);
    K.cokgen(svg, [[380, 85], [140, 30], [150, 85], [140, 140]], { strokeWidth: 1.8 }, ['ustten'], { anlik: true });
    K.cizgi(svg, [140, 30, 160, 26], { stroke: kirmizi, strokeWidth: 2.4 }, ['kivrim'], { anlik: true });
    KL.metinSvg(svg, 'kıvrık uç', { x: 170, y: 20, boyut: 15, hiza: 'start', renk: 'kirmizi', anlik: true });
    K.egri(svg, [[400, 85], [450, 75], [490, 50], [505, 20]], { stroke: mavi, strokeWidth: 1.8 }, ['donus'], { anlik: true });
    KL.metinSvg(svg, 'bu yana döner', { x: 440, y: 110, boyut: 15, renk: 'mavi', anlik: true });
  }

  /* 6) süzülme oranı */
  {
    const s = bolum('Süzülme oranı', 'Atış hızı bitince uçak süzülür: her 1 metre alçalışta kaç metre ilerlediği tasarıma bağlıdır. Geniş kanatlılar uzun süzülür, dartlar hızlı ve dik iner.');
    const t = el('table', { sinif: 'duello-tablo' }, s);
    const bas = el('tr', {}, el('thead', {}, t));
    for (const h of ['tasarım', '1 m alçalırken', 'süzülme hızı']) KL.harfle(el('th', {}, bas), h, { anlik: true });
    const gov = el('tbody', {}, t);
    const satirlar = veriler.map(v => {
      const P = parametreler(v.tasarim);
      const CLt = P.aTrim * P.CLa;
      return { ad: v.tasarim.ad, ld: CLt / (P.CD0 + P.k * CLt * CLt), v: P.vTrim };
    }).sort((a, b) => b.ld - a.ld);
    for (const r of satirlar) {
      const tr = el('tr', {}, gov);
      KL.harfle(el('th', {}, tr), r.ad, { anlik: true });
      KL.harfle(el('td', {}, tr), `${sayi(r.ld)} m ilerler`, { anlik: true });
      KL.harfle(el('td', {}, tr), `${sayi(r.v)} m/s`, { anlik: true });
    }
  }

  requestAnimationFrame(() => cerceveleriCiz(kap));
  return { boyut() { cerceveleriCiz(kap, true); } };   // yeniden kurmadan: yazılan girdi ve durum kalır
}
