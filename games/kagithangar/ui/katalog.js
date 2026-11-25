// #/katalog — "Katlama Defteri": her tasarım bir sayfa kartı. Adım çizimleri motorun ürettiği durumlardır.
import { ust, not, el, svgKatman, secimGrubu, cerceveleriCiz } from './sayfa.js';
import { hepsiniYukle } from './tasarimYukle.js';
import { TURLER } from '../engine/tasarim.js';
import { hedef, kutu } from '../engine/fold.js';
import { durumCiz, ucakCiz } from './ucakCiz.js';
import { vadiCizgisi, dagCizgisi, kivrikOk, cetele, cizgiyiKirp } from './isaretler.js';

const KL = () => window.Kit.kalem;
const PUANLAR = [['hiz', 'hız'], ['suzulme', 'süzülme'], ['denge', 'denge'], ['akrobasi', 'akrobasi']];

// Kartta: ilk üç adım (adımdan önceki durum + kalemle katlama çizgisi) ve bitmiş uçak.
function adimSeridi(kap, tasarim, katlama) {
  const ara = 128, S = Math.min(100, 116 / katlama.kagit.en);   // yatay kağıt da hücreye sığsın
  const svg = svgKatman(kap, ara * 3 + 150, 168, 'mini');
  const K = KL().kalemYap(svg);
  for (let i = 0; i < 3 && i < katlama.adimlar.length; i++) {
    const a = katlama.adimlar[i];
    const durum = katlama.anlar[a.once];
    const ox = 14 + i * ara, oy = 10;
    const g = KL().svgEl('g', { transform: `translate(${ox} ${oy})` }, svg);
    durumCiz(g, durum, { olcek: S, golge: { dx: 2, dy: 3, opaklik: .15 }, bulaniklik: 2, kenar: .7 });
    const bb = kutu(durum);
    for (const h of a.hareketler) {
      if (h.tip === 'cevir') continue;
      const seg = cizgiyiKirp(h.cizgi, bb, 0.04);
      const an = ['katalog', tasarim.id, h.no];
      if (seg) (h.tip === 'dag' ? dagCizgisi : vadiCizgisi)(K, g, seg.map(([x, y]) => [x * S, y * S]), an);
      const t = h.tut, hd = hedef(h);
      kivrikOk(K, g, [t[0] * S, t[1] * S], [hd[0] * S, hd[1] * S], an, { bukum: .25 * (h.parca ? -1 : 1), uc: 5, anlik: true });
    }
    KL().metinSvg(svg, String(i + 1), { x: ox - 6, y: oy + 12, boyut: 14, renk: 'kursun', anlik: true });
  }
  const g = KL().svgEl('g', null, svg);
  ucakCiz(g, katlama, { merkez: [14 + ara * 3 + 60, 70], olcek: 92, zemin: -0.35, golge: { dx: 0, dy: 0, opaklik: .14 }, bulaniklik: 2 });
}

function puanlar(kap, tasarim) {
  const svg = svgKatman(kap, 300, 64, 'puanlar');
  const K = KL().kalemYap(svg);
  PUANLAR.forEach(([k, ad], i) => {
    const x = (i % 2) * 150, y = Math.floor(i / 2) * 30 + 4;
    KL().metinSvg(svg, ad, { x, y: y + 15, boyut: 15, hiza: 'start', renk: 'kursun', anlik: true });
    cetele(K, svg, x + 62, y, tasarim.karakter[k], ['kart', tasarim.id, k], { yukseklik: 16, ara: 5, anlik: true });
  });
}

function kart(kap, { tasarim, katlama }) {
  const a = el('a', { sinif: 'kart', href: `#/atolye/${tasarim.id}`, id: `kart-${tasarim.id}` }, kap);
  a.dataset.zorluk = tasarim.zorluk;
  a.dataset.tur = tasarim.tur;
  const h = el('h2', {}, a);
  KL().harfle(h, tasarim.ad, { anlik: true });
  const alt = el('p', { sinif: 'alt' }, a);
  KL().harfle(alt, `${tasarim.orijinalAd} · ${TURLER[tasarim.tur]} · zorluk ${'●'.repeat(tasarim.zorluk)}${'○'.repeat(3 - tasarim.zorluk)}`, { anlik: true });
  puanlar(a, tasarim);
  const p = el('p', {}, a);
  KL().harfle(p, tasarim.aciklama, { anlik: true });
  adimSeridi(a, tasarim, katlama);
  // harfle her yazıyı bağlantının adı yapar (sonuncusu kalırdı): kartın adı tasarımın tamamı
  a.setAttribute('aria-label', `${tasarim.ad} (${tasarim.orijinalAd}), ${TURLER[tasarim.tur].toLowerCase()}, zorluk ${tasarim.zorluk}/3. ${tasarim.aciklama}`);
  return a;
}

export async function kur(kap, params, ctx) {
  ust(kap, 'Katlama Defteri', { geri: { hash: '#/masa', yazi: 'masa' } });
  not(kap, 'Bir tasarım seç; adım adım birlikte katlayalım.');
  const filtre = { zorluk: 'hepsi', tur: 'hepsi' };
  const satir = el('div', { sinif: 'filtreler' }, kap);
  const z = el('div', { sinif: 'secim' }, satir);
  KL().harfle(el('span', { sinif: 'etiket' }, z), 'zorluk:', { anlik: true });
  secimGrubu(z, [
    { id: 'f-z-hepsi', yazi: 'hepsi', deger: 'hepsi' }, { id: 'f-z-1', yazi: '●', deger: '1' },
    { id: 'f-z-2', yazi: '●●', deger: '2' }, { id: 'f-z-3', yazi: '●●●', deger: '3' },
  ], 'hepsi', (v) => { filtre.zorluk = v; uygula(); }, { etiket: 'Zorluk' });
  const t = el('div', { sinif: 'secim' }, satir);
  KL().harfle(el('span', { sinif: 'etiket' }, t), 'tür:', { anlik: true });
  secimGrubu(t, [{ id: 'f-t-hepsi', yazi: 'hepsi', deger: 'hepsi' },
    ...Object.entries(TURLER).map(([d, ad]) => ({ id: 'f-t-' + d, yazi: ad.toLowerCase(), deger: d }))],
  'hepsi', (v) => { filtre.tur = v; uygula(); }, { etiket: 'Tür' });

  const kartlar = el('div', { sinif: 'kartlar' }, kap);
  const bosNot = not(kap, 'Bu filtreye uyan tasarım yok.');
  bosNot.hidden = true;
  requestAnimationFrame(() => cerceveleriCiz(kap));

  const veriler = await hepsiniYukle();
  if (!ctx.gecerli()) return {};
  const liste = veriler.map(v => kart(kartlar, v));

  function cerceveler() {
    liste.forEach((a, i) => { if (!a.hidden) KL().dugmeCerceve(a, i * 50, false); });
  }
  // kartlar da düğmeler gibi: üzerine gelince ya da odaklanınca kalem çerçeveden bir kez daha geçer
  liste.forEach((a) => { const v = () => KL().dugmeVurgu(a); a.addEventListener('pointerenter', v); a.addEventListener('focus', v); });
  function uygula() {
    let gorunen = 0;
    for (const a of liste) {
      const uyar = (filtre.zorluk === 'hepsi' || a.dataset.zorluk === filtre.zorluk) && (filtre.tur === 'hepsi' || a.dataset.tur === filtre.tur);
      a.hidden = !uyar;
      if (uyar) gorunen++;
    }
    bosNot.hidden = gorunen > 0;
    requestAnimationFrame(cerceveler);
  }
  uygula();
  return { boyut() { cerceveleriCiz(kap, true); cerceveler(); } };
}
