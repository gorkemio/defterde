// Defter sekmeleri: kâğıdın kenarından çıkan ayraçlar (Masa · Katla · Hangar · Pilot). Bir kez kurulur, sayfalar
// arasında kalır (#sayfa'nın kardeşi; sayfa temizlenince silinmez). Masaüstünde sağ kenarda dikey, telefonda üst
// kenarda yatay. Seçili sekme kâğıt rengindedir ve kâğıda karışır; ötekiler bir ton koyu, kurşun kalem yazılı.
import { sekmeIcin } from '../engine/akis.js';

const SEKMELER = [
  { ad: 'masa', yazi: 'Masa', hash: '#/masa' },
  { ad: 'katla', yazi: 'Katla', hash: '#/katalog' },
  { ad: 'hangar', yazi: 'Hangar', hash: '#/hangar' },
  { ad: 'pilot', yazi: 'Pilot', hash: '#/pilot' },
];

export function sekmeleriKur(defter) {
  const KL = window.Kit.kalem;
  const nav = document.createElement('nav');
  nav.className = 'sekmeler';
  nav.setAttribute('aria-label', 'Defter sekmeleri');
  defter.insertBefore(nav, defter.firstChild);
  const liste = SEKMELER.map((s) => {
    const a = document.createElement('a');
    a.className = 'sekme';
    a.href = s.hash;
    a.dataset.sekme = s.ad;
    const svg = KL.svgEl('svg', { class: 'sekme-kagit', 'aria-hidden': 'true' }, a);
    const yazi = document.createElement('span');
    yazi.className = 'yazi';
    a.appendChild(yazi);
    KL.harfle(yazi, s.yazi, { anlik: true, tohum: ['sekme', s.ad] });
    nav.appendChild(a);
    return { ...s, a, svg };
  });
  let secili = null;

  // Sekmenin kâğıt dilimi: kâğıda bağlı kenarı açık, uç köşeleri kırık, elle çizilmiş kenar.
  function ciz(s) {
    const w = s.a.offsetWidth, h = s.a.offsetHeight;
    if (!w || !h) return;
    const dikey = getComputedStyle(nav).flexDirection === 'column';
    const svg = s.svg;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.textContent = '';
    const k = 5;
    const noktalar = dikey
      ? [[-12, 0], [w - k, 0], [w, k], [w, h - k], [w - k, h], [-12, h]]
      : [[0, h + 12], [0, k], [k, 0], [w - k, 0], [w, k], [w, h + 12]];
    const bu = s.ad === secili;
    KL.kalemYap(svg).cokgen(svg, noktalar, {
      fill: bu ? '#fbf9f2' : '#efeadc', fillStyle: 'solid', strokeWidth: bu ? 1.5 : 1.1,
      stroke: KL.renkDeger(bu ? 'mavi' : 'kursun'),
    }, ['sekme', s.ad, dikey ? 'd' : 'y', bu ? 1 : 0], { anlik: true });
  }

  return {
    isaretle(rotaAd) {
      secili = sekmeIcin(rotaAd);
      for (const s of liste) {
        const bu = s.ad === secili;
        s.a.classList.toggle('secili', bu);
        if (bu) s.a.setAttribute('aria-current', 'page'); else s.a.removeAttribute('aria-current');
      }
      liste.forEach(ciz);
    },
    boyut() { liste.forEach(ciz); },
  };
}
