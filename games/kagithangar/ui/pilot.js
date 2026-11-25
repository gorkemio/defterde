// #/pilot — pilot kartı: rütbe, puan, rozetler, rekorlar. Basılabilir (kart A4'e tek başına basılır).
import { ust, not, el, dugme, cerceveleriCiz, svgKatman } from './sayfa.js';
import { pilotKarti } from '../engine/pilot.js';
import { depo } from '../depo.js';

const sayi = (v) => String(Math.round((v || 0) * 10) / 10).replace('.', ',');

export function kur(kap) {
  const KL = window.Kit.kalem;
  const D = depo();
  const k = pilotKarti(D.ucaklar(), D.ayarlar());
  ust(kap, 'Pilot kartı', { geri: { hash: '#/masa', yazi: 'masa' } });
  const ekran = el('div', { sinif: 'ekranda' }, kap);
  const satir = el('div', { sinif: 'satir-alan' }, ekran);
  KL.harfle(el('label', { sinif: 'etiket', for: 'pilot-adi' }, satir), 'Pilot adı:', { anlik: true });
  const girdi = el('input', { id: 'pilot-adi', type: 'text', maxlength: 24, sinif: 'imza-girdi', autocomplete: 'off', placeholder: 'adını yaz' }, satir);
  girdi.value = D.ayarlar().pilotAdi || '';
  const nav = el('nav', { sinif: 'dugmeler' }, ekran);
  dugme(nav, { id: 'pilot-yazdir', yazi: 'Kartı yazdır', tik: () => window.print() });

  const sarmal = el('div', { sinif: 'baski-sayfalari' }, kap);
  const kart = el('section', { sinif: 'pilot-kart sayfa' }, sarmal);
  function ciz() {
    kart.textContent = '';
    const ad = el('h2', { sinif: 'baslik' }, kart);
    KL.harfle(ad, girdi.value.trim() || 'İsimsiz pilot', { anlik: true });
    const r = el('p', { sinif: 'rutbe' }, kart);
    KL.harfle(r, `${k.rutbe} · ${k.puan} puan`, { anlik: true });
    if (k.sonraki) KL.harfle(el('p', { sinif: 'not' }, kart), `${k.sonraki.ad} rütbesine ${k.sonraki.kalan} puan kaldı.`, { anlik: true });
    const o = k.ozet;
    const dl = el('dl', { sinif: 'fis-satirlar' }, kart);
    for (const [a, d] of [
      ['uçak', String(o.ucak)], ['uçuş', String(o.toplamUcus)],
      ['en uzak', o.enUzak ? `${sayi(o.enUzak)} m (${o.enUzakUcak})` : '–'],
      ['en çok takla', String(o.enCokTakla)], ['pencereden kaçış', String(o.pencere)],
      ['gerçekte en uzak', o.gercekEnUzak ? `${sayi(o.gercekEnUzak)} m` : '–'],
    ]) { KL.harfle(el('dt', {}, dl), a, { anlik: true }); KL.harfle(el('dd', {}, dl), d, { anlik: true }); }
    // rozetler: kazanılan mavi mürekkeple taranmış, kazanılmayan kurşun kesik daire
    const sutun = 5, gen = 110, yuk = 118;
    const svg = svgKatman(kart, sutun * gen, Math.ceil(k.rozetler.length / sutun) * yuk, 'rozetler');
    svg.setAttribute('aria-label', `Rozetler: ${k.rozetler.filter(r => r.kazanildi).map(r => r.ad).join(', ') || 'henüz yok'}`);
    const K = KL.kalemYap(svg);
    k.rozetler.forEach((rz, i) => {
      const cx = (i % sutun) * gen + gen / 2, cy = Math.floor(i / sutun) * yuk + 44;
      const g = KL.svgEl('g', null, svg);
      KL.svgEl('title', null, g).textContent = `${rz.ad}: ${rz.aciklama}`;
      if (rz.kazanildi) {
        K.daire(g, [cx, cy, 64], { stroke: KL.renkDeger('mavi'), strokeWidth: 2, fill: 'rgba(31,59,155,.5)', fillStyle: 'hachure', hachureGap: 6 }, ['rozet', rz.id], { anlik: true });
        K.daire(g, [cx, cy, 52], { stroke: KL.renkDeger('mavi'), strokeWidth: 1.2 }, ['rozet2', rz.id], { anlik: true });
      } else {
        K.daire(g, [cx, cy, 64], { stroke: KL.renkDeger('kursun'), strokeWidth: 1.2, strokeLineDash: [4, 5] }, ['rozet', rz.id], { anlik: true });
      }
      KL.metinSvg(g, rz.ad, { x: cx, y: cy + 52, boyut: 14, renk: rz.kazanildi ? 'mavi' : 'kursun', anlik: true });
    });
    const tarih = el('p', { sinif: 'not' }, kart);
    KL.harfle(tarih, `Kağıt Hangar · ${new Date().toLocaleDateString('tr-TR')}`, { anlik: true });
  }
  girdi.addEventListener('input', () => { D.ayarGuncelle({ pilotAdi: girdi.value.trim() }); ciz(); });
  ciz();
  requestAnimationFrame(() => cerceveleriCiz(kap));
  return { boyut() { cerceveleriCiz(kap, true); } };   // yeniden kurmadan: yazılan girdi ve durum kalır
}
