// #/yazdir/:ucakId — A4 baskı şablonu: düz kağıt, numaralı kırışık çizgileri (vadi kesikli, dağ nokta-çizgi),
// sahibinin boyası ve ismi doğru yerde. Arka yüze düşen mürekkep ikinci sayfaya (aynı kağıdın arkasına) basılır.
import { cizgiStili, isimMetni } from '../engine/murekkep.js';
import { isimSvg, isimOlcegi } from './isimYazisi.js';
import { ust, not, el, dugme, cerceveleriCiz, svgKatman } from './sayfa.js';
import { tasarimYukle } from './tasarimYukle.js';
import { ucakModeli, RENKLER } from './ucakCiz.js';
import { kirisikDeseni, boyaDeseni, isimDeseni } from '../engine/baski.js';
import { anaDuzlem, kanatGeometrisi, isimYeri } from '../engine/poz.js';
import { depo } from '../depo.js';

const B = 1000;                                       // kağıt birimi → svg birimi
const A4Y = 1414;
const CIZGI = { vadi: '16 10', dag: '20 6 3 6' };

export async function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const ucak = depo().ucak(params.ucakId);
  let veri = null;
  if (ucak) { try { veri = await tasarimYukle(ucak.tasarim); } catch (e) { veri = null; } }
  if (!ctx.gecerli()) return {};
  ust(kap, ucak ? `Yazdır · ${ucak.ad || 'İsimsiz'}` : 'Uçak bulunamadı', { geri: { hash: '#/hangar', yazi: 'hangar' } });
  if (!ucak || !veri) { not(kap, 'Bu uçak hangarda yok.'); requestAnimationFrame(() => cerceveleriCiz(kap)); return {}; }
  const { tasarim, katlama } = veri;
  // Yatay kağıtlı tasarım dikey A4 sayfaya 90° döndürülerek basılır: kağıdın üst kenarı (burun) sayfanın sağında.
  const yatay = katlama.kagit.en > katlama.kagit.boy;
  const DONDUR = 'matrix(0 1 -1 0 1000 0)';
  const sayfaNoktasi = ([x, y]) => (yatay ? [B - y * B, x * B] : [x * B, y * B]);

  const ust2 = el('div', { sinif: 'ekranda' }, kap);
  not(ust2, 'Şablonu bas, kırışık çizgilerini numara sırasıyla katla: kesikli çizgi vadi (kendine doğru), nokta-çizgi dağ (arkaya). Yazıcıda kenar boşluğunu "yok", ölçeği %100 seç.'
    + (yatay ? ' Bu uçak yatay kağıttan katlanır: sayfayı sağ kenarı yukarıda olacak şekilde çevir.' : ''));
  const nav = el('nav', { sinif: 'dugmeler' }, ust2);
  dugme(nav, { id: 'yazdir-bas', yazi: 'Yazdır', tik: () => window.print() });

  const model = ucakModeli(katlama, { kalite: ucak.kalite, ayar: ucak.ayar });
  const desen = kirisikDeseni(katlama.son);
  const boya = boyaDeseni(katlama.son, model, ucak.boya.cizgiler);
  const ana = anaDuzlem(model, 'sag');
  const yer = ucak.ad ? isimYeri(kanatGeometrisi(model, 'sag'), ana.map(p => p.noktalar2.map(([x, y]) => [x * 100, y * 100])), isimMetni(ucak.ad, (ucak.isimStili || {}).bicim), isimOlcegi(ucak.isimStili)) : null;
  const isim = ucak.ad ? isimDeseni(katlama.son, model, yer) : null;

  const sayfalar = el('div', { sinif: 'baski-sayfalari' }, kap);
  // 1) ön yüz
  const { svg: onSayfa, ic: on } = sayfa(sayfalar, 'ön yüz');
  for (const k of desen.kirisikler) {
    KL.svgEl('line', { x1: k.p1[0] * B, y1: k.p1[1] * B, x2: k.p2[0] * B, y2: k.p2[1] * B, stroke: '#6d6d6d', 'stroke-width': 2.4, 'stroke-dasharray': CIZGI[k.tur], 'stroke-linecap': 'round' }, on);
  }
  murekkep(on, boya.on, isim && isim.yuz === 'on' ? isim : null, ucak, yer);
  for (const e of desen.etiketler) {                     // numaralar dönmez: sayfa koordinatında
    const [x, y] = sayfaNoktasi(e.nokta);
    KL.svgEl('circle', { cx: x, cy: y, r: 17, fill: '#fff', stroke: '#6d6d6d', 'stroke-width': 2 }, onSayfa);
    const t = KL.svgEl('text', { x, y: y + 7, 'text-anchor': 'middle', 'font-size': 22, fill: '#444' }, onSayfa);
    t.textContent = e.no;
  }
  const kunye = KL.svgEl('text', { x: 500, y: A4Y - 18, 'text-anchor': 'middle', 'font-size': 18, fill: '#9a9a9a' }, onSayfa);
  kunye.textContent = `Kağıt Hangar · ${tasarim.ad} · ${ucak.ad || 'İsimsiz'}`;

  // 2) arka yüz (yalnız arkaya düşen mürekkep varsa)
  const arkadaIsim = isim && isim.yuz === 'arka' ? isim : null;
  if (boya.arka.length || arkadaIsim) {
    const { ic: arka } = sayfa(sayfalar, 'arka yüz: aynı kağıdın arkasına bas');
    murekkep(arka, boya.arka, arkadaIsim, ucak, yer);
  }

  // 3) talimat
  const tal = el('section', { sinif: 'baski-sayfa talimat' }, sayfalar);
  const h = el('h2', { sinif: 'bolum' }, tal);
  KL.harfle(h, `${tasarim.ad} nasıl katlanır?`, { anlik: true });
  const ol = el('ol', { sinif: 'talimat-listesi' }, tal);
  tasarim.adimlar.forEach(a => KL.harfle(el('li', {}, ol), a.metin, { anlik: true }));
  const ac = el('p', { sinif: 'not' }, tal);
  KL.harfle(ac, 'Kesikli çizgi: vadi kat (kendine doğru). Nokta-çizgi: dağ kat (arkaya doğru). Numaralar adım sırasıdır.', { anlik: true });

  requestAnimationFrame(() => cerceveleriCiz(kap));
  return { boyut() { cerceveleriCiz(kap, true); } };   // yeniden kurmadan: yazılan girdi ve durum kalır

  function sayfa(kapsayici, etiket) {
    const s = el('section', { sinif: 'baski-sayfa' }, kapsayici);
    const svg = svgKatman(s, B, A4Y, 'baski-svg');
    svg.setAttribute('viewBox', `0 0 ${B} ${A4Y}`);
    svg.setAttribute('aria-label', `Baskı şablonu, ${etiket}`);
    KL.svgEl('rect', { x: 0, y: 0, width: B, height: A4Y, fill: '#fff' }, svg);
    const p = el('p', { sinif: 'not ekranda' }, s);
    KL.harfle(p, etiket, { anlik: true });
    const ic = yatay ? KL.svgEl('g', { transform: DONDUR }, svg) : svg;
    return { svg, ic };
  }

  function murekkep(svg, cizgiler, isimD, u, yerD) {
    for (const cz of cizgiler) {
      const d = cz.noktalar.length === 1 ? `M${cz.noktalar[0][0] * B},${cz.noktalar[0][1] * B}l0.1,0`
        : 'M' + cz.noktalar.map(([x, y]) => `${(x * B).toFixed(1)},${(y * B).toFixed(1)}`).join('L');
      const st = cizgiStili(cz);
      KL.svgEl('path', { d, fill: 'none', stroke: RENKLER[cz.renk] || RENKLER.mavi, 'stroke-width': st.kalinlik * 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': st.firca ? 0.6 : 1 }, svg);
    }
    if (isimD && yerD) {
      const m = isimD.svgMatris.map(v => v * B);
      const g = KL.svgEl('g', { transform: `matrix(${m.map(v => v.toFixed(4)).join(' ')})` }, svg);
      const yon = KL.svgEl('g', { transform: `translate(${yerD.cx} ${yerD.cy}) rotate(-90)${isimD.aynali ? ' scale(1 -1)' : ''}` }, g);
      isimSvg(yon, u.ad, u.isimStili, yerD.boyut, u.id);
    }
  }
}
