// session.js — sürümlü hamle kaydı. Skor, sahiplik ve geri alma geçmişi oyun kurallarından yeniden üretilir.
(function () {
  'use strict';
  const G = typeof module !== 'undefined' && module.exports ? require('./game.js') : window.SOS.game;
  const S = {};

  S.paketle = function (o) {
    return JSON.stringify({ surum: 1, n: o.n, oyunId: o.oyunId, ilkBaslayan: o.ilkBaslayan,
      secili: o.secili,
      oyunAyar: { zorluk: o.oyunAyar.zorluk, fazlaTur: o.oyunAyar.fazlaTur, ikiKisi: o.oyunAyar.ikiKisi },
      hamleler: o.hamleler.map(({ i, harf }) => ({ i, harf })) });
  };

  // Bozuk/eski kayıt veya yapılandırmadan farklı tahta boyutu yeni oyuna engel olmaz.
  S.coz = function (raw, boyut) {
    try {
      if (typeof raw !== 'string' || raw.length > 16000) return null;
      const k = JSON.parse(raw), a = k && k.oyunAyar;
      if (!k || k.surum !== 1 || !Number.isInteger(k.n) || k.n < 3 || k.n > 12 || k.n !== boyut
        || !Number.isSafeInteger(k.oyunId) || k.oyunId < 1 || ![0, 1].includes(k.ilkBaslayan)
        || !['S', 'O'].includes(k.secili) || !a || !['kolay', 'orta', 'zor'].includes(a.zorluk)
        || typeof a.fazlaTur !== 'boolean' || typeof a.ikiKisi !== 'boolean'
        || !Array.isArray(k.hamleler) || k.hamleler.length > k.n * k.n) return null;

      let durum = G.yeniOyun({ boyut: k.n, fazlaTur: a.fazlaTur, ilkBaslayan: k.ilkBaslayan });
      const gecmis = [], hamleler = [];
      let isaret = [], turSahibi = -1, turHamleleri = [];
      for (const m of k.hamleler) {
        if (!m || !Number.isInteger(m.i) || m.i < 0 || m.i >= k.n * k.n || !['S', 'O'].includes(m.harf)) return null;
        if (a.ikiKisi || durum.sira === 0) {
          gecmis.push({ durum, isaret: isaret.slice(), tur: { sahip: turSahibi, hamleler: turHamleleri.slice() } });
          isaret = [];
        }
        if (turSahibi !== durum.sira) { turSahibi = durum.sira; turHamleleri = []; }
        turHamleleri.push(m.i);
        // Dolu hücreler ve oyun bittikten sonraki hamleler de burada reddedilir.
        durum = G.placeLetter(durum, Math.floor(m.i / k.n), m.i % k.n, m.harf);
        hamleler.push({ i: m.i, harf: m.harf });
        if (durum.bitti) isaret = [];
        else if ((a.ikiKisi || durum.sira === 0) && turSahibi !== durum.sira) isaret = turHamleleri.slice();
      }
      return { n: k.n, oyunId: k.oyunId, ilkBaslayan: k.ilkBaslayan, secili: k.secili,
        oyunAyar: { zorluk: a.zorluk, fazlaTur: a.fazlaTur, ikiKisi: a.ikiKisi },
        hamleler, durum, gecmis, isaret, turSahibi, turHamleleri };
    } catch (e) { return null; }
  };

  if (typeof window !== 'undefined') (window.SOS = window.SOS || {}).session = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
