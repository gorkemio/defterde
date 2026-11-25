// #/duello — aynı cihazda iki kişi: herkes uçağını seçer, sırayla atar; en uzak atış kazanır.
import { SOZLUK as SZ } from './sozluk.js';
import { ust, not, el, dugme, cerceveleriCiz, secimGrubu } from './sayfa.js';
import { depo } from '../depo.js';
import { duelloBaslat, siradaki, skor, turNo } from '../engine/duello.js';
import { SAHNELER, SAHNE_IDLERI } from '../engine/sahneler.js';
import { duelloOku, duelloYaz } from './duelloDurum.js';

const sayi = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

export function kur(kap, params, ctx) {
  const KL = window.Kit.kalem;
  const D = depo();
  const d = duelloOku();
  ust(kap, 'Düello', { geri: { hash: '#/masa', yazi: 'masa' } });
  if (d && d.bitti) sonuclar(d);
  else if (d) suruyor(d);
  else kurulum();
  requestAnimationFrame(() => cerceveleriCiz(kap));
  return { boyut() { cerceveleriCiz(kap, true); } };   // yeniden kurmadan: yazılan girdi ve durum kalır

  function kurulum(onceki) {
    const ucaklar = D.ucaklar().filter(u => !u.emekli);
    if (!ucaklar.length) {
      not(kap, 'Düello için hangarda en az bir uçak olmalı.');
      const n = el('nav', { sinif: 'dugmeler' }, kap);
      dugme(n, { id: 'duello-katla', yazi: SZ.ileri.ilkKatla, href: '#/atolye/ok', onem: 'birincil' });
      return;
    }
    not(kap, 'İki kişi, tek cihaz. Herkes bir uçak seçsin; sırayla atın, en uzak atış kazanır.');
    const secim = [
      { ad: (onceki && onceki.oyuncular[0].ad) || D.ayarlar().pilotAdi || 'Oyuncu 1', ucakId: (onceki && onceki.oyuncular[0].ucakId) || ucaklar[0].id },
      { ad: (onceki && onceki.oyuncular[1].ad) || 'Oyuncu 2', ucakId: (onceki && onceki.oyuncular[1].ucakId) || (ucaklar[1] || ucaklar[0]).id },
    ];
    let sahne = (onceki && onceki.sahne) || 'sinif', tur = (onceki && onceki.tur) || 3;
    const izgara = el('div', { sinif: 'duello-izgara' }, kap);
    secim.forEach((o, i) => {
      const b = el('section', { sinif: 'duello-oyuncu' }, izgara);
      const satir = el('div', { sinif: 'satir-alan' }, b);
      KL.harfle(el('label', { sinif: 'etiket', for: 'duello-ad-' + i }, satir), `${i + 1}. oyuncu:`, { anlik: true });
      const g = el('input', { id: 'duello-ad-' + i, type: 'text', maxlength: 24, sinif: 'imza-girdi', autocomplete: 'off' }, satir);
      g.value = o.ad;
      g.addEventListener('input', () => { o.ad = g.value.trim(); });
      secimGrubu(b, ucaklar.map(u => ({ id: `duello-${i}-${u.id}`, yazi: u.ad || 'İsimsiz', deger: u.id })), o.ucakId, (v) => { o.ucakId = v; }, { etiket: `${i + 1}. oyuncunun uçağı` });
    });
    const s = el('div', { sinif: 'satir-alan' }, kap);
    KL.harfle(el('span', { sinif: 'etiket' }, s), 'Sahne:', { anlik: true });
    secimGrubu(s, SAHNE_IDLERI.map(id => ({ id: 'duello-sahne-' + id, yazi: SAHNELER[id].ad.toLowerCase(), deger: id })), sahne, (v) => { sahne = v; }, { etiket: 'Sahne' });
    const t = el('div', { sinif: 'satir-alan' }, kap);
    KL.harfle(el('span', { sinif: 'etiket' }, t), 'Atış:', { anlik: true });
    secimGrubu(t, [3, 5].map(n => ({ id: 'duello-tur-' + n, yazi: `${n}'er atış`, deger: n })), tur, (v) => { tur = v; }, { etiket: 'Atış sayısı' });
    const n = el('nav', { sinif: 'dugmeler' }, kap);
    dugme(n, { id: 'duello-basla', yazi: 'Düelloya başla →', tik: () => {
      const yeni = duelloBaslat({ oyuncular: secim, sahne, tur });
      duelloYaz(yeni);
      ctx.git(`#/uc/${siradaki(yeni).ucakId}/${sahne}`);
    } });
  }

  function suruyor(d) {
    const s = siradaki(d);
    not(kap, `Düello sürüyor. Sıra: ${s.ad} (${turNo(d)}. atış).`);
    tablo(d);
    const n = el('nav', { sinif: 'dugmeler' }, kap);
    dugme(n, { id: 'duello-devam', yazi: SZ.ileri.devam, href: `#/uc/${s.ucakId}/${d.sahne}`, onem: 'birincil' });
    dugme(n, { id: 'duello-iptal', yazi: SZ.tehlikeli.duelloBirak, tehlikeli: true, onem: 'ucuncul', tik: () => { duelloYaz(null); ctx.git('#/masa'); } });
  }

  function sonuclar(d) {
    const sk = skor(d);
    if (!d.kayitlandi) {
      const a = D.ayarlar().duello || { oynanan: 0 };
      D.ayarGuncelle({ duello: { oynanan: a.oynanan + 1 } });
      duelloYaz({ ...d, kayitlandi: true });
      window.Kit.ses.cal('kazan');
    }
    const h = el('p', { sinif: 'rutbe' }, kap);
    KL.harfle(h, sk.kazanan < 0 ? 'Berabere!' : `${d.oyuncular[sk.kazanan].ad} kazandı!`, { tohum: ['duello', d.oyuncular.map(o => o.ad).join()] });
    tablo(d);
    const n = el('nav', { sinif: 'dugmeler' }, kap);
    dugme(n, { id: 'duello-rovans', yazi: 'Rövanş', tik: () => {
      const yeni = duelloBaslat({ oyuncular: d.oyuncular.slice().reverse(), sahne: d.sahne, tur: d.tur });
      duelloYaz(yeni);
      ctx.git(`#/uc/${siradaki(yeni).ucakId}/${d.sahne}`);
    } });
    dugme(n, { id: 'duello-yeni', yazi: 'Yeni düello', tik: () => { duelloYaz(null); kap.textContent = ''; ust(kap, 'Düello', { geri: { hash: '#/masa', yazi: 'masa' } }); kurulum(d); requestAnimationFrame(() => cerceveleriCiz(kap)); } });
  }

  function tablo(d) {
    const sk = skor(d);
    const t = el('table', { sinif: 'duello-tablo' }, kap);
    const bas = el('tr', {}, el('thead', {}, t));
    KL.harfle(el('th', {}, bas), SAHNELER[d.sahne].ad, { anlik: true });
    for (let i = 0; i < d.tur; i++) KL.harfle(el('th', {}, bas), `${i + 1}.`, { anlik: true });
    KL.harfle(el('th', {}, bas), 'en uzak', { anlik: true });
    const gov = el('tbody', {}, t);
    d.oyuncular.forEach((o, i) => {
      const tr = el('tr', { sinif: sk.kazanan === i ? 'kazanan' : '' }, gov);
      KL.harfle(el('th', {}, tr), o.ad, { anlik: true });
      for (let j = 0; j < d.tur; j++) {
        const a = d.atislar[i][j];
        KL.harfle(el('td', {}, tr), a ? `${sayi(a.mesafe)} m` : '·', { anlik: true });
      }
      KL.harfle(el('td', {}, tr), `${sayi(sk.oyuncular[i].enIyi)} m`, { anlik: true });
    });
  }
}
