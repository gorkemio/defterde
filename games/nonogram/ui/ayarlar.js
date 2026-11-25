// ui/ayarlar.js — Ayarlar notu: mod, araç, tamamlanan satırı çarpıyla doldur, ipucu rakamının üstünü çiz, büyüteç, ses, çocuk modu.
(function () {
  'use strict';
  const KK = window.KK;
  const KL = Kit.kalem;
  const $ = (id) => document.getElementById(id);
  const el = (ad, sinif, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; };

  function grup(ad, secenekler, deger, degistir) {
    const p = el('p', 'ayar-grup');
    p.appendChild(el('span', 'ayar-ad', ad + ':'));
    secenekler.forEach(([v, yazi], i) => {
      if (i) p.appendChild(el('span', 'ara', '·'));
      const b = el('button', 'ayar'); b.type = 'button';
      b.appendChild(el('span', 'yazi', yazi));
      b.setAttribute('aria-pressed', v === deger ? 'true' : 'false');
      b.addEventListener('click', () => { degistir(v); ciz(); });
      p.appendChild(b);
    });
    return p;
  }

  function ciz() {
    const O = KK.oyun, A = O.ayar, k = $('ayar-icerik');
    k.textContent = '';
    k.appendChild(grup('mod', KK.config.modlar.map(m => [m, KK.config.modAdi[m].toLowerCase()]), A.mod, (v) => {
      O.ayarYaz('mod', v);
      $('ayar-not').textContent = O.ekran === 'oyun' && v !== O.mod ? 'Mod yeni bulmacada geçerli.' : '';
    }));
    k.appendChild(grup('araç', [['kalem', 'kalem'], ['carpi', 'çarpı'], ['silgi', 'silgi']], A.arac, (v) => { O.ayarYaz('arac', v); KK.sayfa.araclariCiz(); }));
    const ac = [[true, 'açık'], [false, 'kapalı']];
    k.appendChild(grup('tamamlanan satırı çarpıyla doldur', ac, A.otoCarpi, (v) => O.ayarYaz('otoCarpi', v)));
    k.appendChild(grup('ipucu rakamının üstünü çiz', ac, A.ustunuCiz, (v) => { O.ayarYaz('ustunuCiz', v); if (O.b) O.ustuGuncelle(true); }));
    k.appendChild(grup('büyüteç', ac, A.buyutec, (v) => O.ayarYaz('buyutec', v)));
    k.appendChild(grup('ses', ac, A.ses, (v) => { O.ayarYaz('ses', v); Kit.ses.sessizYap(!v); KK.sayfa.sesCiz(); }));
    k.appendChild(grup('çocuk modu', ac, A.cocuk, (v) => {
      O.ayarYaz('cocuk', v);
      $('ayar-not').textContent = v ? 'Çocuk modu: 5×5 ve 10×10 resimler, Rahat mod, büyük kareler, ipucu her zaman açık.' : '';
      if (O.ekran === 'oyun' && O.b) O.tahtaKur(false);
    }));
    requestAnimationFrame(() => {
      k.querySelectorAll('.ayar[aria-pressed="true"]').forEach(b => KL.dugmeAltiCiz(b, 0, true));
      $('ayarlar').querySelectorAll('.not-komut .dugme').forEach(b => KL.dugmeAltiCiz(b, 0, true));
    });
  }

  KK.ayarlar = { ciz };
})();
