// nonogram/explain.js — açıklamalı ipucu: mevcut durumdan bir sonraki çıkarım ve onu anlatan tek cümle. DOM yok.
//   sonrakiIpucu(durum, bulmaca) → { tur: 'yanlis', hucreler, metin } | { tur: 'adim', adim, metin } | null
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M = node ? require('./model.js') : window.KK.model;
  const D = node ? require('./difficulty.js') : window.KK.difficulty;

  const cizgiAdi = (tur) => (tur === 'satir' ? 'satır' : 'sütun');
  const cizgiAdiDe = (tur) => (tur === 'satir' ? 'satırda' : 'sütunda');
  const cizgiAdiNin = (tur) => (tur === 'satir' ? 'satırın' : 'sütunun');
  // Türkçe sayı ekleri: 7'lik, 3'lük, 4'lük ...
  function lik(n) {
    const son = n % 10, onlar = n % 100;
    let ek;
    if (n === 0) ek = 'lık';
    else if (onlar === 10 || onlar === 30) ek = 'luk';
    else if (onlar === 20 || onlar === 50) ek = 'lik';
    else if (onlar === 40 || onlar === 60 || onlar === 90) ek = 'lık';
    else if (onlar === 70 || onlar === 80) ek = 'lik';
    else ek = ({ 1: 'lik', 2: 'lik', 3: 'lük', 4: 'lük', 5: 'lik', 6: 'lık', 7: 'lik', 8: 'lik', 9: 'luk' })[son];
    return `${n}'${ek}`;
  }
  const bloklarYazi = (bl) => bl.join(' ');
  const kareSayi = (n) => `${n} kare`;

  function aciklama(a) {
    const v = a.veri || {}, t = a.bolge && a.bolge.tur, no = a.bolge && (a.bolge.i + 1);
    const dolu = a.hucreler.filter(h => h.v === 1).length, bos = a.hucreler.length - dolu;
    switch (a.teknik) {
      case 'binme': {
        if (v.tek && v.uzunluk === v.alan) return `${v.alan} karelik ${cizgiAdiDe(t)} ${lik(v.uzunluk)} blok: bütün kareler dolu.`;
        if (v.tek) return `${v.alan} karelik ${cizgiAdiDe(t)} ${lik(v.uzunluk)} blok: en sola ve en sağa yerleştirince ortadaki ${v.ortak} kare iki yerleşimde de dolu, bu kareler kesin.`;
        return `${no}. ${cizgiAdi(t)}, ipucu ${bloklarYazi(v.bloklar)}: blokları hepsini sola ve sağa dayayınca ${lik(v.uzunluk)} blok iki yerleşimde de ${kareSayi(v.ortak)} örtüyor; bu kareler kesin dolu.`;
      }
      case 'uc': {
        const kenar = v.taraf === 'sol' ? (t === 'satir' ? 'sol' : 'üst') : (t === 'satir' ? 'sağ' : 'alt');
        const blok = v.taraf === 'sol' ? 'ilk' : 'son';
        if (v.mesafe === 0) return `${no}. ${cizgiAdiNin(t)} ${kenar} ucundaki kare dolu; ${blok} blok ${lik(v.uzunluk)}: ${kareSayi(v.uzunluk)} dolu, ardından çarpı.`;
        return `${no}. ${cizgiAdi(t)}: ${kenar} kenardan ${v.mesafe} kare içeride dolu kare var; ${lik(v.uzunluk)} ${blok} blok onu kapsamak zorunda${bos ? ', önündeki karelere de ulaşamaz' : ''}.`;
      }
      case 'tamam':
        if (v.tur === 'sifir') return `${no}. ${cizgiAdi(t)} boş (ipucu 0); bütün karelerine çarpı.`;
        if (v.tur === 'hepsi') return `${no}. ${cizgiAdiDe(t)} bütün bloklar yerleşti; kalan karelere çarpı.`;
        return `${no}. ${cizgiAdiDe(t)} ${lik(v.uzunluk)} blok tamamlandı; iki ucuna çarpı.`;
      case 'sigmaz':
        if (v.tur === 'bosluk') return `${no}. ${cizgiAdiDe(t)} bu ${v.uzunluk} karelik boşluğa en küçük blok (${v.enKucuk}) sığmaz; çarpı.`;
        return `${no}. ${cizgiAdiDe(t)} bu ${bos > 1 ? 'karelere' : 'kareye'} hiçbir blok ulaşamıyor; çarpı.`;
      case 'satirCozucu':
        return `${no}. ${cizgiAdiNin(t)} bütün yerleşimlerine bakınca ${dolu && bos ? 'şu kareler her yerleşimde aynı kalıyor' : dolu ? 'şu kareler her yerleşimde dolu' : 'şu kareler hiçbir yerleşimde dolu değil'}.`;
      case 'sinama1':
      case 'sinama2': {
        const c = v.celiski, var1 = v.varsayilan === 1 ? 'dolu' : 'boş', sonuc = v.varsayilan === 1 ? 'boş, çarpı' : 'dolu';
        const yer = `${c.i + 1}. ${cizgiAdiDe(c.tur)}`;
        return a.teknik === 'sinama1'
          ? `Bu kare ${var1} olsaydı ${yer} çelişki çıkardı; kare ${sonuc}.`
          : `Bu kare ${var1} olsaydı iki adım ötede, ${yer} çelişki çıkardı; kare ${sonuc}.`;
      }
      default: return 'Buradan bir kare daha çıkıyor.';
    }
  }

  // Önce oyuncunun yanlış işaretleri; yoksa en basit kuraldan bir sonraki çıkarım
  function sonrakiIpucu(d, b, o = {}) {
    const y = M.yanlislar(d, b);
    if (y.length) return { tur: 'yanlis', hucreler: [y[0]], metin: y.length > 1 ? `Bu kare yanlış işaretlenmiş (${y.length} yanlış kare var).` : 'Bu kare yanlış işaretlenmiş.' };
    const a = D.merdiven.sonrakiAdim(d, b, o.sinir);
    if (!a) return d.indexOf(0) < 0 ? null : { tur: 'yok', metin: 'Buradan mantıkla bir kare daha çıkmıyor.' };
    return { tur: 'adim', adim: a, metin: aciklama(a) };
  }

  const E = { aciklama, sonrakiIpucu, lik };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).explain = E;
  if (node) module.exports = E;
})();
