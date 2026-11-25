// Sonuç fişi: defter sayfasından koparılmış bir kart (ui/kart.js). El yazısı satırlar, üstten yol krokisi (kareli),
// bu mekândaki en iyiyle kıyas, rekor kırıldıysa kırmızı "YENİ REKOR!" karalaması, yeni rozet ve rütbe, başka mekân çipleri.
import { SOZLUK as SZ } from './sozluk.js';
import { el, dugme, cerceveleriCiz, svgKatman, secimGrubu } from './sayfa.js';
import { kartAc } from './kart.js';
import { SAHNELER, SAHNE_IDLERI } from '../engine/sahneler.js';

export const OLAYLAR = {
  indi: 'süzülüp yere indi', yereCakildi: 'burnu yere gömüldü', duvar: 'duvara çarptı',
  yanDuvar: 'yan duvara sürtündü', pencere: 'pencereden kaçtı!',
};
const sayi = (v, b = 1) => v.toFixed(b).replace('.', ',');

// v: { ucak, sonuc, rekor, ilk, oncekiEnIyi, hangarRekoru, pilot, sahne, secim, gorev, ilkUcus }
// e: { tekrar, ayni, hangar, adlandir, katla, sahneDegistir(id), duello, donus }
export function fisGoster(v, e) {
  const KL = window.Kit.kalem;
  const { ucak, sonuc, rekor, ilk, sahne, gorev } = v;
  const k = kartAc({
    etiket: 'Uçuş fişi', sinif: 'fis', saydam: true, disariTikla: false, esc: !e.duello, donus: e.donus,
    kapandi: (neden) => { if (neden === 'esc') e.tekrar(); },
  });
  const fis = k.kart;
  const baslik = el('h2', { sinif: 'bolum' }, fis);
  KL.harfle(baslik, `Uçuş fişi · ${ucak.ad || 'İsimsiz'} · ${sahne.ad.toLowerCase()}`);
  const satirlar = [
    ['mesafe', `${sayi(sonuc.mesafe)} m`],
    ['süre', `${sayi(sonuc.sure)} s`],
    ['en yüksek', `${sayi(sonuc.enYuksek)} m`],
    ['takla', String(sonuc.loop)],
    ['olay', OLAYLAR[sonuc.olay] || sonuc.olay],
  ];
  if (sonuc.atis) satirlar.push(['atış', `${sayi(sonuc.atis.hiz, 2)} m/s · ${sayi(sonuc.atis.aci, 1)}°`]);
  const tablo = el('dl', { sinif: 'fis-satirlar' }, fis);
  for (const [ad, deger] of satirlar) {
    KL.harfle(el('dt', {}, tablo), ad, { anlik: true });
    KL.harfle(el('dd', {}, tablo), deger, { tohum: ['fis', ad, deger] });
  }
  kroki(fis, sonuc, sahne);

  // bu mekândaki en iyiyle kıyas; hangarın rekoru başka bir uçaktaysa o da
  const fark = v.oncekiEnIyi != null ? sonuc.mesafe - v.oncekiEnIyi : null;
  if (rekor) KL.harfle(el('p', { sinif: 'fis-baglam' }, fis), `Önceki en iyin ${sayi(v.oncekiEnIyi)} m · bu atış +${sayi(fark)} m`, { anlik: true });
  else if (fark != null) KL.harfle(el('p', { sinif: 'fis-baglam kursun' }, fis), `Bu mekânda en iyin ${sayi(v.oncekiEnIyi)} m · bu atış ${fark >= 0 ? '+' : '−'}${sayi(Math.abs(fark))} m`, { anlik: true });
  if (v.hangarRekoru && v.hangarRekoru.ucakId !== ucak.id) {
    KL.harfle(el('p', { sinif: 'fis-baglam kursun' }, fis), `Hangar rekoru ${sayi(v.hangarRekoru.mesafe)} m (${v.hangarRekoru.ucakAd})`, { anlik: true });
  }
  if (gorev) {
    const g = el('p', { sinif: 'not mavi' }, fis);
    KL.harfle(g, gorev.basarili ? `Günün hedefi (${gorev.hedef} m) geçildi!` : `Günün hedefi ${gorev.hedef} m; bugünkü en iyin ${sayi(gorev.enIyi)} m.`, { anlik: true });
  }
  // pilot kartında yeni ne var: rozet ve rütbe (uçuştan önceki ve sonraki kartın farkı)
  for (const r of (v.pilot && v.pilot.yeniRozetler) || []) {
    const p = el('p', { sinif: 'fis-rozet' }, fis);
    rozetIsareti(p, r.id);
    KL.harfle(el('span', {}, p), `Yeni rozet: ${r.ad}. ${r.aciklama}`, { tohum: ['rozet', r.id] });
  }
  if (v.pilot && v.pilot.rutbe) KL.harfle(el('p', { sinif: 'fis-rutbe' }, fis), `Rütbe: ${v.pilot.rutbe.sonra}!`, { tohum: ['rutbe', v.pilot.rutbe.sonra] });
  if (rekor || ilk) {
    const r = el('p', { sinif: 'rekor' + (rekor ? '' : ' ilk') }, fis);
    KL.harfle(r, rekor ? 'YENİ REKOR!' : 'ilk uçuşu!', { tohum: ['rekor'] });
  }
  if (e.duello) KL.harfle(el('p', { sinif: 'not mavi' }, fis), `Düello: ${e.duello.satir}`, { anlik: true });

  const nav = el('nav', { sinif: 'dugmeler' }, fis);
  if (e.duello) dugme(nav, { id: 'fis-tekrar', yazi: e.duello.yazi, tik: e.duello.tik, onem: 'birincil' });
  else {
    dugme(nav, { id: 'fis-tekrar', yazi: 'Tekrar at', tik: () => e.tekrar(), onem: 'birincil' });
    if (e.ayni) dugme(nav, { id: 'fis-ayni', yazi: 'Aynı atış', tik: e.ayni });
    if (v.ilkUcus && e.adlandir) dugme(nav, { id: 'fis-adlandir', yazi: SZ.yan.adlandir, tik: e.adlandir });
  }
  if (!e.duello && e.sahneDegistir) {
    const satir = el('div', { sinif: 'secim fis-sahneler' }, fis);
    KL.harfle(el('span', { sinif: 'etiket' }, satir), 'Başka mekânda at:', { anlik: true });
    secimGrubu(satir, [...SAHNE_IDLERI.map(id => ({ id: 'fis-sahne-' + id, yazi: SAHNELER[id].ad.toLowerCase(), deger: id })),
      { id: 'fis-sahne-gunun', yazi: 'günün uçuşu', deger: 'gunun' }], v.secim, (id) => e.sahneDegistir(id), { etiket: 'Mekân seç' });
  }
  const alt = el('nav', { sinif: 'dugmeler' }, fis);
  if (!e.duello && e.katla) dugme(alt, { id: 'fis-katla', yazi: SZ.ileri.katla, tik: e.katla, onem: 'ucuncul' });
  dugme(alt, { id: 'fis-hangar', yazi: SZ.ileri.hangaraAs, tik: e.hangar, onem: 'ucuncul' });
  requestAnimationFrame(() => { cerceveleriCiz(fis); fis.querySelector('#fis-tekrar').focus({ preventScroll: true }); });
  return k;
}

// Pilot kartındaki gibi taralı küçük rozet dairesi.
function rozetIsareti(kap, id) {
  const KL = window.Kit.kalem;
  const svg = KL.svgEl('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' }, kap);
  const K = KL.kalemYap(svg);
  K.daire(svg, [20, 20, 30], { strokeWidth: 1.6, fill: 'rgba(31, 59, 155, .5)', fillStyle: 'hachure', hachureGap: 4 }, ['fis-rozet', id]);
  K.daire(svg, [20, 20, 36], { strokeWidth: 1 }, ['fis-rozet2', id]);
}

// Üstten yol krokisi: sahnenin boyuna göre ölçekli, kareli; kavisli iz, atış noktası, duvar ve pencere.
function kroki(kap, sonuc, S) {
  const KL = window.Kit.kalem;
  const sonX = Math.max(...sonuc.yol.map(p => p[0]));
  const L = isFinite(S.uzunluk) ? S.uzunluk : Math.max(20, Math.ceil((sonX + 3) / 5) * 5);
  const Zm = isFinite(S.yanDuvar) ? S.yanDuvar : Math.max(2, Math.ceil(Math.max(...sonuc.yol.map(p => Math.abs(p[1]))) + 0.5));
  const k = Math.min(26, 330 / L), ox = 14, oy = Zm * k + 10;
  const svg = svgKatman(kap, L * k + 2 * ox + 10, 2 * Zm * k + 36, 'kroki');
  svg.setAttribute('aria-label', 'Üstten yol krokisi');
  const X = (x) => ox + x * k, Z = (z) => oy + z * k;
  const adim = L <= 14 ? 0.5 : L <= 32 ? 1 : 5;
  const kareler = KL.svgEl('g', { stroke: 'rgba(86,140,214,.35)', 'stroke-width': .6 }, svg);
  for (let x = 0; x <= L + 1e-9; x += adim) KL.svgEl('line', { x1: X(x), y1: Z(-Zm), x2: X(x), y2: Z(Zm) }, kareler);
  for (let z = -Zm; z <= Zm + 1e-9; z += Math.max(0.5, adim)) KL.svgEl('line', { x1: X(0), y1: Z(z), x2: X(L), y2: Z(z) }, kareler);
  const K = KL.kalemYap(svg);
  const kursun = { stroke: KL.renkDeger('kursun'), strokeWidth: 1.2 };
  if (isFinite(S.yanDuvar)) {
    K.cizgi(svg, [X(0), Z(-Zm), X(L), Z(-Zm)], kursun, ['kroki', 'yan1'], { anlik: true });
    K.cizgi(svg, [X(0), Z(Zm), X(L), Z(Zm)], kursun, ['kroki', 'yan2'], { anlik: true });
  }
  if (isFinite(S.uzunluk)) {
    if (S.pencere) {
      K.cizgi(svg, [X(L), Z(-Zm), X(L), Z(-S.pencere.z)], { strokeWidth: 2 }, ['kroki', 'd1'], { anlik: true });
      K.cizgi(svg, [X(L), Z(S.pencere.z), X(L), Z(Zm)], { strokeWidth: 2 }, ['kroki', 'd2'], { anlik: true });
      KL.metinSvg(svg, 'pencere', { x: X(L) - 6, y: Z(0) + 4, boyut: 11, hiza: 'end', renk: 'kursun', anlik: true });
    } else K.cizgi(svg, [X(L), Z(-Zm), X(L), Z(Zm)], { strokeWidth: 2 }, ['kroki', 'd'], { anlik: true });
  }
  const etiketAdim = L <= 14 ? 2 : L <= 32 ? 5 : 10;
  for (let m = 0; m <= L; m += etiketAdim) KL.metinSvg(svg, String(m), { x: X(m), y: Z(Zm) + 13, boyut: 11, renk: 'kursun', anlik: true });
  const yol = sonuc.yol.map(([x, z]) => [X(Math.min(x, L + (sonuc.olay === 'pencere' ? 0.4 : 0))), Z(z)]);
  K.daire(svg, [yol[0][0], yol[0][1], 7], { strokeWidth: 1.3 }, ['kroki', 'bas'], { anlik: true });
  if (yol.length >= 2) K.egri(svg, yol, { strokeWidth: 1.8, roughness: 0.5, bowing: 0.3 }, ['kroki', 'iz', sonuc.mesafe]);
  const [sx, sz] = yol[yol.length - 1];
  K.cizgi(svg, [sx - 5, sz - 5, sx + 5, sz + 5], { stroke: KL.renkDeger('kirmizi'), strokeWidth: 1.6 }, ['kroki', 'x1'], { gecikme: 300 });
  K.cizgi(svg, [sx - 5, sz + 5, sx + 5, sz - 5], { stroke: KL.renkDeger('kirmizi'), strokeWidth: 1.6 }, ['kroki', 'x2'], { gecikme: 380 });
}
